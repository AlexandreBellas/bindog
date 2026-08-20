interface IPeerAttachment {
    peerId: string
    nickname: string
    isLeader: boolean
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

/**
 * Durable Object that owns one invite room and all of its signaling sockets.
 * Cross-peer sends only work reliably inside a single DO instance.
 */
export class RoomDurableObject {
    private readonly ctx: DurableObjectState
    /** Serializes joins so concurrent finishJoin calls cannot both observe an empty roster. */
    private joinChain: Promise<void> = Promise.resolve()

    public constructor(ctx: DurableObjectState, _env: unknown) {
        this.ctx = ctx
    }

    /**
     * HTTP + WebSocket entrypoint for this room.
     */
    public async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url)

        if (request.method === "POST" && url.pathname === "/init") {
            return this.initRoom(request)
        }

        if (request.method === "GET" && url.pathname === "/info") {
            return this.getInfo()
        }

        if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
            return this.acceptSignalingSocket()
        }

        return json({ error: "Not found" }, 404)
    }

    /**
     * Hibernation API: inbound WebSocket message.
     */
    public async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
        if (typeof raw !== "string") return

        let message: IClientMessage
        try {
            message = JSON.parse(raw) as IClientMessage
        } catch {
            send(socket, { type: "error", message: "Invalid JSON" })
            return
        }

        if (message.type === "join") {
            // Must await: hibernation may continue as soon as this handler settles.
            // Fire-and-forget join races let two peers each see an empty roster.
            await this.handleJoin(socket, message as unknown as IJoinMessage)
            return
        }

        const attachment = getAttachment(socket)
        if (!attachment) {
            send(socket, { type: "error", message: "Join the room first" })
            return
        }

        if (message.type === "signal") {
            this.handleSignal(attachment.peerId, message as unknown as ISignalMessage)
            return
        }

        if (message.type === "leave") {
            this.removePeer(socket, true)
            try {
                socket.close(1000, "left")
            } catch {
                // Already closed.
            }
            return
        }

        send(socket, { type: "error", message: `Unknown message type: ${message.type}` })
    }

    /**
     * Hibernation API: WebSocket closed.
     */
    public async webSocketClose(socket: WebSocket): Promise<void> {
        this.removePeer(socket)
        try {
            socket.close(1000, "closed")
        } catch {
            // Already closed.
        }
    }

    /**
     * Hibernation API: WebSocket error.
     */
    public async webSocketError(socket: WebSocket): Promise<void> {
        this.removePeer(socket)
        try {
            socket.close(1011, "error")
        } catch {
            // Already closed.
        }
    }

    /**
     * Initializes room metadata once when the invite code is created.
     */
    private async initRoom(request: Request): Promise<Response> {
        const existingName = await this.ctx.storage.get<string>("name")
        if (existingName) {
            return json({ error: "Room already exists" }, 409)
        }

        let name = "Bindog room"
        let code = ""

        try {
            const body = (await request.json()) as { name?: unknown; code?: unknown }
            if (typeof body.name === "string" && body.name.trim().length > 0) {
                name = body.name.trim().slice(0, 48)
            }
            if (typeof body.code === "string") {
                code = body.code.trim().toUpperCase()
            }
        } catch {
            return json({ error: "Invalid body" }, 400)
        }

        if (!code) return json({ error: "Room code required" }, 400)

        await this.ctx.storage.put({ name, code })
        return json({ code, name }, 201)
    }

    /**
     * Returns whether this room has been initialized.
     */
    private async getInfo(): Promise<Response> {
        const name = await this.ctx.storage.get<string>("name")
        const code = await this.ctx.storage.get<string>("code")

        if (!name || !code) return json({ exists: false }, 404)

        return json({ exists: true, code, name })
    }

    /**
     * Accepts a signaling WebSocket into this room via hibernation.
     */
    private acceptSignalingSocket(): Response {
        const pair = new WebSocketPair()
        this.ctx.acceptWebSocket(pair[1])
        return new Response(null, { status: 101, webSocket: pair[0] })
    }

    /**
     * Handles a join message and notifies existing peers.
     */
    private async handleJoin(socket: WebSocket, join: IJoinMessage): Promise<void> {
        if (getAttachment(socket)) {
            send(socket, { type: "error", message: "Already joined" })
            return
        }

        if (!join.peerId || !join.nickname || (join.role !== "leader" && join.role !== "joiner")) {
            send(socket, { type: "error", message: "Invalid join payload" })
            return
        }

        await this.enqueueJoin(socket, join)
    }

    /**
     * Runs finishJoin strictly one-at-a-time for this room.
     */
    private enqueueJoin(socket: WebSocket, join: IJoinMessage): Promise<void> {
        const run = this.joinChain.then(() => this.finishJoin(socket, join))
        this.joinChain = run.then(
            () => undefined,
            () => undefined
        )
        return run
    }

    /**
     * Completes join after loading room metadata from storage.
     */
    private async finishJoin(socket: WebSocket, join: IJoinMessage): Promise<void> {
        const name = await this.ctx.storage.get<string>("name")
        const code = await this.ctx.storage.get<string>("code")

        if (!name || !code) {
            send(socket, { type: "error", message: "Room not found" })
            try {
                socket.close(1008, "Room not found")
            } catch {
                // Ignore.
            }
            return
        }

        if (getAttachment(socket)) {
            send(socket, { type: "error", message: "Already joined" })
            return
        }

        const peers = this.listPeers()
        const existingSocket = this.findSocketByPeerId(join.peerId)
        const isReconnect = Boolean(existingSocket && existingSocket !== socket)

        // Same peerId rejoining (reload / app switch): silently replace the old socket.
        if (isReconnect && existingSocket) {
            existingSocket.serializeAttachment(null)
            try {
                existingSocket.close(4000, "replaced")
            } catch {
                // Already closed.
            }
        } else if (peers.some(peer => peer.peerId === join.peerId)) {
            send(socket, { type: "error", message: "Peer id already in use" })
            return
        }

        const rosterWithoutSelf = this.listPeers().filter(peer => peer.peerId !== join.peerId)
        const hasLeader = rosterWithoutSelf.some(peer => peer.isLeader)

        if (join.role === "leader" && hasLeader) {
            send(socket, { type: "error", message: "Room already has a leader" })
            return
        }

        // Reuse the previous nickname on reconnect so uniquify does not append "2".
        const previous = isReconnect ? peers.find(peer => peer.peerId === join.peerId) : undefined
        const nickname = previous
            ? previous.nickname
            : allocateUniqueNickname(
                  rosterWithoutSelf.map(peer => peer.nickname),
                  String(join.nickname)
              )

        // Empty rooms (everyone left / reloaded) need a leader so the lobby can start again.
        const isLeader = join.role === "leader" || !hasLeader

        const peer: IPeerAttachment = {
            peerId: join.peerId,
            nickname,
            isLeader
        }

        socket.serializeAttachment(peer)

        const roster = [...rosterWithoutSelf, peer]

        send(socket, {
            type: "joined",
            peerId: peer.peerId,
            roomCode: code,
            roomName: name,
            peers: roster.map(item => ({
                id: item.peerId,
                nickname: item.nickname,
                isLeader: item.isLeader
            }))
        })

        for (const existing of this.ctx.getWebSockets()) {
            if (existing === socket) continue
            if (!getAttachment(existing)) continue
            send(existing, {
                type: "peer-joined",
                peer: {
                    id: peer.peerId,
                    nickname: peer.nickname,
                    isLeader: peer.isLeader
                }
            })
        }
    }

    /**
     * Relays a WebRTC signaling payload to the target peer.
     */
    private handleSignal(fromPeerId: string, signal: ISignalMessage): void {
        const target = this.findSocketByPeerId(signal.to)
        if (!target) {
            const sender = this.findSocketByPeerId(fromPeerId)
            if (sender) send(sender, { type: "error", message: "Target peer not found" })
            return
        }

        send(target, {
            type: "signal",
            from: fromPeerId,
            payload: signal.payload
        })
    }

    /**
     * Removes a peer, transfers leadership when needed, and notifies survivors.
     * `intentional` is true only for an explicit UI leave message.
     */
    private removePeer(socket: WebSocket, intentional = false): void {
        const attachment = getAttachment(socket)
        if (!attachment) return

        // Clear attachment first so listPeers / getWebSockets loops skip this socket.
        socket.serializeAttachment(null)

        const remainingSockets = this.ctx.getWebSockets().filter(item => item !== socket)
        let newLeaderId: string | null = null

        if (attachment.isLeader && remainingSockets.length > 0) {
            const nextSocket = remainingSockets[0]
            const nextAttachment = getAttachment(nextSocket)
            if (nextAttachment) {
                const promoted: IPeerAttachment = { ...nextAttachment, isLeader: true }
                nextSocket.serializeAttachment(promoted)
                newLeaderId = promoted.peerId
            }
        }

        for (const remaining of remainingSockets) {
            send(remaining, {
                type: "peer-left",
                peerId: attachment.peerId,
                newLeaderId,
                intentional
            })
        }
    }

    /**
     * Returns attachments for every joined socket in this room.
     */
    private listPeers(): IPeerAttachment[] {
        const peers: IPeerAttachment[] = []

        for (const socket of this.ctx.getWebSockets()) {
            const attachment = getAttachment(socket)
            if (attachment) peers.push(attachment)
        }

        return peers
    }

    /**
     * Finds the socket for a peer id, if still connected.
     */
    private findSocketByPeerId(peerId: string): WebSocket | null {
        for (const socket of this.ctx.getWebSockets()) {
            const attachment = getAttachment(socket)
            if (attachment?.peerId === peerId) return socket
        }

        return null
    }
}

