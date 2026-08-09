import type IGameEngineGateway from "./IGameEngineGateway"
import GameEngineCloudflare from "./cloudflare/game-engine.cloudflare"

const gameEngine: IGameEngineGateway = new GameEngineCloudflare()

export default gameEngine
