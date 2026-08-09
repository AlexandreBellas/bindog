import type IGameEngineGateway from "../IGameEngineGateway"
import type { IRoomStateListener } from "../IGameEngineGateway"
import type { IGameState, IPlayerProgress } from "#/@types/game"
import { ConnectRole, GameEngineMessageType, RoomPhase } from "#/@types/room"
import type { IConnectInput, IGameEngineMessage, IRoomState } from "#/@types/room"
import {
    DataChannelMessageType,
    IceTransportPath,
    SignalingClientMessageType,
    SignalingServerMessageType,
    WebRtcSignalKind
} from "#/@types/signaling"
import type {
    IDataChannelMessage,
    IIceServersResponse,
    ISignalingClientMessage,
    ISignalingServerMessage,
    ISyncMessage,
    IWebRtcSignalPayload
} from "#/@types/signaling"
import { ANNOUNCE_INTERVAL_MS } from "#/constants/announce"
import { BREED_IDS } from "#/constants/breeds"
import { COUNTDOWN_START, COUNTDOWN_TICK_MS } from "#/constants/countdown"
import { bestLineProgress, dealAllBoards, isLegitimateBingo, shuffleCallOrder } from "#/services/base/utils/bingo"
import BaseWebRtcService from "#/services/base/webrtc"

interface IPeerLink {
    peerId: string
    connection: RTCPeerConnection
    channel: RTCDataChannel | null
}

export default class GameEngineCloudflare extends BaseWebRtcService implements IGameEngineGateway {
    private state: IRoomState | null = null
    private listeners = new Set<IRoomStateListener>()
    private signalingSocket: WebSocket | null = null
    private iceServers: RTCIceServer[] = []
    private peers = new Map<string, IPeerLink>()
    private localPeerId: string | null = null
    private isLeader = false
    private countdownTimer: ReturnType<typeof setTimeout> | null = null
    private announceTimer: ReturnType<typeof setTimeout> | null = null
    private connectAbort: AbortController | null = null
    private sessionUsedTurn = false

    public async connect(input: IConnectInput): Promise<IRoomState> {
        await this.disconnect()

        const nickname = input.nickname.trim().slice(0, 24)
        if (!nickname) throw new Error("Nickname is required")

        this.connectAbort = new AbortController()
        const { signal } = this.connectAbort

        try {
            this.iceServers = await this.fetchIceServers(signal)
            this.localPeerId = this.createPeerId()
            this.isLeader = input.role === ConnectRole.Leader

            let roomCode: string
            let roomName: string

            if (input.role === ConnectRole.Leader) {
                const roomNameInput = input.roomName.trim().slice(0, 48)
                if (!roomNameInput) throw new Error("Room name is required")

                const created = await this.createRoom(roomNameInput, signal)
                roomCode = created.code
                roomName = created.name
            } else {
                roomCode = this.normalizeRoomCode(input.roomCode)
                if (!this.isValidRoomCode(roomCode)) throw new Error("Invalid room code")

                const existing = await this.fetchRoom(roomCode, signal)
                roomName = existing.name
            }

            this.state = {
                code: roomCode,
                name: roomName,
                players: [
                    {
                        id: this.localPeerId,
                        nickname,
                        isLeader: this.isLeader
                    }
                ],
                phase: RoomPhase.Lobby,
                countdown: null,
                localPlayerId: this.localPeerId,
                game: null
            }
            this.emit()

            await this.openSignalingSocket(roomCode, nickname, signal)
            return this.requireState()
        } catch (error) {
            await this.disconnect()
            throw error
        }
    }

    public async disconnect(): Promise<void> {
        this.clearCountdownTimer()
        this.clearAnnounceTimer()
        this.connectAbort?.abort()
        this.connectAbort = null

        if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
            this.sendSignaling({ type: SignalingClientMessageType.Leave })
        }

        this.closeSignalingSocket()
        this.closeAllPeers()

