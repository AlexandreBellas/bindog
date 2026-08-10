/**
 * Parses comma-separated ALLOWED_ORIGINS into a normalized origin list.
 */
export function parseAllowedOrigins(raw: string | undefined): string[] {
    if (!raw || raw.trim().length === 0) return []

    return raw
        .split(",")
        .map(origin => origin.trim().replace(/\/$/, ""))
        .filter(origin => origin.length > 0)
}

/**
 * Returns the request Origin when it is present in the allowlist; otherwise null.
 */
export function matchAllowedOrigin(request: Request, allowedOrigins: string[]): string | null {
    const origin = request.headers.get("Origin")?.trim().replace(/\/$/, "") ?? null
    if (!origin) return null
    if (!allowedOrigins.includes(origin)) return null
    return origin
}

/**
 * Builds a JSON response without CORS headers (caller applies CORS).
 */
export function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json"
        }
    })
}

/**
 * Handles CORS preflight for an allowed origin.
 */
export function handleOptions(allowedOrigin: string): Response {
    return new Response(null, {
        status: 204,
        headers: {
            "access-control-allow-origin": allowedOrigin,
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "content-type",
            "access-control-max-age": "86400",
            vary: "Origin"
        }
    })
}

/**
 * Copies a response and attaches allowlisted CORS headers when applicable.
 * Callers must not pass WebSocket upgrade responses — those must be returned as-is.
 */
export function applyCorsHeaders(response: Response, allowedOrigin: string | null): Response {
    if (response.webSocket) {
        return response
    }

    const headers = new Headers(response.headers)
    headers.delete("access-control-allow-origin")
    headers.delete("access-control-allow-methods")
    headers.delete("access-control-allow-headers")
    headers.delete("access-control-max-age")

    if (allowedOrigin) {
        headers.set("access-control-allow-origin", allowedOrigin)
        headers.set("access-control-allow-methods", "GET, POST, OPTIONS")
        headers.set("access-control-allow-headers", "content-type")
        headers.set("vary", "Origin")
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    })
}
