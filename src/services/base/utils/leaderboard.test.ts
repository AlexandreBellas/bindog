import { RoomPhase } from "#/@types/room"
import { describe, expect, it } from "vitest"
import { buildLeaderboard, ensurePlayerWins, isSittingOutRound, recordWin } from "./leaderboard"

describe("ensurePlayerWins", () => {
    it("seeds missing players at 0 and keeps existing totals", () => {
        expect(ensurePlayerWins({ alpha: 2 }, ["alpha", "beta"])).toEqual({ alpha: 2, beta: 0 })
    })
})

describe("recordWin", () => {
    it("increments the winner and seeds them when they are new", () => {
        expect(recordWin({}, "alpha")).toEqual({ alpha: 1 })
        expect(recordWin({ alpha: 1, beta: 0 }, "alpha")).toEqual({ alpha: 2, beta: 0 })
    })

    it("does not change other players' totals", () => {
        expect(recordWin({ alpha: 3, beta: 1 }, "beta")).toEqual({ alpha: 3, beta: 2 })
    })
})

describe("buildLeaderboard", () => {
    it("ranks current players by wins, then nickname", () => {
        const entries = buildLeaderboard(
            [
                { id: "b", nickname: "Beta", isLeader: false },
                { id: "a", nickname: "Alpha", isLeader: true },
                { id: "c", nickname: "Charlie", isLeader: false }
            ],
            { a: 1, b: 1, c: 3 }
        )

        expect(entries.map(entry => entry.playerId)).toEqual(["c", "a", "b"])
        expect(entries[0]).toMatchObject({ nickname: "Charlie", wins: 3 })
        expect(entries.find(entry => entry.playerId === "a")?.wins).toBe(1)
    })

    it("treats missing win keys as 0", () => {
        const entries = buildLeaderboard([{ id: "a", nickname: "Alpha", isLeader: true }], {})
        expect(entries).toEqual([{ playerId: "a", nickname: "Alpha", wins: 0 }])
    })
})

describe("isSittingOutRound", () => {
    const board = { cells: Array.from({ length: 25 }, () => "labrador-retriever") }

    it("is true during playing/ended when the player has no board", () => {
        expect(isSittingOutRound(RoomPhase.Playing, "late", { early: board })).toBe(true)
        expect(isSittingOutRound(RoomPhase.Ended, "late", { early: board })).toBe(true)
        expect(isSittingOutRound(RoomPhase.Playing, "late", null)).toBe(true)
    })

    it("is false in lobby or when the player already has a board", () => {
        expect(isSittingOutRound(RoomPhase.Lobby, "late", { early: board })).toBe(false)
        expect(isSittingOutRound(RoomPhase.Countdown, "late", { early: board })).toBe(false)
        expect(isSittingOutRound(RoomPhase.Playing, "early", { early: board })).toBe(false)
    })
})
