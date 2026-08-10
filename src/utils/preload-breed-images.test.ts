import { BREEDS } from "#/constants/breeds"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("preloadBreedImages", () => {
    const loadedSources: string[] = []

    beforeEach(() => {
        loadedSources.length = 0
        vi.resetModules()
        vi.stubGlobal(
            "Image",
            class {
                public decoding = "async"
                public onload: ((ev: Event) => void) | null = null
                public onerror: ((ev: Event) => void) | null = null
                public set src(value: string) {
                    loadedSources.push(value)
                    queueMicrotask(() => this.onload?.(new Event("load")))
                }
            }
        )
        vi.stubGlobal("requestIdleCallback", (cb: IdleRequestCallback) => {
            cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline)
            return 1
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("loads every breed image once and reuses the same promise", async () => {
        const { preloadBreedImages } = await import("./preload-breed-images")

        const first = preloadBreedImages()
        const second = preloadBreedImages()
        expect(second).toBe(first)

        await first

        expect(loadedSources).toEqual(BREEDS.map(breed => breed.imageSrc))
    })
})
