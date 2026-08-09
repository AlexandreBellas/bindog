interface IEnv {
    TURN_KEY_ID: string
    TURN_API_TOKEN: string
}

interface IPeerConnection {
    socket: WebSocket
    peerId: string
    nickname: string
    isLeader: boolean
}

interface IRoom {
    code: string
    name: string
    peers: Map<string, IPeerConnection>
}

interface IJoinMessage {
    type: "join"
    role: "leader" | "joiner"
    peerId: string
    nickname: string
}

interface ISignalMessage {
    type: "signal"
    to: string
    payload: unknown
}

interface IClientMessage {
    type: string
    [key: string]: unknown
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const ROOM_CODE_LENGTH = 6
const TURN_TTL_SECONDS = 86_400

const rooms = new Map<string, IRoom>()

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
 * Creates a unique room code that is not already in use.
 */
function createUniqueRoomCode(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const code = generateRoomCode()
        if (!rooms.has(code)) return code
    }

    throw new Error("Unable to allocate room code")
}

/**
 * JSON response helper.
 */
function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "content-type"
        }
    })
}

/**
 * Handles CORS preflight.
 */
function handleOptions(): Response {
    return new Response(null, {
        status: 204,
        headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "content-type",
            "access-control-max-age": "86400"
        }
    })
}

/**
 * Mints short-lived ICE servers from Cloudflare Realtime TURN.
 */
async function mintTurnCredentials(env: IEnv): Promise<Response> {
    if (!env.TURN_KEY_ID || !env.TURN_API_TOKEN) {
        return json({ error: "TURN secrets are not configured" }, 500)
    }

    const response = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.TURN_API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ ttl: TURN_TTL_SECONDS })
        }
    )

    if (!response.ok) {
        const detail = await response.text()
        return json({ error: "Failed to mint TURN credentials", detail }, 502)
    }

    const payload = await response.json()
    return json(payload)
}

/**
 * Creates a new invite room.
 */
async function createRoom(request: Request): Promise<Response> {
    let name = "Bindog room"

    try {
        const body = (await request.json()) as { name?: unknown }
        if (typeof body.name === "string" && body.name.trim().length > 0) {
            name = body.name.trim().slice(0, 48)
        }
    } catch {
        // Empty body is fine — use the default room name.
    }

    const code = createUniqueRoomCode()
    rooms.set(code, { code, name, peers: new Map() })

    return json({ code, name }, 201)
}

/**
 * Checks whether a room exists.
 */
function getRoom(codeParam: string): Response {
    const code = normalizeRoomCode(codeParam)
    const room = rooms.get(code)

    if (!room) return json({ exists: false }, 404)

    return json({ exists: true, code: room.code, name: room.name })
}

/**
 * Sends a JSON payload over a WebSocket.
 */
function send(socket: WebSocket, payload: unknown): void {
    try {
        socket.send(JSON.stringify(payload))
    } catch {
        // Peer already closed.
    }
}

/**
 * Removes a peer from a room and notifies remaining peers.
 */
function removePeer(room: IRoom, peerId: string): void {
    const peer = room.peers.get(peerId)
    if (!peer) return

    room.peers.delete(peerId)

    for (const remaining of room.peers.values()) {
        send(remaining.socket, { type: "peer-left", peerId })
    }

    if (room.peers.size === 0) {
        rooms.delete(room.code)
    }
}

/**
 * Handles an authenticated signaling WebSocket for a room.
 */
function handleRoomSocket(request: Request, codeParam: string): Response {
    const code = normalizeRoomCode(codeParam)
    const room = rooms.get(code)

    if (!room) {
        return json({ error: "Room not found" }, 404)
    }

    const upgrade = request.headers.get("Upgrade")
    if (upgrade?.toLowerCase() !== "websocket") {
        return json({ error: "Expected WebSocket upgrade" }, 426)
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    server.accept()

    let peerId: string | null = null

    server.addEventListener("message", event => {
        if (typeof event.data !== "string") return

        let message: IClientMessage
        try {
            message = JSON.parse(event.data) as IClientMessage
        } catch {
            send(server, { type: "error", message: "Invalid JSON" })
            return
        }

        if (message.type === "join") {
            const join = message as unknown as IJoinMessage

            if (!join.peerId || !join.nickname || (join.role !== "leader" && join.role !== "joiner")) {
                send(server, { type: "error", message: "Invalid join payload" })
                return
            }

            if (peerId) {
                send(server, { type: "error", message: "Already joined" })
                return
            }

            if (join.role === "leader") {
                const hasLeader = [...room.peers.values()].some(peer => peer.isLeader)
                if (hasLeader) {
                    send(server, { type: "error", message: "Room already has a leader" })
                    return
                }
            }

            if (room.peers.has(join.peerId)) {
                send(server, { type: "error", message: "Peer id already in use" })
                return
            }

            peerId = join.peerId
            const peer: IPeerConnection = {
                socket: server,
                peerId: join.peerId,
                nickname: String(join.nickname).trim().slice(0, 24) || "Player",
                isLeader: join.role === "leader"
            }

            room.peers.set(peer.peerId, peer)

            send(server, {
                type: "joined",
                peerId: peer.peerId,
                roomCode: room.code,
                roomName: room.name,
                peers: [...room.peers.values()].map(item => ({
                    id: item.peerId,
                    nickname: item.nickname,
                    isLeader: item.isLeader
                }))
            })

            for (const existing of room.peers.values()) {
                if (existing.peerId === peer.peerId) continue
                send(existing.socket, {
                    type: "peer-joined",
                    peer: {
                        id: peer.peerId,
                        nickname: peer.nickname,
                        isLeader: peer.isLeader
                    }
                })
            }

            return
        }

        if (!peerId) {
            send(server, { type: "error", message: "Join the room first" })
            return
        }

        if (message.type === "signal") {
            const signal = message as unknown as ISignalMessage
            const target = room.peers.get(signal.to)

            if (!target) {
                send(server, { type: "error", message: "Target peer not found" })
                return
            }

            send(target.socket, {
                type: "signal",
                from: peerId,
                payload: signal.payload
            })
            return
        }

        if (message.type === "leave") {
            removePeer(room, peerId)
            peerId = null
            try {
                server.close(1000, "left")
            } catch {
                // Already closed.
            }
            return
        }

        send(server, { type: "error", message: `Unknown message type: ${message.type}` })
    })

    server.addEventListener("close", () => {
        if (peerId) removePeer(room, peerId)
    })

    server.addEventListener("error", () => {
        if (peerId) removePeer(room, peerId)
    })

    return new Response(null, { status: 101, webSocket: client })
}

export default {
    async fetch(request: Request, env: IEnv): Promise<Response> {
        const url = new URL(request.url)

        if (request.method === "OPTIONS") return handleOptions()

        if (request.method === "POST" && url.pathname === "/turn/credentials") {
            return mintTurnCredentials(env)
        }

        if (request.method === "POST" && url.pathname === "/rooms") {
            return createRoom(request)
        }

        const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)$/)
        if (roomMatch) {
            const code = decodeURIComponent(roomMatch[1])

            if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
                return handleRoomSocket(request, code)
            }

            if (request.method === "GET") return getRoom(code)
        }

        return json({ error: "Not found" }, 404)
    }
}
