import type { IRoomState } from "#/@types/room"
import { GameEngineMessageType, RoomPhase } from "#/@types/room"
import LeaveGameButton from "#/components/LeaveGameButton"
import RoomCodeCopy from "#/components/RoomCodeCopy"
import RoomGameSettings from "#/components/RoomGameSettings"
import { Button } from "#/components/ui/button"
import { m } from "#/paraglide/messages"
import { createDefaultRoomSettings } from "#/services/base/utils/room-settings"
import { loadRoomSession } from "#/services/public/cloudflare/room-session"
import gameEngine from "#/services/public/game-engine"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import CountdownOverlay from "./components/CountdownOverlay"
import PlayerList from "./components/PlayerList"

export default function Matchmaking() {
    // #region Params
    const navigate = useNavigate()
    const handleLeave = async () => {
        await gameEngine.disconnect()
        await navigate({ to: "/" })
    }
    // #endregion

    // #region Custom hooks
    const handleSettingsChange = (settings: IRoomState["settings"]) => {
        gameEngine.send({ type: GameEngineMessageType.UpdateSettings, settings })
    }
    // #endregion

    // #region States
    const [room, setRoom] = useState<IRoomState | null>(() => gameEngine.getState())
    const [startError, setStartError] = useState<string | null>(null)
    const handleStartGame = () => {
        setStartError(null)

        try {
            gameEngine.send({ type: GameEngineMessageType.StartGame })
        } catch {
            setStartError(m.error_need_two_players())
        }
    }
    // #endregion

    // #region Effects
    /**
     * Keep lobby state in sync with the gateway singleton.
     */
    useEffect(() => {
        return gameEngine.subscribe(next => {
            setRoom(next)
        })
    }, [])
    /**
     * Guard: lobby requires an active gateway session (or a successful restore).
     */
    useEffect(() => {
        if (room) return

        let cancelled = false

        void (async () => {
            const restored = await gameEngine.restoreSession()
            if (cancelled) return
            // Keep the lobby mounted while a persisted session retries; only leave when none remains.
            if (!restored && !loadRoomSession()) {
                void navigate({ to: "/" })
            }
        })()

        return () => {
            cancelled = true
        }
    }, [navigate, room])
    /**
     * Move into the game shell once countdown finishes.
     */
    useEffect(() => {
        if (room?.phase === RoomPhase.Playing || room?.phase === RoomPhase.Ended) {
            void navigate({ to: "/game" })
        }
    }, [navigate, room?.phase])
    // #endregion

    if (!room) return null

    const localPlayer = room.players.find(player => player.id === room.localPlayerId)
    const isLeader = Boolean(localPlayer?.isLeader)
    // Derive from reactive room fields so React Compiler cannot freeze a stale gateway read.
    // Peers inside leave-grace stay listed but must not satisfy "two players".
    const pendingLeaves = new Set(room.pendingLeavePeerIds ?? [])
    const activePlayerCount = room.players.filter(player => !pendingLeaves.has(player.id)).length
    const canStart = isLeader && room.phase === RoomPhase.Lobby && activePlayerCount >= 2

    return (
        <main className="relative flex min-h-0 w-full flex-1 flex-col overflow-y-auto">
            <div className="page-wrap rise-in mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pb-8 pt-10 sm:pt-14">
                <header className="space-y-2 text-center">
                    <p className="island-kicker m-0">{m.lobby_kicker()}</p>
                    <h1 className="display-title m-0 text-4xl font-extrabold text-(--bark) sm:text-5xl">{room.name}</h1>
                    <p className="m-0 text-base text-(--bark-soft)">{m.lobby_share_hint()}</p>
                </header>

                <RoomCodeCopy code={room.code} />

                <section className="space-y-3">
                    <h2 className="display-title m-0 text-xl font-bold text-(--bark)">{m.lobby_players()}</h2>
                    <PlayerList players={room.players} localPlayerId={room.localPlayerId} />
                </section>

                <div className="flex flex-col gap-3">
                    <RoomGameSettings
                        settings={room.settings ?? createDefaultRoomSettings()}
                        editable={isLeader && room.phase === RoomPhase.Lobby}
                        onChange={handleSettingsChange}
                    />
                    {isLeader ? (
                        <Button
                            type="button"
                            size="lg"
                            disabled={!canStart}
                            onClick={handleStartGame}
                            className="h-12 rounded-2xl bg-(--cta) text-base font-bold text-(--cta-foreground)! hover:bg-(--cta-hover)"
                        >
                            {m.lobby_start_game()}
                        </Button>
                    ) : (
                        <p className="m-0 rounded-2xl border border-(--chip-line) bg-(--chip-bg) px-4 py-3 text-center text-sm font-semibold text-(--bark-soft)">
                            {m.lobby_waiting_for_leader()}
                        </p>
                    )}

                    {startError ? <p className="m-0 text-center text-sm text-destructive">{startError}</p> : null}
                    {!canStart && isLeader && room.phase === RoomPhase.Lobby ? (
                        <p className="m-0 text-center text-sm text-(--bark-soft)">{m.error_need_two_players()}</p>
                    ) : null}

                    <LeaveGameButton onConfirm={handleLeave} className="rounded-2xl border-(--chip-line)" />
                </div>
            </div>

            {room.phase === RoomPhase.Countdown && room.countdown !== null ? (
                <CountdownOverlay value={room.countdown} />
            ) : null}
        </main>
    )
}
