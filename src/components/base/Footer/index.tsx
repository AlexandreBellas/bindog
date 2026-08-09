import { m } from "#/paraglide/messages"
import { ChevronUp, Github, Linkedin } from "lucide-react"

export default function Footer() {
    return (
        <footer className="mt-auto border-t border-(--line) bg-(--header-bg)/80 px-4 py-5 text-(--bark-soft) backdrop-blur-sm md:sticky md:bottom-0 md:z-40">
            <div className="page-wrap flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col items-center gap-2 sm:items-start">
                    <p className="m-0 text-sm font-medium text-(--bark)">{m.footer_made_by()}</p>
                    <nav className="flex items-center gap-1" aria-label={m.footer_socials_label()}>
                        <a
                            href="https://github.com/AlexandreBellas"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-2 text-(--bark-soft) no-underline transition hover:bg-(--link-bg-hover) hover:text-(--bark)"
                        >
                            <span className="sr-only">GitHub</span>
                            <Github className="size-4" aria-hidden="true" />
                        </a>
                        <a
                            href="https://www.linkedin.com/in/alebatistella/"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-2 text-(--bark-soft) no-underline transition hover:bg-(--link-bg-hover) hover:text-(--bark)"
                        >
                            <span className="sr-only">LinkedIn</span>
                            <Linkedin className="size-4" aria-hidden="true" />
                        </a>
                        <a
                            href="https://cursor.com/@alebatistella"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-2 text-(--bark-soft) no-underline transition hover:bg-(--link-bg-hover) hover:text-(--bark)"
                        >
                            <span className="sr-only">Cursor</span>
                            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
                                <path d="M4 3.5 19.5 12 10 14.2 7.8 21.5 4 3.5Z" />
                            </svg>
                        </a>
                    </nav>
                </div>

                <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-semibold tracking-wide text-(--bark-soft)/80 uppercase transition hover:bg-(--link-bg-hover) hover:text-(--bark)">
                        {m.footer_other_games()}
                        <ChevronUp className="size-3.5 transition group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="absolute bottom-[calc(100%+0.4rem)] left-1/2 z-50 min-w-40 -translate-x-1/2 rounded-xl border border-(--line) bg-(--foam) p-1.5 shadow-lg sm:left-auto sm:right-0 sm:translate-x-0">
                        <a
                            href="https://2040dog.alebatistella.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg px-3 py-2 text-sm text-(--bark-soft) no-underline transition hover:bg-(--link-bg-hover) hover:text-(--bark)"
                        >
                            2040dog
                        </a>
                        <a
                            href="https://sudog.alebatistella.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg px-3 py-2 text-sm text-(--bark-soft) no-underline transition hover:bg-(--link-bg-hover) hover:text-(--bark)"
                        >
                            Sudog
                        </a>
                    </div>
                </details>

                <p className="island-kicker m-0 text-center sm:text-right">{m.footer_tagline()}</p>
            </div>
        </footer>
    )
}
