import { applyCorsHeaders, handleOptions, json, matchAllowedOrigin, parseAllowedOrigins } from "./cors"
import type { IRateLimiter } from "./guardrails"
import { enforceRateLimit, getClientIp, turnCustomIdentifier } from "./guardrails"
import { RoomDurableObject } from "./room"

interface IEnv {
    TURN_KEY_ID: string
    TURN_API_TOKEN: string
    ALLOWED_ORIGINS: string
    ROOMS: DurableObjectNamespace
    TURN_RATE_LIMITER: IRateLimiter
    ROOM_RATE_LIMITER: IRateLimiter
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const ROOM_CODE_LENGTH = 6
/** Short-lived TURN credentials — long enough for a match, short enough to limit abuse. */
const TURN_TTL_SECONDS = 45 * 60

/**
 * Generates a short invite code that avoids ambiguous characters.
 */
function generateRoomCode(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH))
    let code = ""

    for (const byte of bytes) {
        code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]
    }

    return code
}

/**
 * Normalizes a room code for lookup.
 */
function normalizeRoomCode(code: string): string {
    return code.trim().toUpperCase()
}

/**
 * Public STUN-only ICE servers used when TURN secrets are unavailable
 * (typical for local `wrangler dev` without a `.dev.vars` file).
 * Enough for same-LAN peers; cross-NAT needs real TURN credentials.
 */
const FALLBACK_ICE_SERVERS = [{ urls: "stun:stun.cloudflare.com:3478" }, { urls: "stun:stun.l.google.com:19302" }]

/**
 * Mints short-lived ICE servers from Cloudflare Realtime TURN.
 * Falls back to public STUN when Worker secrets are not configured.
 */
async function mintTurnCredentials(env: IEnv, clientIp: string): Promise<Response> {
    if (!env.TURN_KEY_ID || !env.TURN_API_TOKEN) {
        return json({ iceServers: FALLBACK_ICE_SERVERS })
    }

    try {
        const customIdentifier = await turnCustomIdentifier(clientIp)
        const response = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${env.TURN_API_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ ttl: TURN_TTL_SECONDS, customIdentifier })
            }
        )

        if (!response.ok) {
            const detail = await response.text()
            return json({ error: "Failed to mint TURN credentials", detail }, 502)
        }

        const payload = await response.json()
        return json(payload)
    } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error"
        return json({ error: "Failed to mint TURN credentials", detail }, 502)
    }
}

/**
 * Returns the Durable Object stub for a room code.
 */
function getRoomStub(env: IEnv, code: string): DurableObjectStub {
    return env.ROOMS.get(env.ROOMS.idFromName(code))
}

/**
 * Creates a new invite room inside a Durable Object.
 */
async function createRoom(request: Request, env: IEnv): Promise<Response> {
    let name = "Bindog room"

    try {
        const body = (await request.json()) as { name?: unknown }
        if (typeof body.name === "string" && body.name.trim().length > 0) {
            name = body.name.trim().slice(0, 48)
        }
    } catch {
        // Empty body is fine — use the default room name.
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
        const code = generateRoomCode()
        const stub = getRoomStub(env, code)
        const response = await stub.fetch("https://room/init", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, name })
        })

        if (response.status === 201) return response
        if (response.status !== 409) return response
    }

    return json({ error: "Unable to allocate room code" }, 500)
}

/**
 * Checks whether a room exists.
 */
async function getRoom(env: IEnv, codeParam: string): Promise<Response> {
    const code = normalizeRoomCode(codeParam)
    const stub = getRoomStub(env, code)
    return stub.fetch("https://room/info", { method: "GET" })
}

/**
 * Upgrades to the room Durable Object's signaling WebSocket.
 */
async function handleRoomSocket(request: Request, env: IEnv, codeParam: string): Promise<Response> {
    const code = normalizeRoomCode(codeParam)
    const infoResponse = await getRoom(env, code)
    if (!infoResponse.ok) return json({ error: "Room not found" }, 404)

    const upgrade = request.headers.get("Upgrade")
    if (upgrade?.toLowerCase() !== "websocket") {
        return json({ error: "Expected WebSocket upgrade" }, 426)
    }

    return getRoomStub(env, code).fetch(request)
}

/**
 * Routes a request after CORS / origin checks.
 */
async function handleRequest(request: Request, env: IEnv): Promise<Response> {
    const url = new URL(request.url)
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS)
    const allowedOrigin = matchAllowedOrigin(request, allowedOrigins)

    if (request.method === "OPTIONS") {
        if (!allowedOrigin) return json({ error: "Origin not allowed" }, 403)
        return handleOptions(allowedOrigin)
    }

    // Browser clients always send Origin on cross-origin calls; require an allowlisted one.
    if (!allowedOrigin) {
        return json({ error: "Origin not allowed" }, 403)
    }

    const clientIp = getClientIp(request)

    if (request.method === "POST" && url.pathname === "/turn/credentials") {
        const limited = await enforceRateLimit(env.TURN_RATE_LIMITER, clientIp)
        if (limited) return limited
        return mintTurnCredentials(env, clientIp)
    }

    if (request.method === "POST" && url.pathname === "/rooms") {
        const limited = await enforceRateLimit(env.ROOM_RATE_LIMITER, clientIp)
        if (limited) return limited
        return createRoom(request, env)
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)$/)
    if (roomMatch) {
        const code = decodeURIComponent(roomMatch[1])

        if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
            const limited = await enforceRateLimit(env.ROOM_RATE_LIMITER, `ws:${clientIp}`)
            if (limited) return limited
            return handleRoomSocket(request, env, code)
        }

        if (request.method === "GET") {
            const limited = await enforceRateLimit(env.ROOM_RATE_LIMITER, `get:${clientIp}`)
            if (limited) return limited
            return getRoom(env, code)
        }
    }

    return json({ error: "Not found" }, 404)
}

export { RoomDurableObject }

export default {
    async fetch(request: Request, env: IEnv): Promise<Response> {
        const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS)
        const allowedOrigin = matchAllowedOrigin(request, allowedOrigins)
        const response = await handleRequest(request, env)

        // WebSocket upgrade responses (status 101) must be returned untouched.
        // Rewriting them to attach CORS headers is unsupported in workerd and can
        // break the upgraded connection — especially across longer network paths.
        if (response.webSocket) {
            return response
        }

        return applyCorsHeaders(response, allowedOrigin)
    }
}
