import type { IBingoBoard, ILineProgress } from "#/@types/game"
import { ProgressLineKind } from "#/@types/game"
import { BINGO_BOARD_SIZE, BINGO_BREEDS_PER_BOARD, BINGO_CELL_COUNT } from "#/constants/bingo"
import { WILD_CELL_INDEX } from "#/constants/breeds"

export type IRng = () => number

/**
 * Fisher–Yates shuffle of breed ids (each breed at most once).
 */
export function shuffleCallOrder(ids: readonly string[], rng: IRng = Math.random): string[] {
    const order = [...ids]

    for (let index = order.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(rng() * (index + 1))
        const current = order[index]
        order[index] = order[swapIndex]
        order[swapIndex] = current
    }

    return order
}

/**
 * Deals a 5×5 board: 24 unique breeds + center wild (`null` at index 12).
 */
export function dealBoard(ids: readonly string[], rng: IRng = Math.random): IBingoBoard {
    if (ids.length < BINGO_BREEDS_PER_BOARD) {
        throw new Error(`Need at least ${BINGO_BREEDS_PER_BOARD} breeds to deal a board`)
    }

    const picked = shuffleCallOrder(ids, rng).slice(0, BINGO_BREEDS_PER_BOARD)
    const cells: Array<string | null> = []
    let breedIndex = 0

    for (let index = 0; index < BINGO_CELL_COUNT; index += 1) {
        if (index === WILD_CELL_INDEX) {
            cells.push(null)
            continue
        }

        const breedId = picked.at(breedIndex)
        if (breedId === undefined) {
            throw new Error("Failed to deal board cell")
        }

        cells.push(breedId)
        breedIndex += 1
    }

    return { cells }
}

/**
 * Deals an independent board for each player from the same breed pool.
 */
export function dealAllBoards(
    playerIds: readonly string[],
    ids: readonly string[],
    rng: IRng = Math.random
): Record<string, IBingoBoard> {
    const boards: Record<string, IBingoBoard> = {}

    for (const playerId of playerIds) {
        boards[playerId] = dealBoard(ids, rng)
    }

    return boards
}

/**
 * Returns whether local marks already form a full row or column (wild pre-marked).
 */
export function isBingoReady(marks: readonly boolean[]): boolean {
    if (marks.length !== BINGO_CELL_COUNT) return false

    for (let row = 0; row < BINGO_BOARD_SIZE; row += 1) {
        if (isFullLine(marks, row, "row")) return true
    }

    for (let col = 0; col < BINGO_BOARD_SIZE; col += 1) {
        if (isFullLine(marks, col, "col")) return true
    }

    return false
}

/**
 * Returns whether any row/col on the board is fully covered by announced breeds (+ wild).
 */
export function isLegitimateBingo(board: IBingoBoard, announcedIds: readonly string[]): boolean {
    if (board.cells.length !== BINGO_CELL_COUNT) return false

    const announced = new Set(announcedIds)

    for (let row = 0; row < BINGO_BOARD_SIZE; row += 1) {
        if (isCoveredLine(board, announced, row, "row")) return true
    }

    for (let col = 0; col < BINGO_BOARD_SIZE; col += 1) {
        if (isCoveredLine(board, announced, col, "col")) return true
    }

    return false
}

/**
 * Best row/col progress toward bingo for leaderboard display.
 */
export function bestLineProgress(board: IBingoBoard, announcedIds: readonly string[]): ILineProgress {
    const announced = new Set(announcedIds)
    let best: ILineProgress = {
        kind: ProgressLineKind.Row,
        index: 0,
        filled: countCovered(board, announced, 0, "row"),
        total: 5
    }

    for (let row = 1; row < BINGO_BOARD_SIZE; row += 1) {
        const filled = countCovered(board, announced, row, "row")
        if (filled > best.filled) {
            best = { kind: ProgressLineKind.Row, index: row, filled, total: 5 }
        }
    }

    for (let col = 0; col < BINGO_BOARD_SIZE; col += 1) {
        const filled = countCovered(board, announced, col, "col")
        if (filled > best.filled) {
            best = { kind: ProgressLineKind.Col, index: col, filled, total: 5 }
        }
    }

    return best
}

/**
 * Creates the initial local marks array with the wild cell already marked.
 */
export function createInitialMarks(): boolean[] {
    const marks = Array.from({ length: BINGO_CELL_COUNT }, () => false)
    marks[WILD_CELL_INDEX] = true
    return marks
}

/**
 * Returns whether every cell in a row or column is marked.
 */
function isFullLine(marks: readonly boolean[], index: number, kind: "row" | "col"): boolean {
    for (let step = 0; step < BINGO_BOARD_SIZE; step += 1) {
        const cellIndex = kind === "row" ? index * BINGO_BOARD_SIZE + step : step * BINGO_BOARD_SIZE + index
        if (!marks[cellIndex]) return false
    }

    return true
}

/**
 * Returns whether every cell in a row or column is covered by announced breeds or wild.
 */
function isCoveredLine(
    board: IBingoBoard,
    announced: ReadonlySet<string>,
    index: number,
    kind: "row" | "col"
): boolean {
    return countCovered(board, announced, index, kind) === BINGO_BOARD_SIZE
}

/**
 * Counts how many cells in a row or column are covered by announced breeds or wild.
 */
function countCovered(
    board: IBingoBoard,
    announced: ReadonlySet<string>,
    index: number,
    kind: "row" | "col"
): number {
    let filled = 0

    for (let step = 0; step < BINGO_BOARD_SIZE; step += 1) {
        const cellIndex = kind === "row" ? index * BINGO_BOARD_SIZE + step : step * BINGO_BOARD_SIZE + index
        const breedId = board.cells[cellIndex]
        if (breedId === null || (typeof breedId === "string" && announced.has(breedId))) filled += 1
    }

    return filled
}
