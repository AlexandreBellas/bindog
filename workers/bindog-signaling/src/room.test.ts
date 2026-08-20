import { beforeEach, describe, expect, it } from "vitest"
import { allocateUniqueNickname, RoomDurableObject } from "./room"

class MockSocket {
    public sent: unknown[] = []
    public closed: { code: number; reason: string } | null = null
    private attachment: unknown = null

    public serializeAttachment(value: unknown): void {
        this.attachment = value
    }

    public deserializeAttachment(): unknown {
        return this.attachment
    }

    public send(data: string): void {
        this.sent.push(JSON.parse(data))
    }

    public close(code: number, reason: string): void {
        this.closed = { code, reason }
    }
}

class MockDurableObjectState {
    public storage = {
        data: new Map<string, unknown>(),
        async get<T>(key: string): Promise<T | undefined> {
            return this.data.get(key) as T | undefined
        },
        async put(values: Record<string, unknown>): Promise<void> {
            for (const [key, value] of Object.entries(values)) {
                this.data.set(key, value)
            }
        }
    }

    private sockets = new Set<MockSocket>()

    public acceptWebSocket(socket: MockSocket): void {
        this.sockets.add(socket)
    }

    public getWebSockets(): MockSocket[] {
        return [...this.sockets]
    }
}

function knownPeerIds(messages: unknown[]): Set<string> {
    const ids = new Set<string>()

    for (const message of messages) {
        const record = message as {
            type?: string
            peers?: Array<{ id: string }>
            peer?: { id: string }
        }

        if (record.type === "joined") {
            for (const peer of record.peers ?? []) ids.add(peer.id)
        }

        if (record.type === "peer-joined" && record.peer) {
            ids.add(record.peer.id)
        }
    }

    return ids
}

describe("allocateUniqueNickname", () => {
    it("keeps the requested name when free", () => {
        expect(allocateUniqueNickname(["Alpha"], "Beta")).toBe("Beta")
    })

    it("appends a numeric suffix on conflict", () => {
        expect(allocateUniqueNickname(["Alpha", "alpha"], "Alpha")).toBe("Alpha2")
    })
})

