import type { IConnectInput, IGameEngineMessage, IRoomState } from "#/@types/room"

export type IRoomStateListener = (state: IRoomState | null) => void

export default interface IGameEngineGateway {
    connect: (input: IConnectInput) => Promise<IRoomState>
    disconnect: () => Promise<void>
    dispose: () => void
    send: (message: IGameEngineMessage) => void
    subscribe: (listener: IRoomStateListener) => () => void
    getState: () => IRoomState | null
    canStartGame: () => boolean
    isValidRoomCode: (code: string) => boolean
}
