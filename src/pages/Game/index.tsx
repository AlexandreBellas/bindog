import { Button } from "#/components/ui/button"
import { m } from "#/paraglide/messages"
import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"

export default function Game() {
    return (
        <main className="page-wrap flex flex-1 flex-col px-4 pb-12 pt-10 sm:pt-14">
            <div className="rise-in mx-auto flex w-full max-w-lg flex-col items-center gap-6 text-center">
                <p className="island-kicker m-0">{m.coming_soon()}</p>
                <h1 className="display-title m-0 text-4xl font-extrabold text-(--bark) sm:text-5xl">
                    {m.game_page_title()}
                </h1>
                <p className="m-0 text-base text-(--bark-soft) sm:text-lg">{m.game_page_placeholder()}</p>
                <Button asChild variant="outline" className="rounded-2xl border-(--chip-line)">
                    <Link to="/">
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        {m.back_home()}
                    </Link>
                </Button>
            </div>
        </main>
    )
}
