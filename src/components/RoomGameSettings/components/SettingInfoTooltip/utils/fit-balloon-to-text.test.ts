import { afterEach, describe, expect, it, vi } from "vitest"
import { fitBalloonToText } from "./fit-balloon-to-text"

function emptyRect(width: number): DOMRect {
    return {
        width,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: width,
        x: 0,
        y: 0,
        toJSON: () => ({})
    }
}

describe("fitBalloonToText", () => {
    afterEach(() => {
        vi.restoreAllMocks()
        document.body.replaceChildren()
    })

    it("does not force a pixel width when layout metrics are unavailable", () => {
        const balloon = document.createElement("span")
        vi.spyOn(balloon, "getBoundingClientRect").mockReturnValue(emptyRect(0))

        fitBalloonToText(balloon)

        expect(balloon.style.width).toBe("")
    })

    it("uses the unwrapped text width when it fits under the max width", () => {
        const balloon = document.createElement("span")
        vi.spyOn(balloon, "getBoundingClientRect").mockReturnValue(emptyRect(180))
        vi.spyOn(window, "getComputedStyle").mockReturnValue({ maxWidth: "320px" } as CSSStyleDeclaration)
        vi.spyOn(window, "innerWidth", "get").mockReturnValue(800)

        fitBalloonToText(balloon)

        expect(balloon.style.width).toBe("180px")
    })

    it("shrinks wrapped text to the narrowest width that keeps the same height", () => {
        const balloon = document.createElement("span")
        const minWidthWithoutExtraLine = 200

        vi.spyOn(balloon, "getBoundingClientRect").mockReturnValue(emptyRect(400))
        vi.spyOn(window, "getComputedStyle").mockReturnValue({ maxWidth: "320px" } as CSSStyleDeclaration)
        vi.spyOn(window, "innerWidth", "get").mockReturnValue(800)
        Object.defineProperty(balloon, "scrollHeight", {
            configurable: true,
            get() {
                const width = Number.parseFloat(balloon.style.width)
                if (!Number.isFinite(width) || width < minWidthWithoutExtraLine) {
                    return 40
                }
                return 20
            }
        })

        fitBalloonToText(balloon)

        expect(Number.parseFloat(balloon.style.width)).toBeCloseTo(minWidthWithoutExtraLine, 0)
    })
})
