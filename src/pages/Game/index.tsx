import LeaveGameButton from "#/components/LeaveGameButton"
import { m } from "#/paraglide/messages"
import type { IRoomState } from "#/@types/room"
import gameEngine from "#/services/public/game-engine"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

export default function Game() {
    // #region Params
    const navigate = useNavigate()
    const handleLeave = async () => {
        await gameEngine.disconnect()
        await navigate({ to: "/" })
    }
    // #endregion

    // #region States
    const [room, setRoom] = useState<IRoomState | null>(() => gameEngine.getState())
    // #endregion

    // #region Effects
    /**
     * Keep the playing shell subscribed to the gateway session.
     */
    useEffect(() => {
        return gameEngine.subscribe(next => {
            setRoom(next)
        })
    }, [])
    /**
     * Guard: playing requires an active gateway session.
     */
    useEffect(() => {
        if (!room) {
            void navigate({ to: "/" })
        }
    }, [navigate, room])
    // #endregion

    if (!room) return null

    return (
        <main className="page-wrap flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-8 pt-10 sm:pt-14">
            <div className="rise-in mx-auto flex w-full max-w-lg flex-col items-center gap-6 text-center">
                <p className="island-kicker m-0">{room.name}</p>
                <h1 className="display-title m-0 text-4xl font-extrabold text-(--bark) sm:text-5xl">
                    {m.game_page_title()}
                </h1>
                <p className="m-0 text-base text-(--bark-soft) sm:text-lg">{m.game_page_placeholder()}</p>
                <LeaveGameButton
                    onConfirm={handleLeave}
                    variant="destructive"
                    className="rounded-2xl font-bold"
                />
            </div>
        </main>
    )
}
