import type { IRoomPhase, IRoomSettings } from "#/@types/room"
import { RoomPhase } from "#/@types/room"
import { DEFAULT_ROOM_SETTINGS } from "#/constants/room-settings"

/**
 * Fills missing setting flags so older snapshots still parse.
 */
export function normalizeRoomSettings(value?: Partial<IRoomSettings> | null): IRoomSettings {
    return {
        fullGridBingo: Boolean(value?.fullGridBingo),
        hardMode: Boolean(value?.hardMode),
        limitIncorrectBindogs: Boolean(value?.limitIncorrectBindogs)
    }
}

/**
 * Returns whether a player may change room settings in the current phase.
 */
export function canUpdateRoomSettings(isLeader: boolean, phase: IRoomPhase): boolean {
    return isLeader && (phase === RoomPhase.Lobby || phase === RoomPhase.Ended)
}

/**
 * Returns a fresh copy of the default room settings.
 */
export function createDefaultRoomSettings(): IRoomSettings {
    return { ...DEFAULT_ROOM_SETTINGS }
}
