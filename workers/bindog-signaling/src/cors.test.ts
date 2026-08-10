import { describe, expect, it } from "vitest"
import { applyCorsHeaders, matchAllowedOrigin, parseAllowedOrigins } from "./cors"

describe("parseAllowedOrigins", () => {
    it("splits, trims, and strips trailing slashes", () => {
        expect(parseAllowedOrigins(" https://a.example/ ,http://localhost:3000/ ")).toEqual([
            "https://a.example",
            "http://localhost:3000"
        ])
    })

    it("returns an empty list for missing input", () => {
        expect(parseAllowedOrigins(undefined)).toEqual([])
        expect(parseAllowedOrigins("")).toEqual([])
    })
})

describe("matchAllowedOrigin", () => {
    it("matches an allowlisted Origin header", () => {
        const request = new Request("https://signaling.example/rooms", {
            headers: { Origin: "https://bindog.example" }
        })
        expect(matchAllowedOrigin(request, ["https://bindog.example"])).toBe("https://bindog.example")
    })

    it("rejects missing or unknown origins", () => {
        const missing = new Request("https://signaling.example/rooms")
        const unknown = new Request("https://signaling.example/rooms", {
            headers: { Origin: "https://evil.example" }
        })
        expect(matchAllowedOrigin(missing, ["https://bindog.example"])).toBeNull()
        expect(matchAllowedOrigin(unknown, ["https://bindog.example"])).toBeNull()
    })
})

describe("applyCorsHeaders", () => {
    it("returns WebSocket upgrade responses untouched", () => {
        const fakeSocket = { label: "client-ws" }
        const upgrade = {
            status: 101,
            statusText: "Switching Protocols",
            headers: new Headers(),
            body: null,
            webSocket: fakeSocket
        } as unknown as Response

        const result = applyCorsHeaders(upgrade, "https://bindog.example")

        expect(result).toBe(upgrade)
        expect(result.webSocket).toBe(fakeSocket)
        expect(result.headers.get("access-control-allow-origin")).toBeNull()
    })

    it("attaches CORS headers to JSON responses", () => {
        const response = new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" }
        })
        const result = applyCorsHeaders(response, "https://bindog.example")

        expect(result.webSocket).toBeUndefined()
        expect(result.headers.get("access-control-allow-origin")).toBe("https://bindog.example")
        expect(result.headers.get("access-control-allow-methods")).toContain("POST")
    })
})
