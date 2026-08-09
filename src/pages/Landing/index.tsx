import DogIllustration from "#/components/brand/DogIllustration"
import { m } from "#/paraglide/messages"
import { useState } from "react"
import type { ILandingModal } from "./@types/modal"
import HeroActions from "./components/HeroActions"
import JoinGameModal from "./components/JoinGameModal"
import SettingsModal from "./components/SettingsModal"
import StartGameModal from "./components/StartGameModal"
import TutorialModal from "./components/TutorialModal"

export default function Landing() {
    // #region States
    const [activeModal, setActiveModal] = useState<ILandingModal>(null)
    // #endregion

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
