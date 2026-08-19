import RoomGameSettings from "#/components/RoomGameSettings"
import { m } from "#/paraglide/messages"
import { createDefaultRoomSettings } from "#/services/base/utils/room-settings"
import { mockMatchMedia } from "#/tests/mocks/matchMedia"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

function installDomPolyfills() {
    class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverStub)

    Object.assign(Element.prototype, {
        hasPointerCapture: () => false,
        setPointerCapture: () => undefined,
        releasePointerCapture: () => undefined,
        scrollIntoView: () => undefined
    })
}

function mockPointerMedia(canHover: boolean) {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: canHover && query.includes("hover: hover") && query.includes("pointer: fine"),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        }))
    })
}

function renderSettings() {
    return render(<RoomGameSettings settings={createDefaultRoomSettings()} editable onChange={() => undefined} />)
}

describe("RoomGameSettings info explanations", () => {
    beforeEach(() => {
        installDomPolyfills()
    })

    afterEach(() => {
        cleanup()
        mockMatchMedia()
        vi.unstubAllGlobals()
    })

    it("opens the setting explanation on tap when the pointer cannot hover", async () => {
        mockPointerMedia(false)
        renderSettings()

        expect(screen.queryByText(m.setting_full_grid_tooltip())).toBeNull()

        fireEvent.click(screen.getAllByRole("button", { name: m.setting_info_aria() })[0])

        expect(await screen.findByText(m.setting_full_grid_tooltip())).toBeTruthy()
    })

    it("opens each setting explanation independently on tap", async () => {
        mockPointerMedia(false)
        renderSettings()

        const infoButtons = screen.getAllByRole("button", { name: m.setting_info_aria() })

        fireEvent.click(infoButtons[1])
        expect(await screen.findByText(m.setting_hard_mode_tooltip())).toBeTruthy()
        expect(screen.queryByText(m.setting_full_grid_tooltip())).toBeNull()

        fireEvent.click(infoButtons[2])
        expect(await screen.findByText(m.setting_limit_bindogs_tooltip())).toBeTruthy()
    })

    it("opens the setting explanation on hover when a fine pointer can hover", async () => {
        mockPointerMedia(true)
        renderSettings()

        expect(screen.queryByText(m.setting_full_grid_tooltip())).toBeNull()

        fireEvent.pointerMove(screen.getAllByRole("button", { name: m.setting_info_aria() })[0], {
            pointerType: "mouse"
        })

        await waitFor(() => {
            expect(screen.getByRole("tooltip").textContent).toContain(m.setting_full_grid_tooltip())
        })
    })

    it("does not toggle a setting when its info control is activated on a touch device", () => {
        mockPointerMedia(false)
        const onChange = vi.fn()
        render(<RoomGameSettings settings={createDefaultRoomSettings()} editable onChange={onChange} />)

        fireEvent.click(screen.getAllByRole("button", { name: m.setting_info_aria() })[0])

        expect(onChange).not.toHaveBeenCalled()
        expect(screen.getByRole("switch", { name: m.setting_full_grid_label() }).getAttribute("data-state")).toBe(
            "unchecked"
        )
    })
})
