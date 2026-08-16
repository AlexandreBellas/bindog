import type { IBingoBoard, IGameState, IPlayerProgress, IProgressLineKind } from "#/@types/game"
import { progressLineKinds } from "#/@types/game"
import type { IRoomPhase, IRoomPlayer, IRoomState } from "#/@types/room"
import { RoomPhase, roomPhases } from "#/@types/room"
import { ensurePlayerWins } from "#/services/base/utils/leaderboard"
import type {
    IDataChannelMessage,
    IIceTransportPath,
    ISignalingServerMessage,
    IWebRtcSignalPayload
} from "#/@types/signaling"
import { DataChannelMessageType, SignalingServerMessageType, WebRtcSignalKind } from "#/@types/signaling"
import { ROOM_CODE_PATTERN } from "#/constants/room-code"

/**
 * Shared WebRTC / signaling helpers for concrete game-engine providers.
 */
export default abstract class BaseWebRtcService {
    /**
     * Creates a stable peer id for the current browser session.
     */
    protected createPeerId(): string {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID()
        }

        return `peer-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
    }

    /**
     * Normalizes a typed invite code for validation and Worker lookup.
     */
    protected normalizeRoomCode(code: string): string {
        return code
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
    }

    /**
     * Returns whether a normalized invite code looks valid.
     */
    protected isValidRoomCode(code: string): boolean {
        return ROOM_CODE_PATTERN.test(this.normalizeRoomCode(code))
    }

    /**
     * Builds the HTTP base URL for the signaling Worker.
     */
    protected getSignalingHttpUrl(): string {
        const configured = import.meta.env.VITE_SIGNALING_URL

        if (typeof configured !== "string" || configured.trim().length === 0) {
            throw new Error("VITE_SIGNALING_URL is not configured")
        }

        return configured.replace(/\/$/, "")
    }

    /**
     * Builds the WebSocket URL for a room on the signaling Worker.
     */
    protected getSignalingWsUrl(roomCode: string): string {
        const httpUrl = this.getSignalingHttpUrl()
        const wsBase = httpUrl.replace(/^http/i, "ws")
        return `${wsBase}/rooms/${encodeURIComponent(roomCode)}`
    }

    /**
     * Returns whether the local player may start the game from lobby state.
     * Peers listed in `pendingLeavePeerIds` do not count toward the minimum.
     */
    protected evaluateCanStartGame(state: IRoomState): boolean {
        if (state.phase !== RoomPhase.Lobby) return false

        const pendingLeaves = new Set(state.pendingLeavePeerIds ?? [])
        const activePlayers = state.players.filter(player => !pendingLeaves.has(player.id))
        if (activePlayers.length < 2) return false

        const local = activePlayers.find(player => player.id === state.localPlayerId)
        return Boolean(local?.isLeader)
    }

    /**
     * Builds the next lobby state after a player joins.
     */
    protected upsertPlayer(state: IRoomState, player: IRoomPlayer): IRoomState {
        const without = state.players.filter(item => item.id !== player.id)
        const players = [...without, player]
        return {
            ...state,
            players,
            wins: ensurePlayerWins(
                state.wins,
                players.map(item => item.id)
            )
        }
    }

    /**
     * Builds the next lobby state after a player leaves.
     */
    protected removePlayer(state: IRoomState, peerId: string): IRoomState {
        return {
            ...state,
            players: state.players.filter(player => player.id !== peerId)
        }
    }

    /**
     * Returns whether a peer leaving should end the round for the survivors.
     */
    protected shouldAbandonGame(state: IRoomState): boolean {
        if (state.players.length >= 2) return false
        return state.phase === RoomPhase.Playing || state.phase === RoomPhase.Countdown
    }

    /**
     * Ends the round because every other player left the room.
     */
    protected applyAbandoned(state: IRoomState): IRoomState {
        return {
            ...state,
            phase: RoomPhase.Ended,
            countdown: null,
            abandoned: true
        }
    }

    /**
     * Reassigns the leader crown after a leadership transfer.
     */
    protected applyLeader(state: IRoomState, newLeaderId: string): IRoomState {
        return {
            ...state,
            players: state.players.map(player => ({
                ...player,
                isLeader: player.id === newLeaderId
            }))
        }
    }

    /**
     * Applies a countdown tick. When value is 0, transitions to playing.
     */
    protected applyCountdown(state: IRoomState, value: number): IRoomState {
        if (value <= 0) {
            return {
                ...state,
                phase: RoomPhase.Playing,
                countdown: null
            }
        }

        return {
            ...state,
            phase: RoomPhase.Countdown,
            countdown: value
        }
    }

    /**
     * Marks the room as playing.
     */
    protected applyPlaying(state: IRoomState): IRoomState {
        return {
            ...state,
            phase: RoomPhase.Playing,
            countdown: null
        }
    }

    /**
     * Narrows an unknown data-channel payload to a known app message.
     */
    protected parseDataChannelMessage(value: unknown): IDataChannelMessage | null {
        if (!value || typeof value !== "object") return null

        const record = value as Record<string, unknown>
        const type = record.type

        if (type === DataChannelMessageType.Sync) {
            const players = this.parsePlayers(record.players)
            if (!players) return null
            if (typeof record.code !== "string" || typeof record.name !== "string") return null
            if (!this.isRoomPhase(record.phase)) return null

            const game = record.game === null || record.game === undefined ? null : this.parseGameState(record.game)
            if (record.game !== null && record.game !== undefined && !game) return null

            const wins = record.wins === undefined ? {} : this.parseWins(record.wins)
            if (!wins) return null

            return {
                type: DataChannelMessageType.Sync,
                code: record.code,
                name: record.name,
                players,
                phase: record.phase,
                countdown: typeof record.countdown === "number" ? record.countdown : null,
                game,
                wins
            }
        }

        if (type === DataChannelMessageType.Countdown) {
            if (typeof record.value !== "number") return null
            return { type: DataChannelMessageType.Countdown, value: record.value }
        }

        if (type === DataChannelMessageType.Playing) {
            return { type: DataChannelMessageType.Playing }
        }

        if (type === DataChannelMessageType.PeerHello) {
            if (!record.player || typeof record.player !== "object") return null
            const player = record.player as Record<string, unknown>
            if (typeof player.id !== "string" || typeof player.nickname !== "string") return null

            return {
                type: DataChannelMessageType.PeerHello,
                player: {
                    id: player.id,
                    nickname: player.nickname,
                    isLeader: Boolean(player.isLeader)
                }
            }
        }

        if (type === DataChannelMessageType.GameSnapshot) {
            if (!this.isRoomPhase(record.phase)) return null
            const game = this.parseGameState(record.game)
            if (!game) return null
            return { type: DataChannelMessageType.GameSnapshot, phase: record.phase, game }
        }

        if (type === DataChannelMessageType.BreedAnnounced) {
            if (typeof record.breedId !== "string") return null
            if (typeof record.announceStartedAt !== "number") return null
            if (!this.isStringArray(record.announced) || !this.isStringArray(record.callOrder)) return null

            return {
                type: DataChannelMessageType.BreedAnnounced,
                breedId: record.breedId,
                announced: record.announced,
                callOrder: record.callOrder,
                announceStartedAt: record.announceStartedAt
            }
        }

        if (type === DataChannelMessageType.FakeBingo) {
            if (typeof record.playerId !== "string") return null
            return { type: DataChannelMessageType.FakeBingo, playerId: record.playerId }
        }

        if (type === DataChannelMessageType.GameEnded) {
            if (typeof record.winnerId !== "string") return null
            const game = this.parseGameState(record.game)
            if (!game) return null
            const progress = this.parsePlayerProgressList(record.progress)
            if (!progress) return null
            const wins = record.wins === undefined ? {} : this.parseWins(record.wins)
            if (!wins) return null
            return { type: DataChannelMessageType.GameEnded, winnerId: record.winnerId, progress, game, wins }
        }

        if (type === DataChannelMessageType.ClaimBingo) {
            if (typeof record.playerId !== "string") return null
            return { type: DataChannelMessageType.ClaimBingo, playerId: record.playerId }
        }

        return null
    }

    /**
     * Narrows an unknown signaling payload to a known server message.
     */
    protected parseSignalingServerMessage(value: unknown): ISignalingServerMessage | null {
        if (!value || typeof value !== "object") return null

        const record = value as Record<string, unknown>
        const type = record.type

        if (type === SignalingServerMessageType.Joined) {
            if (typeof record.peerId !== "string") return null
            if (typeof record.roomCode !== "string" || typeof record.roomName !== "string") return null
            const peers = this.parsePlayers(record.peers)
            if (!peers) return null

            return {
                type: SignalingServerMessageType.Joined,
                peerId: record.peerId,
                roomCode: record.roomCode,
                roomName: record.roomName,
                peers
            }
        }

        if (type === SignalingServerMessageType.PeerJoined) {
            if (!record.peer || typeof record.peer !== "object") return null
            const peer = record.peer as Record<string, unknown>
            if (typeof peer.id !== "string" || typeof peer.nickname !== "string") return null

            return {
                type: SignalingServerMessageType.PeerJoined,
                peer: {
                    id: peer.id,
                    nickname: peer.nickname,
                    isLeader: Boolean(peer.isLeader)
                }
            }
        }

        if (type === SignalingServerMessageType.PeerLeft) {
            if (typeof record.peerId !== "string") return null
            const newLeaderId =
                record.newLeaderId === null || typeof record.newLeaderId === "string" ? record.newLeaderId : null
            return {
                type: SignalingServerMessageType.PeerLeft,
                peerId: record.peerId,
                newLeaderId
            }
        }

        if (type === SignalingServerMessageType.Signal) {
            if (typeof record.from !== "string") return null
            const payload = this.parseWebRtcSignalPayload(record.payload)
            if (!payload) return null

            return {
                type: SignalingServerMessageType.Signal,
                from: record.from,
                payload
            }
        }

        if (type === SignalingServerMessageType.Error) {
            if (typeof record.message !== "string") return null
            return { type: SignalingServerMessageType.Error, message: record.message }
        }

        return null
    }

    /**
     * Resolves whether the peer connection's selected ICE path uses TURN relay
     * or a direct / STUN-discovered path.
     */
    protected async resolveIceTransportPath(connection: RTCPeerConnection): Promise<IIceTransportPath> {
        const stats = await connection.getStats()

        let selectedPair: RTCIceCandidatePairStats | undefined

        for (const report of stats.values()) {
            if (report.type === "candidate-pair" && "selected" in report && report.selected) {
                selectedPair = report as RTCIceCandidatePairStats
                break
            }
        }

        if (!selectedPair) {
            for (const report of stats.values()) {
                if (report.type !== "transport") continue
                const transport = report as RTCTransportStats
                if (!transport.selectedCandidatePairId) continue
                selectedPair = stats.get(transport.selectedCandidatePairId) as RTCIceCandidatePairStats | undefined
                break
            }
        }

        if (!selectedPair?.localCandidateId || !selectedPair.remoteCandidateId) return "unknown"

        const local = stats.get(selectedPair.localCandidateId) as { candidateType?: string } | undefined
        const remote = stats.get(selectedPair.remoteCandidateId) as { candidateType?: string } | undefined

        if (local?.candidateType === "relay" || remote?.candidateType === "relay") {
            return "turn"
        }

        if (local?.candidateType || remote?.candidateType) {
            return "stun-or-direct"
        }

        return "unknown"
    }

    /**
     * Logs the ICE transport path for a peer in development builds only.
     */
    protected logIceTransportPathIfDev(connection: RTCPeerConnection, peerId: string): void {
        if (!import.meta.env.DEV) return

        void this.resolveIceTransportPath(connection).then(async path => {
            let resolved = path

            // Selected pair stats can lag a moment after `connected`.
            if (resolved === "unknown") {
                await new Promise(resolve => setTimeout(resolve, 250))
                resolved = await this.resolveIceTransportPath(connection)
            }

            console.info(`[webrtc] peer ${peerId} ice path: ${resolved}`)
        })
    }

    /**
     * Narrows an unknown WebRTC signaling payload.
     */
    protected parseWebRtcSignalPayload(value: unknown): IWebRtcSignalPayload | null {
        if (!value || typeof value !== "object") return null

        const record = value as Record<string, unknown>

        if (record.kind === WebRtcSignalKind.Offer || record.kind === WebRtcSignalKind.Answer) {
            if (!record.sdp || typeof record.sdp !== "object") return null
            return {
                kind: record.kind,
                sdp: record.sdp as RTCSessionDescriptionInit
            }
        }

        if (record.kind === WebRtcSignalKind.Ice) {
            if (!record.candidate || typeof record.candidate !== "object") return null
            return {
                kind: WebRtcSignalKind.Ice,
                candidate: record.candidate
            }
        }

        return null
    }

    /**
     * Returns whether a value is a known room phase.
     */
    private isRoomPhase(value: unknown): value is IRoomPhase {
        return typeof value === "string" && (roomPhases as readonly string[]).includes(value)
    }

    /**
     * Narrows an unknown list into room players when the shape is valid.
     */
    private parsePlayers(value: unknown): IRoomPlayer[] | null {
        if (!Array.isArray(value)) return null

        const players: IRoomPlayer[] = []

        for (const item of value) {
            if (!item || typeof item !== "object") return null
            const record = item as Record<string, unknown>
            if (typeof record.id !== "string" || typeof record.nickname !== "string") return null

            players.push({
                id: record.id,
                nickname: record.nickname,
                isLeader: Boolean(record.isLeader)
            })
        }

        return players
    }

    /**
     * Narrows an unknown payload into a game state snapshot.
     */
    protected parseGameState(value: unknown): IGameState | null {
        if (!value || typeof value !== "object") return null

        const record = value as Record<string, unknown>
        if (!this.isStringArray(record.callOrder) || !this.isStringArray(record.announced)) return null
        if (typeof record.announceIntervalMs !== "number") return null
        if (record.currentBreedId !== null && typeof record.currentBreedId !== "string") return null
        if (record.announceStartedAt !== null && typeof record.announceStartedAt !== "number") return null
        if (record.winnerId !== null && typeof record.winnerId !== "string") return null
        if (record.fakeBingoPlayerId !== null && typeof record.fakeBingoPlayerId !== "string") return null

        const boards = this.parseBoards(record.boards)
        if (!boards) return null

        let progress: IPlayerProgress[] | null = null
        if (record.progress !== null && record.progress !== undefined) {
            progress = this.parsePlayerProgressList(record.progress)
            if (!progress) return null
        }

        return {
            callOrder: record.callOrder,
            announced: record.announced,
            currentBreedId: record.currentBreedId,
            announceIntervalMs: record.announceIntervalMs,
            announceStartedAt: record.announceStartedAt,
            boards,
            winnerId: record.winnerId,
            fakeBingoPlayerId: record.fakeBingoPlayerId,
            progress
        }
    }

    private parseWins(value: unknown): Record<string, number> | null {
        if (!value || typeof value !== "object" || Array.isArray(value)) return null

        const wins: Record<string, number> = {}

        for (const [playerId, count] of Object.entries(value as Record<string, unknown>)) {
            if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return null
            wins[playerId] = count
        }

        return wins
    }

    private parseBoards(value: unknown): Record<string, IBingoBoard> | null {
        if (!value || typeof value !== "object") return null

        const boards: Record<string, IBingoBoard> = {}

        for (const [playerId, boardValue] of Object.entries(value as Record<string, unknown>)) {
            if (!boardValue || typeof boardValue !== "object") return null
            const cellsValue = (boardValue as Record<string, unknown>).cells
            if (!Array.isArray(cellsValue) || cellsValue.length !== 25) return null

            const cells: Array<string | null> = []
            for (const cell of cellsValue) {
                if (cell !== null && typeof cell !== "string") return null
                cells.push(cell)
            }

            boards[playerId] = { cells }
        }

        return boards
    }

    private parsePlayerProgressList(value: unknown): IPlayerProgress[] | null {
        if (!Array.isArray(value)) return null

        const progress: IPlayerProgress[] = []

        for (const item of value) {
            if (!item || typeof item !== "object") return null
            const record = item as Record<string, unknown>
            if (typeof record.playerId !== "string" || typeof record.nickname !== "string") return null
            if (!this.isProgressLineKind(record.kind)) return null
            if (typeof record.index !== "number" || typeof record.filled !== "number") return null
            if (record.total !== 5) return null

            progress.push({
                playerId: record.playerId,
                nickname: record.nickname,
                kind: record.kind,
                index: record.index,
                filled: record.filled,
                total: 5
            })
        }

        return progress
    }

    private isProgressLineKind(value: unknown): value is IProgressLineKind {
        return typeof value === "string" && (progressLineKinds as readonly string[]).includes(value)
    }

    private isStringArray(value: unknown): value is string[] {
        return Array.isArray(value) && value.every(item => typeof item === "string")
    }
}
