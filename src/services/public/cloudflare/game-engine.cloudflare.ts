import type { IGameState, IPlayerProgress } from "#/@types/game"
import type { IConnectInput, IGameEngineMessage, IRoomState } from "#/@types/room"
import { ConnectRole, GameEngineMessageType, RoomPhase } from "#/@types/room"
import type {
    IDataChannelMessage,
    IIceServersResponse,
    ISignalingClientMessage,
    ISignalingServerMessage,
    ISyncMessage,
    IWebRtcSignalPayload
} from "#/@types/signaling"
import {
    DataChannelMessageType,
    IceTransportPath,
    SignalingClientMessageType,
    SignalingServerMessageType,
    WebRtcSignalKind
} from "#/@types/signaling"
import { ANNOUNCE_INTERVAL_MS } from "#/constants/announce"
import { BREED_IDS } from "#/constants/breeds"
import { COUNTDOWN_START, COUNTDOWN_TICK_MS } from "#/constants/countdown"
import { bestBingoProgress, dealAllBoards, shuffleCallOrder } from "#/services/base/utils/bingo"
import { findSoleRemainingPlayerId, resolveBingoClaim } from "#/services/base/utils/bingo-claim"
import { ensurePlayerWins, recordWin } from "#/services/base/utils/leaderboard"
import { canUpdateRoomSettings, createDefaultRoomSettings } from "#/services/base/utils/room-settings"
import BaseWebRtcService from "#/services/base/webrtc"
import type IGameEngineGateway from "../IGameEngineGateway"
import type { IRoomStateListener } from "../IGameEngineGateway"
import type { IRoomSession } from "./room-session"
import {
    clearRoomSession,
    loadRoomSession,
    PEER_LEAVE_GRACE_MS,
    saveRoomSession,
    SIGNALING_CONNECT_TIMEOUT_MS,
    SIGNALING_RECONNECT_DELAY_MS
} from "./room-session"

interface IPeerLink {
    peerId: string
    connection: RTCPeerConnection
    channel: RTCDataChannel | null
    /** ICE candidates that arrived before `setRemoteDescription` finished. */
    pendingIceCandidates: RTCIceCandidateInit[]
    hasRemoteDescription: boolean
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
    /** Serializes WebRTC signal handling so trickle ICE cannot race ahead of SDP. */
    private signalChain: Promise<void> = Promise.resolve()
    /** Trickle ICE that arrived before the peer link / remote description existed. */
    private pendingIceByPeer = new Map<string, RTCIceCandidateInit[]>()
    /** True while the user explicitly left (or we are tearing down before a fresh connect). */
    private suppressAutoReconnect = false
    private lifecycleBound = false
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private restorePromise: Promise<IRoomState | null> | null = null
    /** peerId → grace deadline for roster removal after peer-left / RTC drop. */
    private pendingPeerLeaves = new Map<string, { deadline: number; timer: ReturnType<typeof setTimeout> }>()
    /** >0 while intentionally tearing down RTC so close events do not start leave grace. */
    private suppressPeerLeaveGrace = 0

    public async connect(input: IConnectInput): Promise<IRoomState> {
        this.suppressAutoReconnect = true
        this.clearReconnectTimer()
        await this.teardownConnection({ clearSession: true, sendLeave: true })

        const nickname = input.nickname.trim().slice(0, 24)
        if (!nickname) {
            this.suppressAutoReconnect = false
            throw new Error("Nickname is required")
        }

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
                game: null,
                settings: createDefaultRoomSettings(),
                abandoned: false,
                pendingLeavePeerIds: [],
                wins: { [this.localPeerId]: 0 }
            }
            this.emit()

