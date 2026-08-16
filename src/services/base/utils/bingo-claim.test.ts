import { describe, expect, it } from "vitest"
import { resolveBingoClaim, findSoleRemainingPlayerId } from "./bingo-claim"

const board = {
    cells: [
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "g",
        "h",
        "i",
        "j",
        "k",
        "l",
        null,
        "m",
        "n",
        "o",
        "p",
        "q",
        "r",
        "s",
        "t",
        "u",
        "v",
        "w",
        "x"
    ]
}

describe("resolveBingoClaim", () => {
    it("ignores claims from players without a board or already disqualified", () => {
        expect(
            resolveBingoClaim({
                board: undefined,
                announced: ["k", "l", "m", "n"],
                playerId: "p1",
                fullGridBingo: false,
                limitIncorrectBindogs: true,
                incorrectBindogCounts: {},
                disqualifiedPlayerIds: []
            }).outcome
        ).toBe("ignored")

        expect(
            resolveBingoClaim({
                board,
                announced: ["k", "l", "m", "n"],
                playerId: "p1",
                fullGridBingo: false,
                limitIncorrectBindogs: true,
                incorrectBindogCounts: { p1: 3 },
                disqualifiedPlayerIds: ["p1"]
            }).outcome
        ).toBe("ignored")
    })

    it("accepts a covered row in classic mode and rejects it in full-grid mode", () => {
        const announced = ["k", "l", "m", "n"]

        expect(
            resolveBingoClaim({
                board,
                announced,
                playerId: "p1",
                fullGridBingo: false,
                limitIncorrectBindogs: false,
                incorrectBindogCounts: {},
                disqualifiedPlayerIds: []
            }).outcome
        ).toBe("win")

        expect(
            resolveBingoClaim({
                board,
                announced,
                playerId: "p1",
                fullGridBingo: true,
                limitIncorrectBindogs: false,
                incorrectBindogCounts: {},
                disqualifiedPlayerIds: []
            }).outcome
        ).toBe("fake")
    })

    it("accepts a fully covered card in full-grid mode", () => {
        const announced = board.cells.filter((cell): cell is string => cell !== null)
        expect(
            resolveBingoClaim({
                board,
                announced,
                playerId: "p1",
                fullGridBingo: true,
                limitIncorrectBindogs: false,
                incorrectBindogCounts: {},
                disqualifiedPlayerIds: []
            }).outcome
        ).toBe("win")
    })

    it("counts incorrect claims without disqualifying when the cap is off", () => {
        let counts: Record<string, number> = {}

        for (let attempt = 1; attempt <= 4; attempt += 1) {
            const result = resolveBingoClaim({
                board,
                announced: [],
                playerId: "p1",
                fullGridBingo: false,
                limitIncorrectBindogs: false,
                incorrectBindogCounts: counts,
                disqualifiedPlayerIds: []
            })
            expect(result.outcome).toBe("fake")
            expect(result.incorrectBindogCounts.p1).toBe(attempt)
            expect(result.disqualifiedPlayerIds).toEqual([])
            counts = result.incorrectBindogCounts
        }
    })

    it("disqualifies on the third incorrect claim when the cap is on", () => {
        const first = resolveBingoClaim({
            board,
            announced: [],
            playerId: "p1",
            fullGridBingo: false,
            limitIncorrectBindogs: true,
            incorrectBindogCounts: {},
            disqualifiedPlayerIds: []
        })
        expect(first.outcome).toBe("fake")

        const second = resolveBingoClaim({
            board,
            announced: [],
            playerId: "p1",
            fullGridBingo: false,
            limitIncorrectBindogs: true,
            incorrectBindogCounts: first.incorrectBindogCounts,
            disqualifiedPlayerIds: first.disqualifiedPlayerIds
        })
        expect(second.outcome).toBe("fake")

        const third = resolveBingoClaim({
            board,
            announced: [],
            playerId: "p1",
            fullGridBingo: false,
            limitIncorrectBindogs: true,
            incorrectBindogCounts: second.incorrectBindogCounts,
            disqualifiedPlayerIds: second.disqualifiedPlayerIds
        })
        expect(third.outcome).toBe("disqualified")
        expect(third.incorrectBindogCounts.p1).toBe(3)
        expect(third.disqualifiedPlayerIds).toEqual(["p1"])
    })
})

describe("findSoleRemainingPlayerId", () => {
    it("returns the last in-round player when everyone else is disqualified", () => {
        expect(findSoleRemainingPlayerId(["a", "b"], ["a"])).toBe("b")
        expect(findSoleRemainingPlayerId(["a", "b", "c"], ["a", "c"])).toBe("b")
    })

    it("returns null when more than one player can still play", () => {
        expect(findSoleRemainingPlayerId(["a", "b"], [])).toBeNull()
        expect(findSoleRemainingPlayerId(["a", "b", "c"], ["a"])).toBeNull()
    })

    it("ignores players without a board and returns null when nobody remains", () => {
        expect(findSoleRemainingPlayerId(["a"], ["a"])).toBeNull()
        expect(findSoleRemainingPlayerId(["a"], [])).toBe("a")
        expect(findSoleRemainingPlayerId([], ["a"])).toBeNull()
    })
})
