import { Link } from "@tanstack/react-router"
import ParaglideLocaleSwitcher from "../locale/LocaleSwitcher.tsx"
import ThemeToggle from "../theme/ThemeToggle/index.tsx"

export default function Header() {
    return (
        <header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) px-4 backdrop-blur-lg">
            <nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
                <h2 className="m-0 shrink-0 text-base font-semibold tracking-tight">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 rounded-full border border-(--chip-line) bg-(--chip-bg) px-3 py-1.5 text-sm text-(--sea-ink) no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
                    >
                        <span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
                        TanStack Start
                    </Link>
                </h2>

                <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-0 sm:w-auto sm:flex-nowrap sm:pb-0">
                    <Link to="/" className="nav-link" activeProps={{ className: "nav-link is-active" }}>
                        Home
                    </Link>
                    <details className="relative w-full sm:w-auto">
                        <summary className="nav-link list-none cursor-pointer">Demos</summary>
                        <div className="mt-2 min-w-56 rounded-xl border border-[var(--line)] bg-[var(--header-bg)] p-2 shadow-lg sm:absolute sm:right-0">
                            <a
                                href="/demo/posthog"
                                className="block rounded-lg px-3 py-2 text-sm text-[var(--sea-ink-soft)] no-underline transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                            >
                                PostHog
                            </a>
                            <a
                                href="/demo/tanstack-query"
                                className="block rounded-lg px-3 py-2 text-sm text-[var(--sea-ink-soft)] no-underline transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                            >
                                TanStack Query
                            </a>
                            <a
                                href="/demo/form/simple"
                                className="block rounded-lg px-3 py-2 text-sm text-[var(--sea-ink-soft)] no-underline transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                            >
                                Simple Form
                            </a>
                            <a
                                href="/demo/form/address"
                                className="block rounded-lg px-3 py-2 text-sm text-[var(--sea-ink-soft)] no-underline transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                            >
                                Address Form
                            </a>
                            <a
                                href="/demo/i18n"
                                className="block rounded-lg px-3 py-2 text-sm text-[var(--sea-ink-soft)] no-underline transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                            >
                                I18n example
                            </a>
                            <a
                                href="/demo/table"
                                className="block rounded-lg px-3 py-2 text-sm text-[var(--sea-ink-soft)] no-underline transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                            >
                                TanStack Table
                            </a>
                            <a
                                href="/demo/store"
                                className="block rounded-lg px-3 py-2 text-sm text-[var(--sea-ink-soft)] no-underline transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                            >
                                Store
                            </a>
                        </div>
                    </details>
                </div>

                <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                    <a
                        href="https://x.com/tan_stack"
                        target="_blank"
                        rel="noreferrer"
                        className="hidden rounded-xl p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)] sm:block"
                    >
                        <span className="sr-only">Follow TanStack on X</span>
                        <svg viewBox="0 0 16 16" aria-hidden="true" width="24" height="24">
                            <path
                                fill="currentColor"
                                d="M12.6 1h2.2L10 6.48 15.64 15h-4.41L7.78 9.82 3.23 15H1l5.14-5.84L.72 1h4.52l3.12 4.73L12.6 1zm-.77 12.67h1.22L4.57 2.26H3.26l8.57 11.41z"
                            />
                        </svg>
                    </a>
                    <ParaglideLocaleSwitcher />

                    <ThemeToggle />
                </div>
            </nav>
        </header>
    )
}
