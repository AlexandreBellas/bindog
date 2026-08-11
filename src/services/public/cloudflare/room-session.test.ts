import { ROOM_CODE_PATTERN } from "#/constants/room-code"
import { afterEach, describe, expect, it } from "vitest"
import {
    clearRoomSession,
    loadRoomSession,
    ROOM_SESSION_STORAGE_KEY,
    saveRoomSession
} from "./room-session"

describe("room-session", () => {
    afterEach(() => {
        window.localStorage.clear()
    })

    it("round-trips a valid session through localStorage", () => {
        saveRoomSession({
            roomCode: "abcdef",
            nickname: "  Alpha  ",
            peerId: "peer-1"
        })

        expect(loadRoomSession()).toEqual({
            roomCode: "ABCDEF",
            nickname: "Alpha",
            peerId: "peer-1"
        })
        expect(ROOM_CODE_PATTERN.test(loadRoomSession()!.roomCode)).toBe(true)
    })

    it("returns null for missing or invalid payloads", () => {
        expect(loadRoomSession()).toBeNull()

        window.localStorage.setItem(ROOM_SESSION_STORAGE_KEY, "{not-json")
        expect(loadRoomSession()).toBeNull()

        window.localStorage.setItem(
            ROOM_SESSION_STORAGE_KEY,
            JSON.stringify({ roomCode: "BAD", nickname: "Alpha", peerId: "peer-1" })
        )
        expect(loadRoomSession()).toBeNull()
    })

    it("clears the persisted session", () => {
        saveRoomSession({ roomCode: "ABCDEF", nickname: "Alpha", peerId: "peer-1" })
        clearRoomSession()
        expect(loadRoomSession()).toBeNull()
    })
})
