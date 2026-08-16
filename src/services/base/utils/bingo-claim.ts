import type { IBingoBoard } from "#/@types/game"
import { MAX_INCORRECT_BINDOGS } from "#/constants/room-settings"
import { isLegitimateBingo } from "./bingo"

export type IBingoClaimOutcome = "ignored" | "win" | "fake" | "disqualified"

export interface IBingoClaimInput {
    board: IBingoBoard | undefined
    announced: readonly string[]
    playerId: string
    fullGridBingo: boolean
    limitIncorrectBindogs: boolean
    incorrectBindogCounts: Record<string, number>
    disqualifiedPlayerIds: readonly string[]
}

export interface IBingoClaimResolution {
    outcome: IBingoClaimOutcome
    incorrectBindogCounts: Record<string, number>
    disqualifiedPlayerIds: string[]
}

/**
 * Resolves a Bindog claim against announced breeds and room rules.
 * Disqualification only applies when the incorrect-claim cap is enabled.
 */
export function resolveBingoClaim(input: IBingoClaimInput): IBingoClaimResolution {
    const disqualifiedPlayerIds = [...input.disqualifiedPlayerIds]
    const incorrectBindogCounts = { ...input.incorrectBindogCounts }

    if (!input.board || disqualifiedPlayerIds.includes(input.playerId)) {
        return { outcome: "ignored", incorrectBindogCounts, disqualifiedPlayerIds }
    }

    if (isLegitimateBingo(input.board, input.announced, input.fullGridBingo)) {
        return { outcome: "win", incorrectBindogCounts, disqualifiedPlayerIds }
    }

    const nextCount = (incorrectBindogCounts[input.playerId] ?? 0) + 1
    incorrectBindogCounts[input.playerId] = nextCount

    if (input.limitIncorrectBindogs && nextCount >= MAX_INCORRECT_BINDOGS) {
        if (!disqualifiedPlayerIds.includes(input.playerId)) {
            disqualifiedPlayerIds.push(input.playerId)
        }

        return { outcome: "disqualified", incorrectBindogCounts, disqualifiedPlayerIds }
    }

    return { outcome: "fake", incorrectBindogCounts, disqualifiedPlayerIds }
}

/**
 * Returns the last in-round player when everyone else with a board is disqualified.
 */
export function findSoleRemainingPlayerId(
    playerIdsWithBoards: readonly string[],
    disqualifiedPlayerIds: readonly string[]
): string | null {
    const remaining = playerIdsWithBoards.filter(playerId => !disqualifiedPlayerIds.includes(playerId))
    return remaining.length === 1 ? (remaining[0] ?? null) : null
}

/**
 * Returns whether this player is out of the current round.
 */
export function isPlayerDisqualified(disqualifiedPlayerIds: readonly string[] | undefined, playerId: string): boolean {
    return Boolean(disqualifiedPlayerIds?.includes(playerId))
}
