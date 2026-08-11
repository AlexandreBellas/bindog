import DogIllustration from "#/components/brand/DogIllustration"
import { m } from "#/paraglide/messages"
import { RoomPhase } from "#/@types/room"
import { loadRoomSession } from "#/services/public/cloudflare/room-session"
import gameEngine from "#/services/public/game-engine"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import type { ILandingModal } from "./@types/modal"
import HeroActions from "./components/HeroActions"
import JoinGameModal from "./components/JoinGameModal"
import SettingsModal from "./components/SettingsModal"
import StartGameModal from "./components/StartGameModal"
import TutorialModal from "./components/TutorialModal"

export default function Landing() {
    // #region Params
    const navigate = useNavigate()
    // #endregion

    // #region States
    const [activeModal, setActiveModal] = useState<ILandingModal>(null)
    const [isRestoring, setIsRestoring] = useState(
        () => Boolean(gameEngine.getState()) || Boolean(loadRoomSession())
    )
    // #endregion

    // #region Effects
    /**
     * Rejoin a room persisted in localStorage after reload or process death.
     * Always clears the restoring gate so a hung/failed restore cannot block Join/Create.
     */
    useEffect(() => {
        let cancelled = false

        void (async () => {
            try {
                const existing = gameEngine.getState()
                if (existing) {
                    if (!cancelled) {
                        await navigate({
                            to:
                                existing.phase === RoomPhase.Playing || existing.phase === RoomPhase.Ended
                                    ? "/game"
                                    : "/matchmaking"
                        })
                    }
                    return
                }

                if (!loadRoomSession()) return

                const restored = await gameEngine.restoreSession()
                if (cancelled || !restored) return

                await navigate({
                    to:
                        restored.phase === RoomPhase.Playing || restored.phase === RoomPhase.Ended
                            ? "/game"
                            : "/matchmaking"
                })
            } finally {
                if (!cancelled) setIsRestoring(false)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [navigate])
    // #endregion

    if (isRestoring) {
        return (
            <main className="page-wrap flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-6">
                <p className="m-0 text-base font-semibold text-(--bark-soft)">{m.connecting()}</p>
            </main>
        )
    }

    return (
        <main className="page-wrap flex flex-col px-4 pb-8 pt-6 md:min-h-0 md:flex-1 md:overflow-hidden md:pb-6 md:pt-10">
            <section className="relative flex flex-col items-center text-center md:min-h-0 md:flex-1 md:justify-center">
                <div className="rise-in float-soft w-full" style={{ animationDelay: "40ms" }}>
                    <DogIllustration />
                </div>

                <div className="rise-in mt-2 space-y-3 sm:mt-4" style={{ animationDelay: "120ms" }}>
                    <h1 className="display-title m-0 text-5xl font-extrabold tracking-tight text-(--bark) sm:text-6xl md:text-7xl">
                        {m.app_name()}
                    </h1>
                    <p className="mx-auto m-0 max-w-xl text-base leading-relaxed text-(--bark-soft) sm:text-lg">
                        {m.app_description()}
                    </p>
                </div>

                <div className="rise-in w-full" style={{ animationDelay: "220ms" }}>
                    <HeroActions onOpenModal={setActiveModal} />
                </div>
            </section>

            <StartGameModal
                open={activeModal === "start"}
                onOpenChange={open => setActiveModal(open ? "start" : null)}
            />
            <JoinGameModal open={activeModal === "join"} onOpenChange={open => setActiveModal(open ? "join" : null)} />
            <SettingsModal
                open={activeModal === "settings"}
                onOpenChange={open => setActiveModal(open ? "settings" : null)}
            />
            <TutorialModal
                open={activeModal === "tutorial"}
                onOpenChange={open => setActiveModal(open ? "tutorial" : null)}
            />
        </main>
    )
}
