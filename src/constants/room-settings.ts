import type { IRoomSettings } from "#/@types/room"

/** Incorrect Bindog claims allowed before a player is out of the current round. */
export const MAX_INCORRECT_BINDOGS = 3 as const

/** Leader-tunable defaults: classic line bingo, pictures announced, unlimited fakes. */
export const DEFAULT_ROOM_SETTINGS: IRoomSettings = {
    fullGridBingo: false,
    hardMode: false,
    limitIncorrectBindogs: false
}
