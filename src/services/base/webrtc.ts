import { ROOM_CODE_PATTERN } from "#/constants/room-code"
import { RoomPhase, roomPhases } from "#/@types/room"
import type { IRoomPhase, IRoomPlayer, IRoomState } from "#/@types/room"
import { DataChannelMessageType, SignalingServerMessageType, WebRtcSignalKind } from "#/@types/signaling"
import type { IDataChannelMessage, ISignalingServerMessage, IWebRtcSignalPayload } from "#/@types/signaling"

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
     */
    protected evaluateCanStartGame(state: IRoomState): boolean {
        if (state.phase !== RoomPhase.Lobby) return false
        if (state.players.length < 2) return false

        const local = state.players.find(player => player.id === state.localPlayerId)
        return Boolean(local?.isLeader)
    }

    /**
     * Builds the next lobby state after a player joins.
     */
    protected upsertPlayer(state: IRoomState, player: IRoomPlayer): IRoomState {
        const without = state.players.filter(item => item.id !== player.id)
        return {
            ...state,
            players: [...without, player]
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

            return {
                type: DataChannelMessageType.Sync,
                code: record.code,
                name: record.name,
                players,
                phase: record.phase,
                countdown: typeof record.countdown === "number" ? record.countdown : null
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
            return { type: SignalingServerMessageType.PeerLeft, peerId: record.peerId }
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
}
