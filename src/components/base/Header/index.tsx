import BindogMark from "#/components/brand/BindogMark"
import LocaleSwitcher from "#/components/locale/LocaleSwitcher"
import ThemeToggle from "#/components/theme/ThemeToggle"
import { m } from "#/paraglide/messages"
import { Link } from "@tanstack/react-router"

export default function Header() {
    return (
        <header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) px-4 backdrop-blur-lg">
            <nav className="page-wrap flex items-center gap-3 py-3 sm:py-4">
                <Link
                    to="/"
                    aria-label={m.home_aria()}
                    className="group inline-flex items-center gap-2 text-(--bark) no-underline"
                >
                    <BindogMark className="size-9 shrink-0 transition group-hover:rotate-[-6deg] sm:size-10" />
                    <span className="display-title text-xl font-extrabold tracking-tight sm:text-2xl">
                        {m.app_name()}
                    </span>
                </Link>

                <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                    <LocaleSwitcher />
                    <ThemeToggle />
                </div>
            </nav>
        </header>
    )
}
