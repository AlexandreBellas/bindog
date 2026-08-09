import { describe, expect, it } from "vitest"
import { getLocaleDisplayName } from "./get-locale-display-name"

describe("getLocaleDisplayName", () => {
    it("returns a non-empty label for each supported locale", () => {
        expect(getLocaleDisplayName("pt-BR").length).toBeGreaterThan(0)
        expect(getLocaleDisplayName("en-US").length).toBeGreaterThan(0)
        expect(getLocaleDisplayName("fr-FR").length).toBeGreaterThan(0)
        expect(getLocaleDisplayName("it-IT").length).toBeGreaterThan(0)
        expect(getLocaleDisplayName("de-DE").length).toBeGreaterThan(0)
        expect(getLocaleDisplayName("ko-KR").length).toBeGreaterThan(0)
    })
})
