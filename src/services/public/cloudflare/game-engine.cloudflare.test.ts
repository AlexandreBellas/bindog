import { ConnectRole, GameEngineMessageType, RoomPhase } from "#/@types/room"
import type { IRoomState } from "#/@types/room"
import type { IGameState } from "#/@types/game"
import { ANNOUNCE_INTERVAL_MS } from "#/constants/announce"
import { WILD_CELL_INDEX } from "#/constants/breeds"
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
    public setConfiguration = vi.fn()
    public createOffer = vi.fn(async (): Promise<RTCSessionDescriptionInit> => ({ type: "offer", sdp: "v=0" }))
    public setRemoteDescription = vi.fn(async (): Promise<void> => {
        // no-op
    })
    public addIceCandidate = vi.fn(async (): Promise<void> => {
        // no-op
    })
    private listeners = new Map<string, Set<() => void>>()

    public createDataChannel(): MockRTCDataChannel {
        return new MockRTCDataChannel()
    }

    public async createAnswer(): Promise<RTCSessionDescriptionInit> {
        return { type: "answer", sdp: "v=0" }
    }

    public async setLocalDescription(): Promise<void> {
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

type EngineInternals = {
    signalingSocket: MockWebSocket | null
    sessionUsedTurn: boolean
    state: IRoomState | null
    peers: Map<
        string,
        {
            peerId: string
            connection: MockRTCPeerConnection
            channel: MockRTCDataChannel | null
            pendingIceCandidates: RTCIceCandidateInit[]
            hasRemoteDescription: boolean
        }
    >
    pendingIceByPeer: Map<string, RTCIceCandidateInit[]>
    signalChain: Promise<void>
}

async function connectLeaderWithJoiner(engine: GameEngineCloudflare): Promise<string> {
    const connectPromise = engine.connect({
        role: ConnectRole.Leader,
        roomName: "Pup pack",
        nickname: "Alpha"
    })

    await vi.waitFor(() => {
        const socket = (engine as unknown as EngineInternals).signalingSocket
        expect(socket?.readyState).toBe(MockWebSocket.OPEN)
    })

    const socket = (engine as unknown as EngineInternals).signalingSocket!
    const joinPayload = JSON.parse(socket.sent[0] as string) as { peerId: string }

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

    await connectPromise

    socket.emit(
        "message",
        JSON.stringify({
            type: "peer-joined",
            peer: { id: "joiner-1", nickname: "Beta", isLeader: false }
        })
    )

    return joinPayload.peerId
}

async function startPlaying(engine: GameEngineCloudflare): Promise<void> {
    engine.send({ type: GameEngineMessageType.StartGame })
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(engine.getState()?.phase).toBe(RoomPhase.Playing)
    expect(engine.getState()?.game).not.toBeNull()
}

function coverCenterRow(game: IGameState, playerId: string): string[] {
    const board = game.boards[playerId]
    if (!board) throw new Error("missing board")
    return board.cells.filter((cell, index): cell is string => {
        const row = Math.floor(index / 5)
        return row === 2 && cell !== null
    })
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
        await connectLeaderWithJoiner(engine)
        await startPlaying(engine)

        const game = engine.getState()?.game
        expect(game?.boards).toBeTruthy()
        expect(game?.currentBreedId).toBeTruthy()
        expect(game?.announced).toHaveLength(1)
        expect(game?.boards[engine.getState()!.localPlayerId]?.cells[WILD_CELL_INDEX]).toBeNull()

        await engine.dispose()
    })

    it("auto-announces a breed every 5 seconds while playing", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        await connectLeaderWithJoiner(engine)
        await startPlaying(engine)

        expect(engine.getState()?.game?.announced).toHaveLength(1)
        const firstRemaining = engine.getState()?.game?.callOrder.length ?? 0

        await vi.advanceTimersByTimeAsync(ANNOUNCE_INTERVAL_MS)
        expect(engine.getState()?.game?.announced).toHaveLength(2)
        expect(engine.getState()?.game?.callOrder.length).toBe(firstRemaining - 1)

        await vi.advanceTimersByTimeAsync(ANNOUNCE_INTERVAL_MS)
        expect(engine.getState()?.game?.announced).toHaveLength(3)

        await engine.dispose()
    })

    it("marks fake bingo claims without ending the round", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        await connectLeaderWithJoiner(engine)
        await startPlaying(engine)

        engine.send({ type: GameEngineMessageType.ClaimBingo })

        const state = engine.getState()
        expect(state?.phase).toBe(RoomPhase.Playing)
        expect(state?.game?.fakeBingoPlayerId).toBe(state?.localPlayerId)
        expect(state?.game?.winnerId).toBeNull()

        await engine.dispose()
    })

    it("ends the round on a legitimate bingo claim", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        await startPlaying(engine)

        const internals = engine as unknown as EngineInternals
        const game = internals.state!.game!
        const needed = coverCenterRow(game, leaderId)

        internals.state = {
            ...internals.state!,
            game: {
                ...game,
                announced: needed,
                callOrder: game.callOrder.filter(id => !needed.includes(id)),
                fakeBingoPlayerId: null
            }
        }

        engine.send({ type: GameEngineMessageType.ClaimBingo })

        const state = engine.getState()
        expect(state?.phase).toBe(RoomPhase.Ended)
        expect(state?.game?.winnerId).toBe(leaderId)
        expect(state?.game?.progress?.length).toBe(2)

        await engine.dispose()
    })

    it("restarts a finished round and remints TURN when relay was used", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        await startPlaying(engine)

        const internals = engine as unknown as EngineInternals
        internals.sessionUsedTurn = true

        const game = internals.state!.game!
        const needed = coverCenterRow(game, leaderId)
        internals.state = {
            ...internals.state!,
            game: {
                ...game,
                announced: needed,
                callOrder: game.callOrder.filter(id => !needed.includes(id))
            }
        }
        engine.send({ type: GameEngineMessageType.ClaimBingo })
        expect(engine.getState()?.phase).toBe(RoomPhase.Ended)

        const turnCallsBefore = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(call =>
            String(call[0]).endsWith("/turn/credentials")
        ).length

        // Ensure a peer connection exists for ICE restart.
        const peerConnection = new MockRTCPeerConnection()
        internals.peers.set("joiner-1", {
            peerId: "joiner-1",
            connection: peerConnection,
            channel: new MockRTCDataChannel(),
            pendingIceCandidates: [],
            hasRemoteDescription: true
        })

        engine.send({ type: GameEngineMessageType.RestartGame })
        await vi.advanceTimersByTimeAsync(0)
        await Promise.resolve()
        await Promise.resolve()

        const turnCallsAfter = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(call =>
            String(call[0]).endsWith("/turn/credentials")
        ).length

        expect(turnCallsAfter).toBeGreaterThan(turnCallsBefore)
        expect(peerConnection.setConfiguration).toHaveBeenCalled()
        expect(peerConnection.createOffer).toHaveBeenCalledWith({ iceRestart: true })

        await vi.waitFor(() => {
            expect(engine.getState()?.phase).toBe(RoomPhase.Playing)
        })
        expect(engine.getState()?.game?.winnerId).toBeNull()
        expect(engine.getState()?.game?.announced.length).toBeGreaterThanOrEqual(1)

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
            const socket = (engine as unknown as EngineInternals).signalingSocket
            expect(socket?.readyState).toBe(MockWebSocket.OPEN)
        })

        const socket = (engine as unknown as EngineInternals).signalingSocket!
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

    it("lets the leader and joiner see each other from signaling roster events", async () => {
        const leader = new GameEngineCloudflare()
        const joiner = new GameEngineCloudflare()

        const leaderConnect = leader.connect({
            role: ConnectRole.Leader,
            roomName: "Pup pack",
            nickname: "Alpha"
        })

        await vi.waitFor(() => {
            expect((leader as unknown as EngineInternals).signalingSocket?.readyState).toBe(MockWebSocket.OPEN)
        })

        const leaderSocket = (leader as unknown as EngineInternals).signalingSocket!
        const leaderJoin = JSON.parse(leaderSocket.sent[0] as string) as { peerId: string }

        leaderSocket.emit(
            "message",
            JSON.stringify({
                type: "joined",
                peerId: leaderJoin.peerId,
                roomCode: "ABCDEF",
                roomName: "Pup pack",
                peers: [{ id: leaderJoin.peerId, nickname: "Alpha", isLeader: true }]
            })
        )
        await leaderConnect

        const joinerConnect = joiner.connect({
            role: ConnectRole.Joiner,
            roomCode: "ABCDEF",
            nickname: "Beta"
        })

        await vi.waitFor(() => {
            expect((joiner as unknown as EngineInternals).signalingSocket?.readyState).toBe(MockWebSocket.OPEN)
        })

        const joinerSocket = (joiner as unknown as EngineInternals).signalingSocket!
        const joinerJoin = JSON.parse(joinerSocket.sent[0] as string) as { peerId: string }

        // Room Durable Object behavior: joiner gets full roster; leader gets peer-joined.
        joinerSocket.emit(
            "message",
            JSON.stringify({
                type: "joined",
                peerId: joinerJoin.peerId,
                roomCode: "ABCDEF",
                roomName: "Pup pack",
                peers: [
                    { id: leaderJoin.peerId, nickname: "Alpha", isLeader: true },
                    { id: joinerJoin.peerId, nickname: "Beta", isLeader: false }
                ]
            })
        )
        await joinerConnect

        leaderSocket.emit(
            "message",
            JSON.stringify({
                type: "peer-joined",
                peer: { id: joinerJoin.peerId, nickname: "Beta", isLeader: false }
            })
        )

        expect(leader.getState()?.players.map(player => player.id).sort()).toEqual(
            [leaderJoin.peerId, joinerJoin.peerId].sort()
        )
        expect(joiner.getState()?.players.map(player => player.id).sort()).toEqual(
            [leaderJoin.peerId, joinerJoin.peerId].sort()
        )

        await leader.dispose()
        await joiner.dispose()
    })

    it("queues trickle ICE until remote description is applied", async () => {
        const engine = new GameEngineCloudflare()
        await connectLeaderWithJoiner(engine)

        const internals = engine as unknown as EngineInternals
        const socket = internals.signalingSocket!

        let releaseRemote: () => void = () => undefined
        const remoteGate = new Promise<void>(resolve => {
            releaseRemote = resolve
        })

        const connection = new MockRTCPeerConnection()
        connection.setRemoteDescription = vi.fn(async () => {
            await remoteGate
        })
        connection.addIceCandidate = vi.fn(async () => {
            // tracked
        })

        internals.peers.set("joiner-1", {
            peerId: "joiner-1",
            connection,
            channel: new MockRTCDataChannel(),
            pendingIceCandidates: [],
            hasRemoteDescription: false
        })

        const earlyCandidate = {
            candidate: "candidate:1 1 UDP 2122252543 1.2.3.4 12345 typ relay",
            sdpMid: "0"
        }

        socket.emit(
            "message",
            JSON.stringify({
                type: "signal",
                from: "joiner-1",
                payload: { kind: "ice", candidate: earlyCandidate }
            })
        )

        await Promise.resolve()
        expect(internals.peers.get("joiner-1")?.pendingIceCandidates).toEqual([earlyCandidate])
        expect(connection.addIceCandidate).not.toHaveBeenCalled()

        socket.emit(
            "message",
            JSON.stringify({
                type: "signal",
                from: "joiner-1",
                payload: { kind: "answer", sdp: { type: "answer", sdp: "v=0" } }
            })
        )

        await Promise.resolve()
        expect(connection.setRemoteDescription).toHaveBeenCalled()
        expect(connection.addIceCandidate).not.toHaveBeenCalled()

        releaseRemote()
        await internals.signalChain

        expect(connection.addIceCandidate).toHaveBeenCalledWith(earlyCandidate)
        expect(internals.peers.get("joiner-1")?.pendingIceCandidates).toEqual([])
        expect(internals.peers.get("joiner-1")?.hasRemoteDescription).toBe(true)

        await engine.dispose()
    })

    it("retains ICE candidates that arrive before the peer link exists", async () => {
        const engine = new GameEngineCloudflare()
        await connectLeaderWithJoiner(engine)

        const internals = engine as unknown as EngineInternals
        const socket = internals.signalingSocket!
        internals.peers.delete("joiner-1")

        const earlyCandidate = {
            candidate: "candidate:2 1 UDP 1685987071 5.6.7.8 3478 typ relay",
            sdpMid: "0"
        }

        socket.emit(
            "message",
            JSON.stringify({
                type: "signal",
                from: "stranger-9",
                payload: { kind: "ice", candidate: earlyCandidate }
            })
        )

        await internals.signalChain
        expect(internals.pendingIceByPeer.get("stranger-9")).toEqual([earlyCandidate])

        let releaseRemote: () => void = () => undefined
        const remoteGate = new Promise<void>(resolve => {
            releaseRemote = resolve
        })

        const originalRtc = globalThis.RTCPeerConnection
        const created: MockRTCPeerConnection[] = []
        globalThis.RTCPeerConnection = class extends MockRTCPeerConnection {
            public constructor() {
                super()
                this.setRemoteDescription = vi.fn(async () => {
                    await remoteGate
                })
                this.addIceCandidate = vi.fn(async () => {
                    // tracked
                })
                created.push(this)
            }
        } as unknown as typeof RTCPeerConnection

        socket.emit(
            "message",
            JSON.stringify({
                type: "signal",
                from: "stranger-9",
                payload: { kind: "offer", sdp: { type: "offer", sdp: "v=0" } }
            })
        )

        await Promise.resolve()
        expect(internals.pendingIceByPeer.has("stranger-9")).toBe(false)
        expect(created[0]).toBeTruthy()

        releaseRemote()
        await internals.signalChain

        expect(created[0]?.addIceCandidate).toHaveBeenCalledWith(earlyCandidate)
        globalThis.RTCPeerConnection = originalRtc

        await engine.dispose()
    })
})
