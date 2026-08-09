import { ConnectRole, GameEngineMessageType, RoomPhase } from "#/@types/room"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import GameEngineCloudflare from "./game-engine.cloudflare"

class MockWebSocket {
    static OPEN = 1
    static CONNECTING = 0
    static CLOSING = 2
    static CLOSED = 3

    public readyState = MockWebSocket.CONNECTING
    public sent: string[] = []
    private listeners = new Map<string, Set<(event: { data?: string }) => void>>()

    public constructor(public url: string) {
        queueMicrotask(() => {
            this.readyState = MockWebSocket.OPEN
            this.emit("open")
        })
    }

    public addEventListener(type: string, listener: (event: { data?: string }) => void): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
    }

    public removeEventListener(type: string, listener: (event: { data?: string }) => void): void {
        this.listeners.get(type)?.delete(listener)
    }

    public send(data: string): void {
        this.sent.push(data)
    }

    public close(): void {
        this.readyState = MockWebSocket.CLOSED
        this.emit("close")
    }

    public emit(type: string, data?: string): void {
        for (const listener of this.listeners.get(type) ?? []) {
            listener({ data })
        }
    }
}

class MockRTCDataChannel {
    public readyState: RTCDataChannelState = "connecting"
    private listeners = new Map<string, Set<() => void>>()

    public addEventListener(type: string, listener: () => void): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
    }

    public send(): void {
        // no-op for tests
    }

    public close(): void {
        this.readyState = "closed"
    }
}

class MockRTCPeerConnection {
    public connectionState: RTCPeerConnectionState = "new"
    private listeners = new Map<string, Set<() => void>>()

    public createDataChannel(): MockRTCDataChannel {
        return new MockRTCDataChannel()
    }

    public async createOffer(): Promise<RTCSessionDescriptionInit> {
        return { type: "offer", sdp: "v=0" }
    }

    public async createAnswer(): Promise<RTCSessionDescriptionInit> {
        return { type: "answer", sdp: "v=0" }
    }

    public async setLocalDescription(): Promise<void> {
        // no-op
    }

    public async setRemoteDescription(): Promise<void> {
        // no-op
    }

    public async addIceCandidate(): Promise<void> {
        // no-op
    }

    public addEventListener(type: string, listener: () => void): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
    }

    public close(): void {
        this.connectionState = "closed"
    }
}

describe("GameEngineCloudflare", () => {
    const originalFetch = globalThis.fetch
    const originalWebSocket = globalThis.WebSocket
    const originalRtc = globalThis.RTCPeerConnection

    beforeEach(() => {
        vi.stubEnv("VITE_SIGNALING_URL", "https://signaling.test")

        globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
        globalThis.RTCPeerConnection = MockRTCPeerConnection as unknown as typeof RTCPeerConnection

        globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input)

            if (url.endsWith("/turn/credentials") && init?.method === "POST") {
                return Response.json({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] })
            }

            if (url.endsWith("/rooms") && init?.method === "POST") {
                return Response.json({ code: "ABCDEF", name: "Pup pack" }, { status: 201 })
            }

            if (url.includes("/rooms/") && (!init || init.method === "GET" || init.method === undefined)) {
                return Response.json({ exists: true, code: "ABCDEF", name: "Pup pack" })
            }

            return new Response("not found", { status: 404 })
        }) as typeof fetch
    })

    afterEach(async () => {
        globalThis.fetch = originalFetch
        globalThis.WebSocket = originalWebSocket
        globalThis.RTCPeerConnection = originalRtc
        vi.unstubAllEnvs()
        vi.useRealTimers()
    })

    it("connects as leader, tracks players, and runs countdown into playing", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const connectPromise = engine.connect({
            role: ConnectRole.Leader,
            roomName: "Pup pack",
            nickname: "Alpha"
        })

        await vi.waitFor(() => {
            const socket = (engine as unknown as { signalingSocket: MockWebSocket | null }).signalingSocket
            expect(socket?.readyState).toBe(MockWebSocket.OPEN)
        })

        const socket = (engine as unknown as { signalingSocket: MockWebSocket }).signalingSocket
        const joinPayload = JSON.parse(socket.sent[0] as string) as {
            peerId: string
            nickname: string
            role: string
        }

        socket.emit(
            "message",
            JSON.stringify({
                type: "joined",
                peerId: joinPayload.peerId,
                roomCode: "ABCDEF",
                roomName: "Pup pack",
                peers: [{ id: joinPayload.peerId, nickname: "Alpha", isLeader: true }]
            })
        )

        const state = await connectPromise
        expect(state.phase).toBe(RoomPhase.Lobby)
        expect(state.code).toBe("ABCDEF")

        socket.emit(
            "message",
            JSON.stringify({
                type: "peer-joined",
                peer: { id: "joiner-1", nickname: "Beta", isLeader: false }
            })
        )

        expect(engine.getState()?.players).toHaveLength(2)

        engine.send({ type: GameEngineMessageType.StartGame })
        expect(engine.getState()?.countdown).toBe(3)

        await vi.advanceTimersByTimeAsync(1000)
        expect(engine.getState()?.countdown).toBe(2)

        await vi.advanceTimersByTimeAsync(1000)
        expect(engine.getState()?.countdown).toBe(1)

        await vi.advanceTimersByTimeAsync(1000)
        expect(engine.getState()?.phase).toBe(RoomPhase.Playing)

        await engine.dispose()
    })

    it("rejects start-game without enough players", async () => {
        const engine = new GameEngineCloudflare()
        const connectPromise = engine.connect({
            role: ConnectRole.Leader,
            roomName: "Solo",
            nickname: "Alpha"
        })

        await vi.waitFor(() => {
            const socket = (engine as unknown as { signalingSocket: MockWebSocket | null }).signalingSocket
            expect(socket?.readyState).toBe(MockWebSocket.OPEN)
        })

        const socket = (engine as unknown as { signalingSocket: MockWebSocket }).signalingSocket
        const joinPayload = JSON.parse(socket.sent[0] as string) as { peerId: string }

        socket.emit(
            "message",
            JSON.stringify({
                type: "joined",
                peerId: joinPayload.peerId,
                roomCode: "ABCDEF",
                roomName: "Solo",
                peers: [{ id: joinPayload.peerId, nickname: "Alpha", isLeader: true }]
            })
        )

        await connectPromise

        expect(() => engine.send({ type: GameEngineMessageType.StartGame })).toThrow(/two players/i)

        await engine.dispose()
    })
})
