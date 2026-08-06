import { mockMatchMedia } from "#/tests/mocks/matchMedia"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { applyThemeMode, getInitialMode } from "./theme"

describe("getInitialMode", () => {
    afterEach(() => {
        window.localStorage.clear()
    })

    it('returns "auto" when localStorage has no theme', () => {
        expect(getInitialMode()).toBe("auto")
    })

    it("returns a stored valid theme mode", () => {
        window.localStorage.setItem("theme", "dark")
        expect(getInitialMode()).toBe("dark")
    })

    it('returns "auto" when stored value is invalid', () => {
        window.localStorage.setItem("theme", "neon")
        expect(getInitialMode()).toBe("auto")
    })
})

describe("applyThemeMode", () => {
    beforeEach(() => {
        document.documentElement.className = ""
        document.documentElement.removeAttribute("data-theme")
        document.documentElement.style.colorScheme = ""
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('applies "light" class and data-theme for light mode', () => {
        applyThemeMode("light")

        expect(document.documentElement.classList.contains("light")).toBe(true)
        expect(document.documentElement.classList.contains("dark")).toBe(false)
        expect(document.documentElement.getAttribute("data-theme")).toBe("light")
        expect(document.documentElement.style.colorScheme).toBe("light")
    })

    it('applies "dark" class and data-theme for dark mode', () => {
        applyThemeMode("dark")

        expect(document.documentElement.classList.contains("dark")).toBe(true)
        expect(document.documentElement.classList.contains("light")).toBe(false)
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
        expect(document.documentElement.style.colorScheme).toBe("dark")
    })

    it("resolves auto from prefers-color-scheme and clears data-theme", () => {
        mockMatchMedia(true)

        applyThemeMode("auto")

        expect(document.documentElement.classList.contains("dark")).toBe(true)
        expect(document.documentElement.hasAttribute("data-theme")).toBe(false)
        expect(document.documentElement.style.colorScheme).toBe("dark")
    })
})
