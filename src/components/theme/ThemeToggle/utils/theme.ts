import type { IThemeMode } from "../@types/mode"

/**
 * Get the initial theme mode from localStorage or default to "auto".
 */
export function getInitialMode(): IThemeMode {
    if (typeof window === "undefined") return "auto"

    const stored = window.localStorage.getItem("theme")
    if (stored === "light" || stored === "dark" || stored === "auto") return stored

    return "auto"
}

/**
 * Apply the theme mode to the document element.
 */
export function applyThemeMode(mode: IThemeMode) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode

    document.documentElement.classList.remove("light", "dark")
    document.documentElement.classList.add(resolved)

    if (mode === "auto") {
        document.documentElement.removeAttribute("data-theme")
    } else {
        document.documentElement.setAttribute("data-theme", mode)
    }

    document.documentElement.style.colorScheme = resolved
}
