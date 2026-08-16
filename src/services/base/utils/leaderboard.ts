import type { IBingoBoard } from "#/@types/game"
import type { IRoomPhase, IRoomPlayer } from "#/@types/room"
import { RoomPhase } from "#/@types/room"

export interface ILeaderboardEntry {
    playerId: string
    nickname: string
    wins: number
}

/**
 * Seeds missing players at 0 without resetting existing totals.
 */
export function ensurePlayerWins(wins: Record<string, number>, playerIds: string[]): Record<string, number> {
    const next = { ...wins }

    for (const playerId of playerIds) {
        if (!(playerId in next)) next[playerId] = 0
    }

    return next
}

/**
 * Adds one room win for a legitimate bingo.
 */
export function recordWin(wins: Record<string, number>, playerId: string): Record<string, number> {
    const next = ensurePlayerWins(wins, [playerId])
    return {
        ...next,
        [playerId]: next[playerId] + 1
    }
}

/**
 * Current roster ranked by room wins (ties by nickname).
 */
export function buildLeaderboard(players: IRoomPlayer[], wins: Record<string, number>): ILeaderboardEntry[] {
    return players
        .map(player => ({
            playerId: player.id,
            nickname: player.nickname,
            wins: wins[player.id] ?? 0
        }))
        .sort((left, right) => right.wins - left.wins || left.nickname.localeCompare(right.nickname))
}

/**
 * True when this player joined after boards were dealt for the current round.
 */
export function isSittingOutRound(
    phase: IRoomPhase,
    playerId: string,
    boards: Record<string, IBingoBoard> | null | undefined
): boolean {
    if (phase !== RoomPhase.Playing && phase !== RoomPhase.Ended) return false
    if (!boards) return true
    return !Object.hasOwn(boards, playerId)
}
