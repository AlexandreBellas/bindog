import type { IBingoBoard } from "#/@types/game"
import { WILD_CELL_INDEX } from "#/constants/breeds"
import { describe, expect, it } from "vitest"
import {
    bestLineProgress,
    createInitialMarks,
    dealAllBoards,
    dealBoard,
    isBingoReady,
    isLegitimateBingo,
    shuffleCallOrder
} from "./bingo"

const IDS = Array.from({ length: 60 }, (_, index) => `breed-${index + 1}`)

/**
 * Deterministic RNG that walks a fixed sequence (cycles).
 */
function sequenceRng(values: number[]): () => number {
    let cursor = 0
    return () => {
        const value = values[cursor % values.length]
        cursor += 1
        return value ?? 0
    }
}

describe("shuffleCallOrder", () => {
    it("returns a permutation with each id once", () => {
        const shuffled = shuffleCallOrder(IDS, sequenceRng([0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6, 0.5]))
        expect(shuffled).toHaveLength(IDS.length)
        expect(new Set(shuffled).size).toBe(IDS.length)
        expect([...shuffled].sort()).toEqual([...IDS].sort())
    })
})

describe("dealBoard", () => {
    it("deals 24 unique breeds with wild center", () => {
        const board = dealBoard(IDS, () => 0.42)
        expect(board.cells).toHaveLength(25)
        expect(board.cells[WILD_CELL_INDEX]).toBeNull()

        const breeds = board.cells.filter((cell): cell is string => cell !== null)
        expect(breeds).toHaveLength(24)
        expect(new Set(breeds).size).toBe(24)
        expect(breeds.every(id => IDS.includes(id))).toBe(true)
    })

    it("throws when the catalog is too small", () => {
        expect(() => dealBoard(IDS.slice(0, 10))).toThrow(/24/)
    })
})

describe("dealAllBoards", () => {
    it("deals a board per player", () => {
        const boards = dealAllBoards(["a", "b"], IDS, () => 0.33)
        expect(Object.keys(boards)).toEqual(["a", "b"])
        expect(boards.a?.cells[WILD_CELL_INDEX]).toBeNull()
        expect(boards.b?.cells[WILD_CELL_INDEX]).toBeNull()
    })
})

describe("isBingoReady", () => {
    it("detects full rows and columns of local marks", () => {
        const marks = createInitialMarks()
        expect(isBingoReady(marks)).toBe(false)

        for (let col = 0; col < 5; col += 1) marks[2 * 5 + col] = true
        expect(isBingoReady(marks)).toBe(true)

        const columnMarks = createInitialMarks()
        for (let row = 0; row < 5; row += 1) columnMarks[row * 5 + 2] = true
        expect(isBingoReady(columnMarks)).toBe(true)
    })
})

describe("isLegitimateBingo", () => {
    const board: IBingoBoard = {
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

    it("accepts a row covered by announced breeds plus wild", () => {
        expect(isLegitimateBingo(board, ["k", "l", "m", "n"])).toBe(true)
    })

    it("rejects incomplete coverage even if player marks look ready", () => {
        expect(isLegitimateBingo(board, ["k", "l", "m"])).toBe(false)
    })

    it("accepts a full column", () => {
        expect(isLegitimateBingo(board, ["a", "f", "k", "o", "t"])).toBe(true)
    })
})

describe("bestLineProgress", () => {
    const board: IBingoBoard = {
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

    it("returns the strongest row or column progress", () => {
        const progress = bestLineProgress(board, ["k", "l"])
        expect(progress.filled).toBe(3)
        expect(progress.total).toBe(5)
        expect(progress.kind).toBe("row")
        expect(progress.index).toBe(2)
    })
})

describe("createInitialMarks", () => {
    it("pre-marks the wild cell only", () => {
        const marks = createInitialMarks()
        expect(marks.filter(Boolean)).toHaveLength(1)
        expect(marks[WILD_CELL_INDEX]).toBe(true)
    })
})
