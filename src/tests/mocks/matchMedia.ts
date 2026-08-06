import { vi } from "vitest"

/**
 * Install a jsdom-compatible `window.matchMedia` mock.
 * Defaults to preferring light (`matches: false`).
 */
export function mockMatchMedia(matches = false) {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: vi.fn().mockReturnValue({
            matches,
            media: "(prefers-color-scheme: dark)",
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        })
    })
}