/**
 * Allocates a room-unique nickname, appending 2, 3, … on conflict.
 */
export function allocateUniqueNickname(existing: string[], requested: string): string {
    const base = requested.trim().slice(0, 24) || "Player"
    const taken = new Set(existing.map(nickname => nickname.toLowerCase()))

    if (!taken.has(base.toLowerCase())) return base

    for (let n = 2; n < 1000; n += 1) {
        const suffix = String(n)
        const truncatedBase = base.slice(0, Math.max(1, 24 - suffix.length))
        const candidate = `${truncatedBase}${suffix}`
        if (!taken.has(candidate.toLowerCase())) return candidate
    }

    return `${base.slice(0, 20)}${Date.now().toString(36).slice(-4)}`
}

/**
 * Reads a peer attachment from a hibernatable WebSocket.
 */
function getAttachment(socket: WebSocket): IPeerAttachment | null {
    const value = socket.deserializeAttachment() as IPeerAttachment | null
    if (!value || typeof value !== "object") return null
    if (typeof value.peerId !== "string" || typeof value.nickname !== "string") return null
    return {
        peerId: value.peerId,
        nickname: value.nickname,
        isLeader: Boolean(value.isLeader)
    }
}

/**
 * JSON response helper (CORS is applied by the Worker entrypoint).
 */
function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json"
        }
    })
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