        this.state = null
        this.localPeerId = null
        this.isLeader = false
        this.sessionUsedTurn = false
        this.iceServers = []
        this.emit()
    }

    public dispose(): void {
        void this.disconnect()
        this.listeners.clear()
    }

    public send(message: IGameEngineMessage): void {
        if (message.type === GameEngineMessageType.StartGame) {
            const state = this.requireState()
            if (!this.evaluateCanStartGame(state)) {
                throw new Error("Need at least two players to start")
            }
            void this.beginCountdown()
            return
        }

        if (message.type === GameEngineMessageType.ClaimBingo) {
            this.requestClaimBingo()
            return
        }

        void this.restartGame()
    }

    public subscribe(listener: IRoomStateListener): () => void {
        this.listeners.add(listener)
        if (this.state) listener(this.state)

        return () => {
            this.listeners.delete(listener)
        }
    }

    public getState(): IRoomState | null {
        return this.state
    }

    public canStartGame(): boolean {
        const state = this.state
        if (!state) return false
        return this.evaluateCanStartGame(state)
    }

    public isValidRoomCode(code: string): boolean {
        return super.isValidRoomCode(code)
    }

    private requireState(): IRoomState {
        if (!this.state) throw new Error("Not connected")
        return this.state
    }

    private setState(next: IRoomState): void {
        this.state = next
        this.emit()
    }

    private emit(): void {
        const snapshot = this.state
        for (const listener of this.listeners) {
            listener(snapshot)
        }
    }

    private async fetchIceServers(signal?: AbortSignal): Promise<RTCIceServer[]> {
        const response = await fetch(`${this.getSignalingHttpUrl()}/turn/credentials`, {
            method: "POST",
            signal
        })

        if (!response.ok) throw new Error("Failed to fetch TURN credentials")

        const payload = (await response.json()) as IIceServersResponse
        if (!Array.isArray(payload.iceServers)) throw new Error("Invalid TURN response")

        return payload.iceServers
    }

    private async createRoom(name: string, signal: AbortSignal): Promise<{ code: string; name: string }> {
        const response = await fetch(`${this.getSignalingHttpUrl()}/rooms`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name }),
            signal
        })

        if (!response.ok) throw new Error("Failed to create room")

        const payload = (await response.json()) as { code?: string; name?: string }
        if (typeof payload.code !== "string" || typeof payload.name !== "string") {
            throw new Error("Invalid create-room response")
        }

        return { code: payload.code, name: payload.name }
    }

    private async fetchRoom(code: string, signal: AbortSignal): Promise<{ code: string; name: string }> {
        const response = await fetch(`${this.getSignalingHttpUrl()}/rooms/${encodeURIComponent(code)}`, {
            method: "GET",
            signal
        })

        if (response.status === 404) throw new Error("Invalid room code")
        if (!response.ok) throw new Error("Failed to join room")

        const payload = (await response.json()) as { code?: string; name?: string; exists?: boolean }
        if (!payload.exists || typeof payload.code !== "string" || typeof payload.name !== "string") {
            throw new Error("Invalid room code")
        }

        return { code: payload.code, name: payload.name }
    }

    private openSignalingSocket(roomCode: string, nickname: string, signal: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(this.getSignalingWsUrl(roomCode))
            this.signalingSocket = socket

            const onAbort = () => {
                cleanup()
                try {
                    socket.close()
                } catch {
                    // Ignore.
                }
                reject(new Error("Connection aborted"))
            }

            const cleanup = () => {
                signal.removeEventListener("abort", onAbort)
                socket.removeEventListener("open", onOpen)
                socket.removeEventListener("error", onError)
            }

            const onError = () => {
                cleanup()
                reject(new Error("Connection failed"))
            }

            const onOpen = () => {
                if (!this.localPeerId) {
                    cleanup()
                    reject(new Error("Missing local peer id"))
                    return
                }

                this.sendSignaling({
                    type: SignalingClientMessageType.Join,
                    role: this.isLeader ? ConnectRole.Leader : ConnectRole.Joiner,
                    peerId: this.localPeerId,
                    nickname
                })
            }

            signal.addEventListener("abort", onAbort)
            socket.addEventListener("open", onOpen)
            socket.addEventListener("error", onError)

            socket.addEventListener("message", event => {
                if (typeof event.data !== "string") return

                let parsed: unknown
                try {
                    parsed = JSON.parse(event.data)
                } catch {
                    return
                }

                const message = this.parseSignalingServerMessage(parsed)
                if (!message) return

                if (message.type === SignalingServerMessageType.Joined) {
                    cleanup()
                    this.handleJoined(message)
                    resolve()
                    return
                }

                if (message.type === SignalingServerMessageType.Error) {
                    cleanup()
                    reject(new Error(message.message || "Connection failed"))
                    return
                }

                this.handleSignalingMessage(message)
            })

            socket.addEventListener("close", () => {
                if (this.signalingSocket === socket) this.signalingSocket = null
            })
        })
    }

    private handleJoined(message: Extract<ISignalingServerMessage, { type: "joined" }>): void {
        const state = this.requireState()
        const players = message.peers.map(peer => ({
            id: peer.id,
            nickname: peer.nickname,
            isLeader: peer.isLeader
        }))

        this.setState({
            ...state,
            code: message.roomCode,
            name: message.roomName,
            players
        })

        if (this.isLeader) {
            for (const peer of players) {
                if (peer.id === this.localPeerId) continue
                void this.connectToJoiner(peer.id).catch(() => {
                    // Peer may disconnect while the offer is being prepared.
                })
            }
        }
    }

    private handleSignalingMessage(message: ISignalingServerMessage): void {
        switch (message.type) {
            case SignalingServerMessageType.PeerJoined: {
                const state = this.requireState()
                this.setState(this.upsertPlayer(state, message.peer))

                if (this.isLeader && message.peer.id !== this.localPeerId) {
                    void this.connectToJoiner(message.peer.id).catch(() => {
                        // Peer may disconnect while the offer is being prepared.
                    })
                }
                break
            }
            case SignalingServerMessageType.PeerLeft: {
                this.handlePeerLeft(message.peerId, message.newLeaderId)
                break
            }
            case SignalingServerMessageType.Signal: {
                void this.handleWebRtcSignal(message.from, message.payload)
                break
            }
            default:
                break
        }
    }

    private handlePeerLeft(peerId: string, newLeaderId: string | null): void {
        this.teardownPeer(peerId)
        if (!this.state) return

        let next = this.removePlayer(this.state, peerId)
        const becameLeader = Boolean(newLeaderId && newLeaderId === this.localPeerId && !this.isLeader)

        if (newLeaderId) {
            next = this.applyLeader(next, newLeaderId)
            this.isLeader = this.localPeerId === newLeaderId
        }

        if (!this.isLeader) {
            this.clearAnnounceTimer()
        }

        this.setState(next)

        if (becameLeader) {
            this.closeAllPeers()
            for (const player of next.players) {
                if (player.id === this.localPeerId) continue
                void this.connectToJoiner(player.id).catch(() => {
                    // Peer may disconnect while the offer is being prepared.
                })
            }
            this.resumeAnnounceLoop()
            return
        }

        if (this.isLeader) this.broadcastSync()
    }

    private async connectToJoiner(peerId: string): Promise<void> {
        if (this.peers.has(peerId)) return

        const connection = this.createPeerConnection(peerId)
        const channel = connection.createDataChannel("bindog", { ordered: true })
        this.attachDataChannel(peerId, channel)

        const link: IPeerLink = { peerId, connection, channel }
        this.peers.set(peerId, link)

        const offer = await connection.createOffer()
        await connection.setLocalDescription(offer)

        this.sendSignaling({
            type: SignalingClientMessageType.Signal,
            to: peerId,
            payload: {
                kind: WebRtcSignalKind.Offer,
                sdp: offer
            }
        })
    }

    private async handleWebRtcSignal(from: string, payload: IWebRtcSignalPayload): Promise<void> {
        if (payload.kind === WebRtcSignalKind.Offer) {
            let link = this.peers.get(from)
            if (!link) {
                const connection = this.createPeerConnection(from)
                link = { peerId: from, connection, channel: null }
                this.peers.set(from, link)

                connection.addEventListener("datachannel", event => {
                    this.attachDataChannel(from, event.channel)
                })
            }

            await link.connection.setRemoteDescription(payload.sdp)
            const answer = await link.connection.createAnswer()
            await link.connection.setLocalDescription(answer)

            this.sendSignaling({
                type: SignalingClientMessageType.Signal,
                to: from,
                payload: {
                    kind: WebRtcSignalKind.Answer,
                    sdp: answer
                }
            })
            return
        }

        if (payload.kind === WebRtcSignalKind.Answer) {
            const link = this.peers.get(from)
            if (!link) return
            await link.connection.setRemoteDescription(payload.sdp)
            return
        }

        const link = this.peers.get(from)
        if (!link) return
        try {
            await link.connection.addIceCandidate(payload.candidate)
        } catch {
            // Candidate may arrive before remote description in rare races.
        }
    }

    private createPeerConnection(peerId: string): RTCPeerConnection {
        const connection = new RTCPeerConnection({ iceServers: this.iceServers })

        connection.addEventListener("icecandidate", event => {
            if (!event.candidate) return

            this.sendSignaling({
                type: SignalingClientMessageType.Signal,
                to: peerId,
                payload: {
                    kind: WebRtcSignalKind.Ice,
                    candidate: event.candidate.toJSON()
                }
            })
        })

        connection.addEventListener("connectionstatechange", () => {
            if (connection.connectionState === "connected") {
                this.logIceTransportPathIfDev(connection, peerId)
                void this.trackTurnUsage(connection)
            }

            if (connection.connectionState === "failed" || connection.connectionState === "closed") {
                this.teardownPeer(peerId)
            }
        })

        return connection
    }

    private async trackTurnUsage(connection: RTCPeerConnection): Promise<void> {
        let path = await this.resolveIceTransportPath(connection)
        if (path === IceTransportPath.Unknown) {
            await new Promise(resolve => setTimeout(resolve, 250))
            path = await this.resolveIceTransportPath(connection)
        }

        if (path === IceTransportPath.Turn) {
            this.sessionUsedTurn = true
        }
    }

    private attachDataChannel(peerId: string, channel: RTCDataChannel): void {
        const link = this.peers.get(peerId)
        if (link) link.channel = channel

        channel.addEventListener("open", () => {
            if (this.isLeader) {
                this.broadcastSync()
                return
            }

            this.sendPeerHello(peerId)
        })

        channel.addEventListener("message", event => {
            if (typeof event.data !== "string") return

            let parsed: unknown
            try {
                parsed = JSON.parse(event.data)
            } catch {
                return
            }

            const message = this.parseDataChannelMessage(parsed)
            if (!message) return
            this.handleDataChannelMessage(message)
        })
    }

    private sendPeerHello(peerId: string): void {
        const state = this.state
        const localPlayerId = this.localPeerId
        if (!state || !localPlayerId) return

        const local = state.players.find(player => player.id === localPlayerId)
        if (!local) return

        const link = this.peers.get(peerId)
        if (!link?.channel || link.channel.readyState !== "open") return

        link.channel.send(
            JSON.stringify({
                type: DataChannelMessageType.PeerHello,
                player: local
            })
        )
    }

    private handleDataChannelMessage(message: IDataChannelMessage): void {
        const state = this.state
        if (!state) return

        switch (message.type) {
            case DataChannelMessageType.Sync: {
                this.setState({
                    ...state,
                    code: message.code,
                    name: message.name,
                    players: message.players,
                    phase: message.phase,
                    countdown: message.countdown,
                    game: message.game
                })
                break
            }
            case DataChannelMessageType.Countdown: {
                this.setState(this.applyCountdown(state, message.value))
                break
            }
            case DataChannelMessageType.Playing: {
                this.setState(this.applyPlaying(state))
                break
            }
            case DataChannelMessageType.PeerHello: {
                this.setState(this.upsertPlayer(state, message.player))
                break
            }
            case DataChannelMessageType.GameSnapshot: {
                this.setState({
                    ...state,
                    phase: message.phase,
                    countdown: null,
                    game: message.game
                })
                break
            }
            case DataChannelMessageType.BreedAnnounced: {
                if (!state.game) break
                this.setState({
                    ...state,
                    game: {
                        ...state.game,
                        currentBreedId: message.breedId,
                        announced: message.announced,
                        callOrder: message.callOrder,
                        announceStartedAt: message.announceStartedAt,
                        fakeBingoPlayerId: null
                    }
                })
                break
            }
            case DataChannelMessageType.FakeBingo: {
                if (!state.game) break
                this.setState({
                    ...state,
                    game: {
                        ...state.game,
                        fakeBingoPlayerId: message.playerId
                    }
                })
                break
            }
            case DataChannelMessageType.GameEnded: {
                this.clearAnnounceTimer()
                this.setState({
                    ...state,
                    phase: RoomPhase.Ended,
                    countdown: null,
                    game: {
                        ...message.game,
                        winnerId: message.winnerId,
                        progress: message.progress,
                        fakeBingoPlayerId: null
                    }
                })
                break
            }
            case DataChannelMessageType.ClaimBingo: {
                if (!this.isLeader) break
                this.resolveClaimBingo(message.playerId)
                break
            }
            default:
                break
        }
    }

    private broadcastSync(): void {
        const state = this.state
        if (!state || !this.isLeader) return

        const message: ISyncMessage = {
            type: DataChannelMessageType.Sync,
            code: state.code,
            name: state.name,
            players: state.players,
            phase: state.phase,
            countdown: state.countdown,
            game: state.game
        }

        this.broadcast(message)
    }

    private broadcastGameSnapshot(): void {
        const state = this.state
        if (!state?.game || !this.isLeader) return

        this.broadcast({
            type: DataChannelMessageType.GameSnapshot,
            phase: state.phase,
            game: state.game
        })
    }

    private broadcast(message: IDataChannelMessage): void {
        const payload = JSON.stringify(message)

        for (const link of this.peers.values()) {
            if (link.channel && link.channel.readyState === "open") {
                link.channel.send(payload)
            }
        }
    }

    private async beginCountdown(): Promise<void> {
        this.clearCountdownTimer()
        this.clearAnnounceTimer()

        try {
            let value: number = COUNTDOWN_START
            while (value >= 1) {
                if (!this.state) return

                this.setState(this.applyCountdown(this.state, value))
                this.broadcast({ type: DataChannelMessageType.Countdown, value })

                await new Promise<void>(resolve => {
                    this.countdownTimer = setTimeout(() => {
                        this.countdownTimer = null
                        resolve()
                    }, COUNTDOWN_TICK_MS)
                })

                value -= 1
            }

            if (!this.state || !this.isLeader) return
            this.beginPlayingRound()
        } catch {
            // Session may have disconnected mid-countdown.
        }
    }

    private beginPlayingRound(): void {
        const state = this.requireState()
        const game = this.createDealtGame(state.players.map(player => player.id))
        const next: IRoomState = {
            ...this.applyPlaying(state),
            game
        }

        this.setState(next)
        this.broadcast({ type: DataChannelMessageType.Playing })
        this.broadcastGameSnapshot()
        this.startAnnounceLoop(true)
    }

    private createDealtGame(playerIds: string[]): IGameState {
        return {
            callOrder: shuffleCallOrder(BREED_IDS),
            announced: [],
            currentBreedId: null,
            announceIntervalMs: ANNOUNCE_INTERVAL_MS,
            announceStartedAt: null,
            boards: dealAllBoards(playerIds, BREED_IDS),
            winnerId: null,
            fakeBingoPlayerId: null,
            progress: null
        }
    }

    private startAnnounceLoop(immediate: boolean): void {
        this.clearAnnounceTimer()
        if (!this.isLeader) return

        if (immediate) {
            this.announceNextBreed()
        }

        this.scheduleNextAnnounce()
    }

    private resumeAnnounceLoop(): void {
        this.clearAnnounceTimer()
        if (!this.isLeader) return

        const state = this.state
        if (!state?.game || state.phase !== RoomPhase.Playing) return

        if (state.game.currentBreedId === null && state.game.callOrder.length > 0) {
            this.startAnnounceLoop(true)
            return
        }

        this.scheduleNextAnnounce()
    }

    private scheduleNextAnnounce(): void {
        this.clearAnnounceTimer()
        if (!this.isLeader) return

        const state = this.state
        if (!state?.game || state.phase !== RoomPhase.Playing) return
        if (state.game.callOrder.length === 0) return

        const interval = state.game.announceIntervalMs
        const startedAt = state.game.announceStartedAt
        const delay =
            startedAt === null ? interval : Math.max(0, startedAt + interval - Date.now())

        this.announceTimer = setTimeout(() => {
            this.announceTimer = null
            this.announceNextBreed()
            this.scheduleNextAnnounce()
        }, delay)
    }

    private announceNextBreed(): void {
        const state = this.state
        if (!state?.game || state.phase !== RoomPhase.Playing || !this.isLeader) return
        if (state.game.callOrder.length === 0) {
            this.clearAnnounceTimer()
            return
        }

        const [nextBreedId, ...remaining] = state.game.callOrder
        if (!nextBreedId) return

        const announceStartedAt = Date.now()
        const announced = [...state.game.announced, nextBreedId]
        const game: IGameState = {
            ...state.game,
            callOrder: remaining,
            announced,
            currentBreedId: nextBreedId,
            announceStartedAt,
            fakeBingoPlayerId: null
        }

        this.setState({ ...state, game })
        this.broadcast({
            type: DataChannelMessageType.BreedAnnounced,
            breedId: nextBreedId,
            announced,
            callOrder: remaining,
            announceStartedAt
        })
    }

    private requestClaimBingo(): void {
        const state = this.requireState()
        const localPlayerId = this.localPeerId
        if (!localPlayerId) return
        if (state.phase !== RoomPhase.Playing || !state.game) return

        if (this.isLeader) {
            this.resolveClaimBingo(localPlayerId)
            return
        }

        this.broadcast({
            type: DataChannelMessageType.ClaimBingo,
            playerId: localPlayerId
        })
    }

    private resolveClaimBingo(playerId: string): void {
        const state = this.state
        if (!state?.game || state.phase !== RoomPhase.Playing || !this.isLeader) return

        const game = state.game
        if (!(playerId in game.boards)) return
        const board = game.boards[playerId]

        if (!isLegitimateBingo(board, game.announced)) {
            const nextGame: IGameState = {
                ...game,
                fakeBingoPlayerId: playerId
            }
            this.setState({ ...state, game: nextGame })
            this.broadcast({
                type: DataChannelMessageType.FakeBingo,
                playerId
            })
            return
        }

        this.clearAnnounceTimer()

        const progress: IPlayerProgress[] = state.players.map(player => {
            const playerBoard = Object.hasOwn(game.boards, player.id) ? game.boards[player.id] : null
            const line =
                playerBoard === null
                    ? { kind: "row" as const, index: 0, filled: 0, total: 5 as const }
                    : bestLineProgress(playerBoard, game.announced)

            return {
                playerId: player.id,
                nickname: player.nickname,
                ...line
            }
        })

        progress.sort((left, right) => right.filled - left.filled)

        const endedGame: IGameState = {
            ...game,
            winnerId: playerId,
            fakeBingoPlayerId: null,
            progress
        }

        this.setState({
            ...state,
            phase: RoomPhase.Ended,
            countdown: null,
            game: endedGame
        })

        this.broadcast({
            type: DataChannelMessageType.GameEnded,
            winnerId: playerId,
            progress,
            game: endedGame
        })
    }

    private async restartGame(): Promise<void> {
        const state = this.requireState()
        if (!this.isLeader || state.phase !== RoomPhase.Ended) return

        this.clearAnnounceTimer()

        try {
            if (this.sessionUsedTurn) {
                this.iceServers = await this.fetchIceServers()
                await this.restartIceOnPeers()
            }

            const latest = this.requireState()
            const game = this.createDealtGame(latest.players.map(player => player.id))
            this.setState({
                ...latest,
                phase: RoomPhase.Playing,
                countdown: null,
                game
            })
            this.broadcastGameSnapshot()
            this.startAnnounceLoop(true)
        } catch {
            // Session may disconnect while reminting TURN / restarting ICE.
        }
    }

    private async restartIceOnPeers(): Promise<void> {
        for (const link of this.peers.values()) {
            try {
                link.connection.setConfiguration({ iceServers: this.iceServers })
                const offer = await link.connection.createOffer({ iceRestart: true })
                await link.connection.setLocalDescription(offer)
                this.sendSignaling({
                    type: SignalingClientMessageType.Signal,
                    to: link.peerId,
                    payload: {
                        kind: WebRtcSignalKind.Offer,
                        sdp: offer
                    }
                })
            } catch {
                // Peer may have disconnected during restart.
            }
        }
    }

    private sendSignaling(message: ISignalingClientMessage): void {
        if (!this.signalingSocket || this.signalingSocket.readyState !== WebSocket.OPEN) return
        this.signalingSocket.send(JSON.stringify(message))
    }

    private closeSignalingSocket(): void {
        if (!this.signalingSocket) return

        try {
            this.signalingSocket.close()
        } catch {
            // Ignore.
        }

        this.signalingSocket = null
    }

    private teardownPeer(peerId: string): void {
        const link = this.peers.get(peerId)
        if (!link) return

        try {
            link.channel?.close()
        } catch {
            // Ignore.
        }

        try {
            link.connection.close()
        } catch {
            // Ignore.
        }

        this.peers.delete(peerId)
    }

    private closeAllPeers(): void {
        for (const peerId of [...this.peers.keys()]) {
            this.teardownPeer(peerId)
        }
    }

    private clearCountdownTimer(): void {
        if (!this.countdownTimer) return
        clearTimeout(this.countdownTimer)
        this.countdownTimer = null
    }

    private clearAnnounceTimer(): void {
        if (!this.announceTimer) return
        clearTimeout(this.announceTimer)
        this.announceTimer = null
    }
}
