import { RoomPhase } from "#/@types/room"
import { describe, expect, it } from "vitest"
import { canUpdateRoomSettings, createDefaultRoomSettings, normalizeRoomSettings } from "./room-settings"

describe("normalizeRoomSettings", () => {
    it("defaults missing flags to off", () => {
        expect(normalizeRoomSettings(null)).toEqual({
            fullGridBingo: false,
            hardMode: false,
            limitIncorrectBindogs: false
        })
        expect(normalizeRoomSettings({ hardMode: true })).toEqual({
            fullGridBingo: false,
            hardMode: true,
            limitIncorrectBindogs: false
        })
    })
})

describe("canUpdateRoomSettings", () => {
    it("allows only the leader in lobby or ended phases", () => {
        expect(canUpdateRoomSettings(true, RoomPhase.Lobby)).toBe(true)
        expect(canUpdateRoomSettings(true, RoomPhase.Ended)).toBe(true)
        expect(canUpdateRoomSettings(true, RoomPhase.Playing)).toBe(false)
        expect(canUpdateRoomSettings(true, RoomPhase.Countdown)).toBe(false)
        expect(canUpdateRoomSettings(false, RoomPhase.Lobby)).toBe(false)
    })
})

describe("createDefaultRoomSettings", () => {
    it("returns classic-mode defaults", () => {
        expect(createDefaultRoomSettings()).toEqual(normalizeRoomSettings())
    })
})
