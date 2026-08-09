import Footer from "#/components/base/Footer"
import DogIllustration from "#/components/brand/DogIllustration"
import { Button } from "#/components/ui/button"
import { m } from "#/paraglide/messages"
import { Link } from "@tanstack/react-router"
import { Home } from "lucide-react"

export default function NotFound() {
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:overflow-hidden">
            <div className="flex min-h-full flex-col justify-between md:min-h-0 md:flex-1 md:justify-start md:overflow-hidden">
                <main className="page-wrap flex flex-col px-4 pb-8 pt-6 md:min-h-0 md:flex-1 md:overflow-hidden md:pb-6 md:pt-10">
                    <section className="relative flex flex-col items-center text-center md:min-h-0 md:flex-1 md:justify-center">
                        <div className="rise-in float-soft w-full" style={{ animationDelay: "40ms" }}>
                            <DogIllustration />
                        </div>

                        <div className="rise-in mt-2 space-y-3 sm:mt-4" style={{ animationDelay: "120ms" }}>
                            <p className="island-kicker m-0">404</p>
                            <h1 className="display-title m-0 text-4xl font-extrabold tracking-tight text-(--bark) sm:text-5xl md:text-6xl">
                                {m.not_found_title()}
                            </h1>
                            <p className="mx-auto m-0 max-w-md text-base leading-relaxed text-(--bark-soft) sm:text-lg">
                                {m.not_found_description()}
                            </p>
                        </div>

                        <div
                            className="rise-in mx-auto mt-8 w-full max-w-md sm:mt-10"
                            style={{ animationDelay: "220ms" }}
                        >
                            <Button
                                asChild
                                size="lg"
                                className="h-12 w-full rounded-2xl bg-(--cta) text-base font-bold text-(--cta-foreground)! hover:bg-(--cta-hover) sm:h-14 sm:text-lg"
                            >
                                <Link to="/">
                                    <Home className="size-5" aria-hidden="true" />
                                    {m.back_home()}
                                </Link>
                            </Button>
                        </div>
                    </section>
                </main>
                <div className="shrink-0 md:hidden">
                    <Footer />
                </div>
            </div>
        </div>
    )
}
