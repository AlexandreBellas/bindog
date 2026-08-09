import { Button } from "#/components/ui/button"
import { m } from "#/paraglide/messages"
import { useEffect, useState } from "react"
import type { IThemeMode } from "./@types/mode"
import { applyThemeMode, getInitialMode } from "./utils/theme"

export default function ThemeToggle() {
    // #region States
    const [mode, setMode] = useState<IThemeMode>("auto")
    // #endregion

    // #region Effects
    /**
     * Initialize the theme mode from localStorage or default to "auto".
     */
    useEffect(() => {
        const initialMode = getInitialMode()
        setMode(initialMode)
        applyThemeMode(initialMode)
    }, [])
    /**
     * Watch for system theme changes and update the theme mode accordingly.
     */
    useEffect(() => {
        if (mode !== "auto") {
            return
        }

        const media = window.matchMedia("(prefers-color-scheme: dark)")
        const onChange = () => applyThemeMode("auto")

        media.addEventListener("change", onChange)
        return () => {
            media.removeEventListener("change", onChange)
        }
    }, [mode])
    // #endregion

    function toggleMode() {
        const nextMode: IThemeMode = mode === "light" ? "dark" : mode === "dark" ? "auto" : "light"
        setMode(nextMode)
        applyThemeMode(nextMode)
        window.localStorage.setItem("theme", nextMode)
    }

    const modeLabel = mode === "auto" ? m.theme_auto() : mode === "dark" ? m.theme_dark() : m.theme_light()

    return (
        <Button
            type="button"
            size="default"
            onClick={toggleMode}
            aria-label={m.theme_toggle_aria({ mode: modeLabel })}
            title={m.theme_toggle_aria({ mode: modeLabel })}
            className="h-9 rounded-full border border-(--chip-line) bg-(--chip-bg) px-3 text-xs font-semibold text-(--bark) shadow-[0_8px_22px_rgba(90,55,25,0.08)] transition hover:-translate-y-0.5 sm:text-sm"
        >
            {modeLabel}
        </Button>
    )
}