describe("RoomDurableObject peer visibility", () => {
    let ctx: MockDurableObjectState
    let room: RoomDurableObject

    beforeEach(async () => {
        ctx = new MockDurableObjectState()
        room = new RoomDurableObject(ctx as never, {})

        const init = await room.fetch(
            new Request("https://room/init", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ code: "ABCDEF", name: "Pup pack" })
            })
        )
        expect(init.status).toBe(201)
    })

    function acceptSocket(): MockSocket {
        const socket = new MockSocket()
        ctx.acceptWebSocket(socket)
        return socket
    }

    it("includes the leader in the joiner roster and notifies the leader", async () => {
        const leaderSocket = acceptSocket()
        const joinerSocket = acceptSocket()

        await room.webSocketMessage(
            leaderSocket as unknown as WebSocket,
            JSON.stringify({
                type: "join",
                role: "leader",
                peerId: "leader-1",
                nickname: "Alpha"
            })
        )

        await room.webSocketMessage(
            joinerSocket as unknown as WebSocket,
            JSON.stringify({
                type: "join",
                role: "joiner",
                peerId: "joiner-1",
                nickname: "Beta"
            })
        )

        const joinerJoined = joinerSocket.sent.find(
            message => (message as { type?: string }).type === "joined"
        ) as {
            peers: Array<{ id: string }>
        }
        const leaderPeerJoined = leaderSocket.sent.find(
            message => (message as { type?: string }).type === "peer-joined"
        ) as {
            peer: { id: string; nickname: string; isLeader: boolean }
        }

        expect(joinerJoined.peers.map(peer => peer.id).sort()).toEqual(["joiner-1", "leader-1"])
        expect(leaderPeerJoined.peer).toEqual({
            id: "joiner-1",
            nickname: "Beta",
            isLeader: false
        })
    })

    it("keeps mutual visibility when join handlers overlap", async () => {
        const leaderSocket = acceptSocket()
        const joinerSocket = acceptSocket()

        let releaseStorage: () => void = () => undefined
        const gate = new Promise<void>(resolve => {
            releaseStorage = resolve
        })
        let reads = 0
        const originalGet = ctx.storage.get.bind(ctx.storage)
        ctx.storage.get = async <T>(key: string): Promise<T | undefined> => {
            reads += 1
            // Hold the first join's storage reads so the second join is queued behind it.
            if (reads <= 2) await gate
            return originalGet<T>(key)
        }

        const leaderJoin = room.webSocketMessage(
            leaderSocket as unknown as WebSocket,
            JSON.stringify({
                type: "join",
                role: "leader",
                peerId: "leader-1",
                nickname: "Alpha"
            })
        )
        const joinerJoin = room.webSocketMessage(
            joinerSocket as unknown as WebSocket,
            JSON.stringify({
                type: "join",
                role: "joiner",
                peerId: "joiner-1",
                nickname: "Beta"
            })
        )

        releaseStorage()
        await Promise.all([leaderJoin, joinerJoin])

        const leaderIds = knownPeerIds(leaderSocket.sent)
        const joinerIds = knownPeerIds(joinerSocket.sent)

        expect(leaderIds.has("leader-1")).toBe(true)
        expect(leaderIds.has("joiner-1")).toBe(true)
        expect(joinerIds.has("leader-1")).toBe(true)
        expect(joinerIds.has("joiner-1")).toBe(true)
    })

    it("relays WebRTC signals between joined peers", async () => {
        const leaderSocket = acceptSocket()
        const joinerSocket = acceptSocket()

        await room.webSocketMessage(
            leaderSocket as unknown as WebSocket,
            JSON.stringify({
                type: "join",
                role: "leader",
                peerId: "leader-1",
                nickname: "Alpha"
            })
        )
        await room.webSocketMessage(
            joinerSocket as unknown as WebSocket,
            JSON.stringify({
                type: "join",
                role: "joiner",
                peerId: "joiner-1",
                nickname: "Beta"
            })
        )

        leaderSocket.sent.length = 0
        joinerSocket.sent.length = 0

        await room.webSocketMessage(
            leaderSocket as unknown as WebSocket,
            JSON.stringify({
                type: "signal",
                to: "joiner-1",
                payload: { kind: "offer", sdp: { type: "offer", sdp: "v=0" } }
            })
        )

        expect(joinerSocket.sent).toEqual([
            {
                type: "signal",
                from: "leader-1",
                payload: { kind: "offer", sdp: { type: "offer", sdp: "v=0" } }
            }
        ])
        expect(leaderSocket.sent).toEqual([])
    })

    it("replaces an existing peerId on reconnect without rejecting", async () => {
        const firstSocket = acceptSocket()
        const replacementSocket = acceptSocket()

        await room.webSocketMessage(
            firstSocket as unknown as WebSocket,
            JSON.stringify({
                type: "join",
                role: "leader",
                peerId: "leader-1",
                nickname: "Alpha"
            })
        )

        await room.webSocketMessage(
            replacementSocket as unknown as WebSocket,
            JSON.stringify({
                type: "join",
                role: "joiner",
                peerId: "leader-1",
                nickname: "Alpha"
            })
        )

        const joined = replacementSocket.sent.find(
            message => (message as { type?: string }).type === "joined"
        ) as {
            peers: Array<{ id: string; nickname: string; isLeader: boolean }>
        }

        expect(firstSocket.closed?.code).toBe(4000)
        expect(joined.peers).toEqual([{ id: "leader-1", nickname: "Alpha", isLeader: true }])
    })

    it("promotes a joiner to leader when the room has no leader", async () => {
        const socket = acceptSocket()

        await room.webSocketMessage(
            socket as unknown as WebSocket,
            JSON.stringify({
                type: "join",
                role: "joiner",
                peerId: "solo-1",
                nickname: "Solo"
            })
        )

        const joined = socket.sent.find(message => (message as { type?: string }).type === "joined") as {
            peers: Array<{ id: string; isLeader: boolean }>
        }

        expect(joined.peers).toEqual([{ id: "solo-1", nickname: "Solo", isLeader: true }])
    })

    async function joinLeaderAndJoiner(): Promise<{ leaderSocket: MockSocket; joinerSocket: MockSocket }> {
        const leaderSocket = acceptSocket()
        const joinerSocket = acceptSocket()

        await room.webSocketMessage(
            leaderSocket as unknown as WebSocket,
            JSON.stringify({
                type: "join",
                role: "leader",
                peerId: "leader-1",
                nickname: "Alpha"
            })
        )
        await room.webSocketMessage(
            joinerSocket as unknown as WebSocket,
            JSON.stringify({
                type: "join",
                role: "joiner",
                peerId: "joiner-1",
                nickname: "Beta"
            })
        )

        leaderSocket.sent.length = 0
        joinerSocket.sent.length = 0
        return { leaderSocket, joinerSocket }
    }

    it("marks peer-left as intentional when the player sends leave", async () => {
        const { leaderSocket, joinerSocket } = await joinLeaderAndJoiner()

        await room.webSocketMessage(joinerSocket as unknown as WebSocket, JSON.stringify({ type: "leave" }))

        expect(leaderSocket.sent).toEqual([
            {
                type: "peer-left",
                peerId: "joiner-1",
                newLeaderId: null,
                intentional: true
            }
        ])
        expect(joinerSocket.closed?.code).toBe(1000)
    })

    it("marks peer-left as unintentional when the socket closes without leave", async () => {
        const { leaderSocket, joinerSocket } = await joinLeaderAndJoiner()

        await room.webSocketClose(joinerSocket as unknown as WebSocket)

        expect(leaderSocket.sent).toEqual([
            {
                type: "peer-left",
                peerId: "joiner-1",
                newLeaderId: null,
                intentional: false
            }
        ])
    })

    it("does not broadcast a second peer-left when the socket closes after leave", async () => {
        const { leaderSocket, joinerSocket } = await joinLeaderAndJoiner()

        await room.webSocketMessage(joinerSocket as unknown as WebSocket, JSON.stringify({ type: "leave" }))
        await room.webSocketClose(joinerSocket as unknown as WebSocket)

        expect(leaderSocket.sent).toEqual([
            {
                type: "peer-left",
                peerId: "joiner-1",
                newLeaderId: null,
                intentional: true
            }
        ])
    })
})
