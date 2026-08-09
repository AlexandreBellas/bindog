import { Button } from "#/components/ui/button"
import { m } from "#/paraglide/messages"
import { Link } from "@tanstack/react-router"
import { BookOpen, Gamepad2, Settings2, Users } from "lucide-react"
import type { ILandingModalKind } from "../../@types/modal"

interface IHeroActionsProps {
    onOpenModal: (modal: ILandingModalKind) => void
}

export default function HeroActions({ onOpenModal }: Readonly<IHeroActionsProps>) {
    return (
        <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10">
            <Button
                asChild
                size="lg"
                className="h-12 rounded-2xl bg-(--cta) text-base font-bold !text-(--cta-foreground) hover:bg-(--cta-hover) sm:h-14 sm:text-lg"
            >
                <Link to="/game">
                    <Gamepad2 className="size-5" aria-hidden="true" />
                    {m.start_game()}
                </Link>
            </Button>

            <Button
                type="button"
                size="lg"
                variant="secondary"
                onClick={() => onOpenModal("join")}
                className="h-12 rounded-2xl border border-(--chip-line) bg-(--chip-bg) text-base font-bold text-(--bark) hover:bg-(--biscuit) sm:h-14 sm:text-lg"
            >
                <Users className="size-5" aria-hidden="true" />
                {m.join_game()}
            </Button>

            <div className="grid grid-cols-2 gap-3">
                <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={() => onOpenModal("settings")}
                    className="h-11 rounded-2xl border-(--chip-line) bg-transparent text-sm font-bold text-(--bark) hover:bg-(--biscuit)/70 sm:h-12 sm:text-base"
                >
                    <Settings2 className="size-4" aria-hidden="true" />
                    {m.settings()}
                </Button>
                <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={() => onOpenModal("tutorial")}
                    className="h-11 rounded-2xl border-(--chip-line) bg-transparent text-sm font-bold text-(--bark) hover:bg-(--biscuit)/70 sm:h-12 sm:text-base"
                >
                    <BookOpen className="size-4" aria-hidden="true" />
                    {m.tutorial()}
                </Button>
            </div>
        </div>
    )
}
