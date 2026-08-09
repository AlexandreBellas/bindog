import { Button } from "#/components/ui/button"
import { m } from "#/paraglide/messages"
import { GameEngineMessageType, RoomPhase } from "#/@types/room"
import type { IRoomState } from "#/@types/room"
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

    // #region States
    const [room, setRoom] = useState<IRoomState | null>(() => gameEngine.getState())
    const [startError, setStartError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const handleStartGame = () => {
        setStartError(null)

        try {
            gameEngine.send({ type: GameEngineMessageType.StartGame })
        } catch {
            setStartError(m.error_need_two_players())
        }
    }
    const handleCopyCode = async () => {
        if (!room) return

        try {
            await navigator.clipboard.writeText(room.code)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        } catch {
            setCopied(false)
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
     * Guard: lobby requires an active gateway session.
     */
    useEffect(() => {
        if (!room) {
            void navigate({ to: "/" })
        }
    }, [navigate, room])
    /**
     * Move into the game shell once countdown finishes.
     */
    useEffect(() => {
        if (room?.phase === RoomPhase.Playing) {
            void navigate({ to: "/game" })
        }
    }, [navigate, room?.phase])
    // #endregion

    if (!room) return null

    const localPlayer = room.players.find(player => player.id === room.localPlayerId)
    const isLeader = Boolean(localPlayer?.isLeader)
    const canStart = gameEngine.canStartGame()

    return (
        <main className="page-wrap relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-8 pt-10 sm:pt-14">
            <div className="rise-in mx-auto flex w-full max-w-lg flex-col gap-6">
                <header className="space-y-2 text-center">
                    <p className="island-kicker m-0">{m.lobby_kicker()}</p>
                    <h1 className="display-title m-0 text-4xl font-extrabold text-(--bark) sm:text-5xl">{room.name}</h1>
                    <p className="m-0 text-base text-(--bark-soft)">{m.lobby_share_hint()}</p>
                </header>

                <section className="flex flex-col items-center gap-3 rounded-3xl border border-(--chip-line) bg-(--surface) px-5 py-6 text-center">
                    <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-(--kicker)">
                        {m.lobby_room_code()}
                    </p>
                    <p className="display-title m-0 text-4xl font-extrabold tracking-[0.28em] text-(--bark) sm:text-5xl">
                        {room.code}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyCode}
                        className="rounded-2xl border-(--chip-line)"
                    >
                        {copied ? m.lobby_code_copied() : m.lobby_copy_code()}
                    </Button>
                </section>

                <section className="space-y-3">
                    <h2 className="display-title m-0 text-xl font-bold text-(--bark)">{m.lobby_players()}</h2>
                    <PlayerList players={room.players} localPlayerId={room.localPlayerId} />
                </section>

                <div className="flex flex-col gap-3">
                    {isLeader ? (
                        <Button
                            type="button"
                            size="lg"
                            disabled={!canStart || room.phase !== RoomPhase.Lobby}
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

                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleLeave}
                        className="rounded-2xl border-(--chip-line)"
                    >
                        {m.leave_game()}
                    </Button>
                </div>
            </div>

            {room.phase === RoomPhase.Countdown && room.countdown !== null ? (
                <CountdownOverlay value={room.countdown} />
            ) : null}
        </main>
    )
}
