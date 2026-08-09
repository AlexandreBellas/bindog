import { json } from "./cors"

export interface IRateLimiter {
    limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Best-effort client IP for rate-limit keys (CF edge when deployed).
 */
export function getClientIp(request: Request): string {
    const cfIp = request.headers.get("CF-Connecting-IP")?.trim()
    if (cfIp) return cfIp

    const forwarded = request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
    if (forwarded) return forwarded

    return "unknown"
}

/**
 * Returns a 429 response when the rate limiter rejects the key.
 */
export async function enforceRateLimit(
    limiter: IRateLimiter,
    key: string
): Promise<Response | null> {
    const { success } = await limiter.limit({ key })
    if (success) return null

    return json({ error: "Rate limit exceeded" }, 429)
}

/**
 * Stable, privacy-preserving TURN analytics tag derived from the client IP.
 */
export async function turnCustomIdentifier(clientIp: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clientIp))
    const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("")
    return `bindog:${hex.slice(0, 32)}`
}
