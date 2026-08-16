import type { IKeyable } from "#/utils/types/keyable"

/** 5×5 bingo card; `null` at the center is the wild free space. */
export interface IBingoBoard {
    cells: Array<string | null>
}

export interface IBreed {
    id: string
    imageSrc: string
}

export const progressLineKinds = ["row", "col", "grid"] as const

export type IProgressLineKind = (typeof progressLineKinds)[number]

export const ProgressLineKind = {
    Row: "row",
    Col: "col",
    Grid: "grid"
} as const satisfies Record<IKeyable<IProgressLineKind>, IProgressLineKind>

export interface ILineProgress {
    kind: IProgressLineKind
    index: number
    filled: number
    total: number
}

export interface IPlayerProgress extends ILineProgress {
    playerId: string
    nickname: string
}

export interface IGameState {
    /** Remaining breeds to announce (leader authority; synced for leader transfer). */
    callOrder: string[]
    /** Breeds already announced, in call order. */
    announced: string[]
    currentBreedId: string | null
    announceIntervalMs: number
    /** Epoch ms when the current breed was announced (shared countdown UI). */
    announceStartedAt: number | null
    boards: Record<string, IBingoBoard>
    winnerId: string | null
    /** Transient fake-claim marker; cleared on the next announce. */
    fakeBingoPlayerId: string | null
    /** Incorrect Bindog claims this round, keyed by player id. */
    incorrectBindogCounts: Record<string, number>
    /** Players who hit the incorrect-claim cap and are out until the next round. */
    disqualifiedPlayerIds: string[]
    /** Transient disqualification marker; cleared on the next announce. */
    disqualifiedPlayerId: string | null
    /** Filled when the round ends. */
    progress: IPlayerProgress[] | null
}
