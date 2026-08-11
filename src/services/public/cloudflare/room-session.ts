import { ROOM_CODE_PATTERN } from "#/constants/room-code"

export const ROOM_SESSION_STORAGE_KEY = "bindog.roomSession"

export interface IRoomSession {
    roomCode: string
    nickname: string
    peerId: string
}

/**
 * How long survivors wait before treating a peer-left as final.
 * Covers mobile app switches and brief signaling drops before auto-reconnect.
 */
export const PEER_LEAVE_GRACE_MS = 120_000

/**
 * Delay before attempting an automatic signaling reconnect.
 */
export const SIGNALING_RECONNECT_DELAY_MS = 400

/**
 * Reads a persisted room session from localStorage, if valid.
 */
export function loadRoomSession(): IRoomSession | null {
    if (typeof window === "undefined") return null

    try {
        const raw = window.localStorage.getItem(ROOM_SESSION_STORAGE_KEY)
        if (!raw) return null

        const parsed = JSON.parse(raw) as Partial<IRoomSession>
        if (typeof parsed.roomCode !== "string" || typeof parsed.nickname !== "string") return null
        if (typeof parsed.peerId !== "string" || parsed.peerId.length === 0) return null

        const roomCode = parsed.roomCode.trim().toUpperCase()
        const nickname = parsed.nickname.trim().slice(0, 24)
        if (!ROOM_CODE_PATTERN.test(roomCode) || !nickname) return null

        return { roomCode, nickname, peerId: parsed.peerId }
    } catch {
        return null
    }
}

/**
 * Persists the active room session so reloads / app switches can rejoin.
 */
export function saveRoomSession(session: IRoomSession): void {
    if (typeof window === "undefined") return

    try {
        window.localStorage.setItem(
            ROOM_SESSION_STORAGE_KEY,
            JSON.stringify({
                roomCode: session.roomCode,
                nickname: session.nickname,
                peerId: session.peerId
            } satisfies IRoomSession)
        )
    } catch {
        // Quota / private mode — session restore simply won't work.
    }
}

/**
 * Clears the persisted room session (explicit leave or room gone).
 */
export function clearRoomSession(): void {
    if (typeof window === "undefined") return

    try {
        window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
    } catch {
        // Ignore.
    }
}
