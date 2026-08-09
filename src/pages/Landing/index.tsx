import DogIllustration from "#/components/brand/DogIllustration"
import { m } from "#/paraglide/messages"
import { useState } from "react"
import type { ILandingModal } from "./@types/modal"
import HeroActions from "./components/HeroActions"
import JoinGameModal from "./components/JoinGameModal"
import SettingsModal from "./components/SettingsModal"
import TutorialModal from "./components/TutorialModal"

export default function Landing() {
    // #region States
    const [activeModal, setActiveModal] = useState<ILandingModal>(null)
    // #endregion

    return (
        <main className="page-wrap flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-6 pt-6 sm:pt-10">
            <section className="relative flex flex-1 flex-col items-center justify-center text-center">
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
