import { Button } from "#/components/ui/button"
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

    const label =
        mode === "auto"
            ? "Theme mode: auto (system). Click to switch to light mode."
            : `Theme mode: ${mode}. Click to switch mode.`

    return (
        <Button
            type="button"
            onClick={toggleMode}
            aria-label={label}
            title={label}
            className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] shadow-[0_8px_22px_rgba(30,90,72,0.08)] transition hover:-translate-y-0.5"
        >
            {mode === "auto" ? "Auto" : mode === "dark" ? "Dark" : "Light"}
        </Button>
    )
}