            await this.openSignalingSocket(roomCode, nickname, signal)
            this.persistCurrentSession()
            this.ensureLifecycleListeners()
            return this.requireState()
        } catch (error) {
            await this.teardownConnection({ clearSession: true, sendLeave: false })
            throw error
        } finally {
            this.suppressAutoReconnect = false
        }
    }

    public async restoreSession(): Promise<IRoomState | null> {
        if (this.isSignalingOpen() && this.state) return this.state
        if (this.restorePromise) return this.restorePromise

        const session = loadRoomSession()
        if (!session) return null

        this.restorePromise = this.reconnectWithSession(session)
            .then(state => state)
            .catch(() => null)
            .finally(() => {
                this.restorePromise = null
                // Transient restore failures must not wipe localStorage — retry while the session remains.
                if (!this.state && loadRoomSession() && !this.suppressAutoReconnect) {
                    this.scheduleReconnect()
                }
            })

        return this.restorePromise
    }

    public async disconnect(): Promise<void> {
        this.suppressAutoReconnect = true
        this.clearReconnectTimer()
        try {
            await this.teardownConnection({ clearSession: true, sendLeave: true })
        } finally {
            this.suppressAutoReconnect = false
        }
    }

    /**
     * Drops in-memory connections without leaving the room or clearing localStorage.
     * Models process death / full page reload so a later `restoreSession` can rejoin.
     */
    public dispose(): void {
        this.suppressAutoReconnect = true
        this.clearReconnectTimer()
        this.unbindLifecycleListeners()
        void this.teardownConnection({ clearSession: false, sendLeave: false })
        this.listeners.clear()
    }

    public send(message: IGameEngineMessage): void {
        if (message.type === GameEngineMessageType.StartGame) {
            if (!this.canStartGame()) {
                throw new Error("Need at least two players to start")
            }
            void this.beginCountdown()
            return
        }

        if (message.type === GameEngineMessageType.ClaimBingo) {
            this.requestClaimBingo()
            return
        }

        if (message.type === GameEngineMessageType.UpdateSettings) {
            this.updateRoomSettings(message.settings)
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
        this.sweepExpiredPeerLeaves()

        const state = this.state
        if (!state) return false
        return this.evaluateCanStartGame(state)
    }

    public isValidRoomCode(code: string): boolean {
        return super.isValidRoomCode(code)
    }

    private async reconnectWithSession(session: IRoomSession): Promise<IRoomState> {
        this.clearReconnectTimer()
        this.suppressAutoReconnect = true
        this.clearAllPendingPeerLeaves()
        this.clearCountdownTimer()
        this.clearAnnounceTimer()
        this.connectAbort?.abort()
        this.connectAbort = null
        this.closeSignalingSocket()
        this.closeAllPeers()
        this.sessionUsedTurn = false
        this.signalChain = Promise.resolve()
        this.pendingIceByPeer.clear()

        this.connectAbort = new AbortController()
        const { signal } = this.connectAbort
        const previous = this.state

        try {
            this.iceServers = await this.fetchIceServers(signal)
            this.localPeerId = session.peerId
            // Always rejoin as joiner; the Durable Object promotes when no leader remains.
            this.isLeader = false

            const roomCode = this.normalizeRoomCode(session.roomCode)
            if (!this.isValidRoomCode(roomCode)) throw new Error("Invalid room code")

            const existing = await this.fetchRoom(roomCode, signal)

            const players = previous?.players.length
                ? previous.players.map(player =>
                      player.id === session.peerId ? { ...player, nickname: session.nickname } : player
                  )
                : [
                      {
                          id: this.localPeerId,
                          nickname: session.nickname,
                          isLeader: this.isLeader
                      }
                  ]

            this.state = {
                code: roomCode,
                name: existing.name,
                players,
                phase: previous?.phase ?? RoomPhase.Lobby,
                countdown: previous?.countdown ?? null,
                localPlayerId: this.localPeerId,
                game: previous?.game ?? null,
                settings: previous?.settings ?? createDefaultRoomSettings(),
                abandoned: previous?.abandoned ?? false,
                pendingLeavePeerIds: [],
                wins: ensurePlayerWins(
                    previous?.wins ?? {},
                    players.map(player => player.id)
                )
            }
            this.emit()

            await this.openSignalingSocket(roomCode, session.nickname, signal)
            this.persistCurrentSession()
            this.ensureLifecycleListeners()
            return this.requireState()
        } catch (error) {
            // Only drop the persisted session when the room is confirmed gone / corrupt.
            // Transient signaling failures must survive reload and app switches.
            await this.teardownConnection({
                clearSession: this.isRoomGoneError(error),
                sendLeave: false
            })
            throw error
        } finally {
            this.suppressAutoReconnect = false
        }
    }

    private isRoomGoneError(error: unknown): boolean {
        if (!(error instanceof Error)) return false
        return /invalid room code|room not found/i.test(error.message)
    }

    private async teardownConnection(options: { clearSession: boolean; sendLeave: boolean }): Promise<void> {
        this.clearReconnectTimer()
        this.clearAllPendingPeerLeaves()
        this.clearCountdownTimer()
        this.clearAnnounceTimer()
        this.connectAbort?.abort()
        this.connectAbort = null

        if (options.sendLeave && this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
            this.sendSignaling({ type: SignalingClientMessageType.Leave })
        }

        this.closeSignalingSocket()
        this.closeAllPeers()

        this.state = null
        this.localPeerId = null
        this.isLeader = false
        this.sessionUsedTurn = false
        this.iceServers = []
        this.signalChain = Promise.resolve()
        this.pendingIceByPeer.clear()

        if (options.clearSession) clearRoomSession()

        this.emit()
    }

    private persistCurrentSession(): void {
        const state = this.state
        const peerId = this.localPeerId
        if (!state || !peerId) return

        const local = state.players.find(player => player.id === peerId)
        const nickname = local?.nickname
        if (!nickname) return

        saveRoomSession({
            roomCode: state.code,
            nickname,
            peerId
        })
    }

    private isSignalingOpen(): boolean {
        return Boolean(this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN)
    }

    private scheduleReconnect(): void {
        if (this.suppressAutoReconnect || this.reconnectTimer || this.restorePromise) return
        if (!loadRoomSession()) return

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            void this.ensureSignalingConnected()
        }, SIGNALING_RECONNECT_DELAY_MS)
    }

    private clearReconnectTimer(): void {
        if (!this.reconnectTimer) return
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
    }

    private async ensureSignalingConnected(): Promise<void> {
        if (this.suppressAutoReconnect) return
        if (this.isSignalingOpen() && this.state) return

        const session = loadRoomSession()
        if (!session) return

        try {
            await this.restoreSession()
        } catch {
            // restoreSession already clears invalid sessions.
        }
    }

    private ensureLifecycleListeners(): void {
        if (this.lifecycleBound || typeof window === "undefined") return

        this.lifecycleBound = true
        document.addEventListener("visibilitychange", this.handleVisibilityChange)
        window.addEventListener("online", this.handleOnline)
        window.addEventListener("pagehide", this.handlePageHide)
    }

    private unbindLifecycleListeners(): void {
        if (!this.lifecycleBound || typeof window === "undefined") return

        this.lifecycleBound = false
        document.removeEventListener("visibilitychange", this.handleVisibilityChange)
        window.removeEventListener("online", this.handleOnline)
        window.removeEventListener("pagehide", this.handlePageHide)
    }

    private handleVisibilityChange = (): void => {
        if (document.visibilityState === "visible") {
            this.sweepExpiredPeerLeaves()
            void this.ensureSignalingConnected()
        }
    }

    private handleOnline = (): void => {
        void this.ensureSignalingConnected()
    }

    /**
     * Persist the session on unload / mobile backgrounding. Never send leave here —
     * the player should rejoin the same room after reload or app switch.
     */
    private handlePageHide = (): void => {
        this.persistCurrentSession()
    }

    private requireState(): IRoomState {
        if (!this.state) throw new Error("Not connected")
        return this.state
    }

    private setState(next: IRoomState): void {
        this.state = {
            ...next,
            pendingLeavePeerIds: [...this.pendingPeerLeaves.keys()]
        }
        this.emit()
    }

    /**
     * Publishes the current leave-grace set onto room state so lobby UI stays reactive.
     */
    private publishPendingLeaves(): void {
        if (!this.state) {
            this.emit()
            return
        }
        this.setState(this.state)
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
            let settled = false
            let timeoutId: ReturnType<typeof setTimeout> | null = null

            const settle = (action: () => void) => {
                if (settled) return
                settled = true
                cleanup()
                action()
            }

            const onAbort = () => {
                settle(() => {
                    try {
                        socket.close()
                    } catch {
                        // Ignore.
                    }
                    reject(new Error("Connection aborted"))
                })
            }

            const onTimeout = () => {
                settle(() => {
                    try {
                        socket.close()
                    } catch {
                        // Ignore.
                    }
                    reject(new Error("Connection timed out"))
                })
            }

            const cleanup = () => {
                signal.removeEventListener("abort", onAbort)
                socket.removeEventListener("open", onOpen)
                socket.removeEventListener("error", onError)
                if (timeoutId !== null) {
                    clearTimeout(timeoutId)
                    timeoutId = null
                }
            }

            timeoutId = setTimeout(onTimeout, SIGNALING_CONNECT_TIMEOUT_MS)

            const onError = () => {
                settle(() => {
                    reject(new Error("Connection failed"))
                })
            }

            const onOpen = () => {
                if (!this.localPeerId) {
                    settle(() => {
                        reject(new Error("Missing local peer id"))
                    })
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
            if (signal.aborted) {
                onAbort()
                return
            }

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
                    settle(() => {
                        this.handleJoined(message)
                        resolve()
                    })
                    return
                }

                if (message.type === SignalingServerMessageType.Error) {
                    settle(() => {
                        reject(new Error(message.message || "Connection failed"))
                    })
                    return
                }

                this.handleSignalingMessage(message)
            })

            socket.addEventListener("close", () => {
                if (this.signalingSocket === socket) this.signalingSocket = null

                // Handshake died before joined/error — fail the connect instead of hanging forever.
                if (!settled) {
                    settle(() => {
                        reject(new Error("Connection closed"))
                    })
                    return
                }

                if (!this.suppressAutoReconnect && loadRoomSession()) {
                    this.scheduleReconnect()
                }
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

        const local = players.find(peer => peer.id === this.localPeerId)
        this.isLeader = Boolean(local?.isLeader)

        this.setState({
            ...state,
            code: message.roomCode,
            name: message.roomName,
            players,
            localPlayerId: this.localPeerId ?? state.localPlayerId,
            wins: ensurePlayerWins(
                state.wins,
                players.map(player => player.id)
            )
        })
        this.persistCurrentSession()

        if (this.isLeader) {
            for (const peer of players) {
                if (peer.id === this.localPeerId) continue
                this.withSuppressedPeerLeaveGrace(() => {
                    this.teardownPeer(peer.id)
                })
                void this.connectToJoiner(peer.id).catch(() => {
                    // Peer may disconnect while the offer is being prepared.
                })
            }
        }
    }

    private handleSignalingMessage(message: ISignalingServerMessage): void {
        switch (message.type) {
            case SignalingServerMessageType.PeerJoined: {
                this.cancelPendingPeerLeave(message.peer.id)

                const state = this.requireState()
                this.setState(this.upsertPlayer(state, message.peer))

                if (this.isLeader && message.peer.id !== this.localPeerId) {
                    this.withSuppressedPeerLeaveGrace(() => {
                        this.teardownPeer(message.peer.id)
                    })
                    void this.connectToJoiner(message.peer.id).catch(() => {
                        // Peer may disconnect while the offer is being prepared.
                    })
                }
                break
            }
            case SignalingServerMessageType.PeerLeft: {
                this.handlePeerLeft(message.peerId, message.newLeaderId, message.intentional)
                break
            }
            case SignalingServerMessageType.Signal: {
                this.enqueueWebRtcSignal(message.from, message.payload)
                break
            }
            default:
                break
        }
    }

    private handlePeerLeft(peerId: string, newLeaderId: string | null, intentional = false): void {
        this.withSuppressedPeerLeaveGrace(() => {
            this.teardownPeer(peerId)
        })
        if (!this.state) return

        let next = this.state
        const becameLeader = Boolean(newLeaderId && newLeaderId === this.localPeerId && !this.isLeader)

        if (newLeaderId) {
            next = this.applyLeader(next, newLeaderId)
            this.isLeader = this.localPeerId === newLeaderId
            this.setState(next)
        }

        if (!this.isLeader) {
            this.clearAnnounceTimer()
        }

        if (becameLeader) {
            this.withSuppressedPeerLeaveGrace(() => {
                this.closeAllPeers()
            })
            for (const player of next.players) {
                if (player.id === this.localPeerId) continue
                if (player.id === peerId) continue
                void this.connectToJoiner(player.id).catch(() => {
                    // Peer may disconnect while the offer is being prepared.
                })
            }
            this.resumeAnnounceLoop()
        }

        if (intentional) {
            this.cancelPendingPeerLeave(peerId)
            this.finalizePeerLeft(peerId)
            return
        }

        this.schedulePeerLeaveGrace(peerId)
    }

    /**
     * Marks a peer as leaving; removes them from the roster once the grace deadline passes.
     * Uses both a timer and a deadline so background-tab timer throttling cannot leave phantoms.
     */
    private schedulePeerLeaveGrace(peerId: string): void {
        if (!peerId || peerId === this.localPeerId) return
        if (!this.state?.players.some(player => player.id === peerId)) return

        this.cancelPendingPeerLeave(peerId)

        const deadline = Date.now() + PEER_LEAVE_GRACE_MS
        const timer = setTimeout(() => {
            this.sweepExpiredPeerLeaves()
        }, PEER_LEAVE_GRACE_MS)

        this.pendingPeerLeaves.set(peerId, { deadline, timer })
        // Notify subscribers so lobby start eligibility updates while the phantom is still listed.
        this.publishPendingLeaves()
    }

    private sweepExpiredPeerLeaves(): void {
        if (this.pendingPeerLeaves.size === 0) return

        const now = Date.now()
        const expired: string[] = []

        for (const [peerId, entry] of this.pendingPeerLeaves) {
            if (now >= entry.deadline) expired.push(peerId)
        }

        for (const peerId of expired) {
            const entry = this.pendingPeerLeaves.get(peerId)
            if (entry) clearTimeout(entry.timer)
            this.pendingPeerLeaves.delete(peerId)
            this.finalizePeerLeft(peerId)
        }
    }

    private finalizePeerLeft(peerId: string): void {
        if (!this.state) return
        if (!this.state.players.some(player => player.id === peerId)) {
            this.publishPendingLeaves()
            return
        }

        const next = this.removePlayer(this.state, peerId)

        if (this.shouldAbandonGame(next)) {
            this.clearCountdownTimer()
            this.clearAnnounceTimer()
            this.setState(this.applyAbandoned(next))
            return
        }

        this.setState(next)
        if (this.isLeader) this.broadcastSync()
    }

    private cancelPendingPeerLeave(peerId: string): void {
        const entry = this.pendingPeerLeaves.get(peerId)
        if (!entry) return
        clearTimeout(entry.timer)
        this.pendingPeerLeaves.delete(peerId)
        this.publishPendingLeaves()
    }

    private clearAllPendingPeerLeaves(): void {
        for (const entry of this.pendingPeerLeaves.values()) {
            clearTimeout(entry.timer)
        }
        this.pendingPeerLeaves.clear()
    }

    private withSuppressedPeerLeaveGrace(run: () => void): void {
        this.suppressPeerLeaveGrace += 1
        try {
            run()
        } finally {
            this.suppressPeerLeaveGrace -= 1
        }
    }

    private async connectToJoiner(peerId: string): Promise<void> {
        if (this.peers.has(peerId)) return

        const connection = this.createPeerConnection(peerId)
        const channel = connection.createDataChannel("bindog", { ordered: true })
        this.attachDataChannel(peerId, channel)

        const link: IPeerLink = {
            peerId,
            connection,
            channel,
            pendingIceCandidates: this.takePendingIceCandidates(peerId),
            hasRemoteDescription: false
        }
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

    /**
     * Queues inbound WebRTC signals so offer/answer apply before trickle ICE.
     * Across NATs, ICE candidates often arrive immediately after the SDP message;
     * handling them concurrently drops candidates and leaves peers invisible.
     */
    private enqueueWebRtcSignal(from: string, payload: IWebRtcSignalPayload): void {
        this.signalChain = this.signalChain
            .then(() => this.handleWebRtcSignal(from, payload))
            .catch(() => {
                // Peer may disconnect mid-handshake; keep the queue alive.
            })
    }

    private async handleWebRtcSignal(from: string, payload: IWebRtcSignalPayload): Promise<void> {
        if (payload.kind === WebRtcSignalKind.Offer) {
            let link = this.peers.get(from)
            if (!link) {
                const connection = this.createPeerConnection(from)
                link = {
                    peerId: from,
                    connection,
                    channel: null,
                    pendingIceCandidates: this.takePendingIceCandidates(from),
                    hasRemoteDescription: false
                }
                this.peers.set(from, link)

                connection.addEventListener("datachannel", event => {
                    this.attachDataChannel(from, event.channel)
                })
            } else {
                link.pendingIceCandidates.push(...this.takePendingIceCandidates(from))
            }

            await link.connection.setRemoteDescription(payload.sdp)
            link.hasRemoteDescription = true
            await this.flushPendingIceCandidates(link)

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
            link.hasRemoteDescription = true
            await this.flushPendingIceCandidates(link)
            return
        }

        const link = this.peers.get(from)
        if (!link) {
            const pending = this.pendingIceByPeer.get(from) ?? []
            pending.push(payload.candidate)
            this.pendingIceByPeer.set(from, pending)
            return
        }

        if (!link.hasRemoteDescription) {
            link.pendingIceCandidates.push(payload.candidate)
            return
        }

        try {
            await link.connection.addIceCandidate(payload.candidate)
        } catch {
            // Ignore stale candidates after a restart or teardown.
        }
    }

    private takePendingIceCandidates(peerId: string): RTCIceCandidateInit[] {
        const pending = this.pendingIceByPeer.get(peerId) ?? []
        this.pendingIceByPeer.delete(peerId)
        return pending
    }

    private async flushPendingIceCandidates(link: IPeerLink): Promise<void> {
        const pending = link.pendingIceCandidates
        link.pendingIceCandidates = []

        for (const candidate of pending) {
            try {
                await link.connection.addIceCandidate(candidate)
            } catch {
                // Candidate may be stale after an ICE restart.
            }
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
                if (!this.peers.has(peerId)) return

                const allowLeaveGrace = this.suppressPeerLeaveGrace === 0
                this.teardownPeer(peerId)

                // Signaling peer-left can be missed after a brief reconnect; RTC death still drops phantoms.
                if (allowLeaveGrace) {
                    this.schedulePeerLeaveGrace(peerId)
                }
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
                    game: message.game,
                    wins: message.wins,
                    settings: message.settings
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
                        fakeBingoPlayerId: null,
                        disqualifiedPlayerId: null
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
                        fakeBingoPlayerId: message.playerId,
                        incorrectBindogCounts: message.incorrectBindogCounts,
                        disqualifiedPlayerId: null
                    }
                })
                break
            }
            case DataChannelMessageType.PlayerDisqualified: {
                if (!state.game) break
                this.setState({
                    ...state,
                    game: {
                        ...state.game,
                        fakeBingoPlayerId: null,
                        disqualifiedPlayerId: message.playerId,
                        incorrectBindogCounts: message.incorrectBindogCounts,
                        disqualifiedPlayerIds: message.disqualifiedPlayerIds
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
                    },
                    wins: message.wins
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
            game: state.game,
            wins: state.wins,
            settings: state.settings
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
            incorrectBindogCounts: {},
            disqualifiedPlayerIds: [],
            disqualifiedPlayerId: null,
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
        const delay = startedAt === null ? interval : Math.max(0, startedAt + interval - Date.now())

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
            fakeBingoPlayerId: null,
            disqualifiedPlayerId: null
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
        const settings = state.settings
        const resolution = resolveBingoClaim({
            board: Object.hasOwn(game.boards, playerId) ? game.boards[playerId] : undefined,
            announced: game.announced,
            playerId,
            fullGridBingo: settings.fullGridBingo,
            limitIncorrectBindogs: settings.limitIncorrectBindogs,
            incorrectBindogCounts: game.incorrectBindogCounts,
            disqualifiedPlayerIds: game.disqualifiedPlayerIds
        })

        if (resolution.outcome === "ignored") return

        if (resolution.outcome === "fake") {
            const nextGame: IGameState = {
                ...game,
                fakeBingoPlayerId: playerId,
                disqualifiedPlayerId: null,
                incorrectBindogCounts: resolution.incorrectBindogCounts,
                disqualifiedPlayerIds: resolution.disqualifiedPlayerIds
            }
            this.setState({ ...state, game: nextGame })
            this.broadcast({
                type: DataChannelMessageType.FakeBingo,
                playerId,
                incorrectBindogCounts: resolution.incorrectBindogCounts
            })
            return
        }

        if (resolution.outcome === "disqualified") {
            const nextGame: IGameState = {
                ...game,
                fakeBingoPlayerId: null,
                disqualifiedPlayerId: playerId,
                incorrectBindogCounts: resolution.incorrectBindogCounts,
                disqualifiedPlayerIds: resolution.disqualifiedPlayerIds
            }
            this.setState({ ...state, game: nextGame })
            this.broadcast({
                type: DataChannelMessageType.PlayerDisqualified,
                playerId,
                incorrectBindogCounts: resolution.incorrectBindogCounts,
                disqualifiedPlayerIds: resolution.disqualifiedPlayerIds
            })

            const remainingPlayerId = findSoleRemainingPlayerId(
                Object.keys(nextGame.boards),
                nextGame.disqualifiedPlayerIds
            )
            if (remainingPlayerId) {
                this.endPlayingRound(remainingPlayerId)
            }
            return
        }

        this.endPlayingRound(playerId)
    }

    private endPlayingRound(winnerId: string): void {
        const state = this.state
        if (!state?.game || state.phase !== RoomPhase.Playing || !this.isLeader) return

        const game = state.game
        const settings = state.settings

        this.clearAnnounceTimer()

        const progress: IPlayerProgress[] = state.players.map(player => {
            const playerBoard = Object.hasOwn(game.boards, player.id) ? game.boards[player.id] : null
            const line =
                playerBoard === null
                    ? {
                          kind: settings.fullGridBingo ? ("grid" as const) : ("row" as const),
                          index: 0,
                          filled: 0,
                          total: settings.fullGridBingo ? 25 : 5
                      }
                    : bestBingoProgress(playerBoard, game.announced, settings.fullGridBingo)

            return {
                playerId: player.id,
                nickname: player.nickname,
                ...line
            }
        })

        progress.sort((left, right) => right.filled - left.filled)

        const endedGame: IGameState = {
            ...game,
            winnerId,
            fakeBingoPlayerId: null,
            disqualifiedPlayerId: game.disqualifiedPlayerId,
            progress
        }

        const wins = recordWin(state.wins, winnerId)

        this.setState({
            ...state,
            phase: RoomPhase.Ended,
            countdown: null,
            game: endedGame,
            wins
        })

        this.broadcast({
            type: DataChannelMessageType.GameEnded,
            winnerId,
            progress,
            game: endedGame,
            wins
        })
    }

    private updateRoomSettings(settings: IRoomState["settings"]): void {
        const state = this.state
        if (!state || !canUpdateRoomSettings(this.isLeader, state.phase)) return

        this.setState({
            ...state,
            settings
        })
        this.broadcastSync()
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
                abandoned: false,
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
        this.pendingIceByPeer.delete(peerId)
        const link = this.peers.get(peerId)
        if (!link) return

        // Remove first so connectionstatechange from close() cannot re-enter.
        this.peers.delete(peerId)

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
    }

    private closeAllPeers(): void {
        this.withSuppressedPeerLeaveGrace(() => {
            for (const peerId of [...this.peers.keys()]) {
                this.teardownPeer(peerId)
            }
        })
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
