import type { IGameState } from "./game"
import type { IKeyable } from "#/utils/types/keyable"

export const roomPhases = ["lobby", "countdown", "playing", "ended"] as const

export type IRoomPhase = (typeof roomPhases)[number]

export const RoomPhase = {
    Lobby: "lobby",
    Countdown: "countdown",
    Playing: "playing",
    Ended: "ended"
} as const satisfies Record<IKeyable<IRoomPhase>, IRoomPhase>

export const connectRoles = ["leader", "joiner"] as const

export type IConnectRole = (typeof connectRoles)[number]

export const ConnectRole = {
    Leader: "leader",
    Joiner: "joiner"
} as const satisfies Record<IKeyable<IConnectRole>, IConnectRole>

export interface IRoomPlayer {
    id: string
    nickname: string
    isLeader: boolean
}

export interface IRoomState {
    code: string
    name: string
    players: IRoomPlayer[]
    phase: IRoomPhase
    countdown: number | null
    localPlayerId: string
    game: IGameState | null
    /** True when the round was cut short because every other player left. */
    abandoned: boolean
}

export interface IConnectAsLeader {
    role: typeof ConnectRole.Leader
    roomName: string
    nickname: string
}

export interface IConnectAsJoiner {
    role: typeof ConnectRole.Joiner
    roomCode: string
    nickname: string
}

export type IConnectInput = IConnectAsLeader | IConnectAsJoiner

export const gameEngineMessageTypes = ["start-game", "claim-bingo", "restart-game"] as const

export type IGameEngineMessageType = (typeof gameEngineMessageTypes)[number]

export const GameEngineMessageType = {
    StartGame: "start-game",
    ClaimBingo: "claim-bingo",
    RestartGame: "restart-game"
} as const satisfies Record<IKeyable<IGameEngineMessageType>, IGameEngineMessageType>

export interface IStartGameMessage {
    type: typeof GameEngineMessageType.StartGame
}

export interface IClaimBingoMessage {
    type: typeof GameEngineMessageType.ClaimBingo
}

export interface IRestartGameMessage {
    type: typeof GameEngineMessageType.RestartGame
}

export type IGameEngineMessage = IStartGameMessage | IClaimBingoMessage | IRestartGameMessage
