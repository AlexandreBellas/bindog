import { ConnectRole, GameEngineMessageType, RoomPhase } from "#/@types/room"
import type { IRoomState } from "#/@types/room"
import type { IGameState } from "#/@types/game"
import { ANNOUNCE_INTERVAL_MS } from "#/constants/announce"
import { WILD_CELL_INDEX } from "#/constants/breeds"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import GameEngineCloudflare from "./game-engine.cloudflare"
import {
    clearRoomSession,
    loadRoomSession,
    PEER_LEAVE_GRACE_MS,
    saveRoomSession,
    SIGNALING_CONNECT_TIMEOUT_MS,
    SIGNALING_RECONNECT_DELAY_MS
} from "./room-session"

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

    public emit(type: string): void {
        for (const listener of this.listeners.get(type) ?? []) {
            listener()
        }
    }

    public close(): void {
        this.connectionState = "closed"
        this.emit("connectionstatechange")
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

function coverEntireBoard(game: IGameState, playerId: string): string[] {
    const board = game.boards[playerId]
    if (!board) throw new Error("missing board")
    return board.cells.filter((cell): cell is string => cell !== null)
}

function claimLegitimateBingo(engine: GameEngineCloudflare, playerId: string): void {
    const internals = engine as unknown as EngineInternals
    const game = internals.state!.game!
    const needed = coverCenterRow(game, playerId)

    internals.state = {
        ...internals.state!,
        game: {
            ...game,
            announced: needed,
            callOrder: game.callOrder.filter(id => !needed.includes(id)),
            fakeBingoPlayerId: null
        }
    }

    claimBingoFor(engine, playerId)
}

function claimBingoFor(engine: GameEngineCloudflare, playerId: string): void {
    ;(engine as unknown as { resolveClaimBingo: (id: string) => void }).resolveClaimBingo(playerId)
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
        clearRoomSession()
        window.localStorage.clear()
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
        expect(state?.wins[state!.localPlayerId]).toBe(0)

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
        expect(state?.wins[leaderId]).toBe(1)
        expect(state?.wins["joiner-1"]).toBe(0)

        await engine.dispose()
    })

    it("keeps room wins across multiple finished rounds", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        expect(engine.getState()?.wins).toEqual({ [leaderId]: 0, "joiner-1": 0 })

        await startPlaying(engine)
        claimLegitimateBingo(engine, leaderId)
        expect(engine.getState()?.wins[leaderId]).toBe(1)

        engine.send({ type: GameEngineMessageType.RestartGame })
        await vi.waitFor(() => {
            expect(engine.getState()?.phase).toBe(RoomPhase.Playing)
        })
        expect(engine.getState()?.wins[leaderId]).toBe(1)

        claimLegitimateBingo(engine, leaderId)
        expect(engine.getState()?.phase).toBe(RoomPhase.Ended)
        expect(engine.getState()?.wins[leaderId]).toBe(2)
        expect(engine.getState()?.wins["joiner-1"]).toBe(0)

        await engine.dispose()
    })

    it("lets a late joiner sit out the current round and receive a board on restart", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        await startPlaying(engine)

        const socket = (engine as unknown as EngineInternals).signalingSocket!
        socket.emit(
            "message",
            JSON.stringify({
                type: "peer-joined",
                peer: { id: "joiner-2", nickname: "Gamma", isLeader: false }
            })
        )

        const duringRound = engine.getState()
        expect(duringRound?.players.some(player => player.id === "joiner-2")).toBe(true)
        expect(duringRound?.wins["joiner-2"]).toBe(0)
        expect(duringRound?.game?.boards["joiner-2"]).toBeUndefined()
        expect(duringRound?.game?.boards[leaderId]).toBeTruthy()

        claimLegitimateBingo(engine, leaderId)
        expect(engine.getState()?.wins[leaderId]).toBe(1)

        engine.send({ type: GameEngineMessageType.RestartGame })
        await vi.waitFor(() => {
            expect(engine.getState()?.phase).toBe(RoomPhase.Playing)
        })

        const nextRound = engine.getState()
        expect(nextRound?.game?.boards["joiner-2"]).toBeTruthy()
        expect(nextRound?.game?.boards[leaderId]).toBeTruthy()
        expect(nextRound?.wins[leaderId]).toBe(1)
        expect(nextRound?.wins["joiner-2"]).toBe(0)

        await engine.dispose()
    })

    it("lets a player join an ended room and receive a board on the next round", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        await startPlaying(engine)
        claimLegitimateBingo(engine, leaderId)
        expect(engine.getState()?.phase).toBe(RoomPhase.Ended)

        const socket = (engine as unknown as EngineInternals).signalingSocket!
        socket.emit(
            "message",
            JSON.stringify({
                type: "peer-joined",
                peer: { id: "joiner-2", nickname: "Gamma", isLeader: false }
            })
        )

        expect(engine.getState()?.game?.boards["joiner-2"]).toBeUndefined()
        expect(engine.getState()?.wins["joiner-2"]).toBe(0)

        engine.send({ type: GameEngineMessageType.RestartGame })
        await vi.waitFor(() => {
            expect(engine.getState()?.phase).toBe(RoomPhase.Playing)
        })

        expect(engine.getState()?.game?.boards["joiner-2"]).toBeTruthy()
        expect(engine.getState()?.wins[leaderId]).toBe(1)

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

        expect(
            leader
                .getState()
                ?.players.map(player => player.id)
                .sort()
        ).toEqual([leaderJoin.peerId, joinerJoin.peerId].sort())
        expect(
            joiner
                .getState()
                ?.players.map(player => player.id)
                .sort()
        ).toEqual([leaderJoin.peerId, joinerJoin.peerId].sort())

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

        // Drain the serialized signal queue (nested .then/.catch) — a single
        // microtask is not enough for the chain to settle.
        await vi.waitFor(() => {
            expect(internals.peers.get("joiner-1")?.pendingIceCandidates).toEqual([earlyCandidate])
        })
        expect(connection.addIceCandidate).not.toHaveBeenCalled()

        socket.emit(
            "message",
            JSON.stringify({
                type: "signal",
                from: "joiner-1",
                payload: { kind: "answer", sdp: { type: "answer", sdp: "v=0" } }
            })
        )

        // Answer handling starts setRemoteDescription but awaits the gate; wait
        // until the call is observed without waiting for the full signalChain.
        await vi.waitFor(() => {
            expect(connection.setRemoteDescription).toHaveBeenCalled()
        })
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

        await vi.waitFor(() => {
            expect(internals.pendingIceByPeer.has("stranger-9")).toBe(false)
            expect(created[0]).toBeTruthy()
            expect(created[0]?.setRemoteDescription).toHaveBeenCalled()
        })
        expect(created[0]?.addIceCandidate).not.toHaveBeenCalled()

        releaseRemote()
        await internals.signalChain

        expect(created[0]?.addIceCandidate).toHaveBeenCalledWith(earlyCandidate)
        globalThis.RTCPeerConnection = originalRtc

        await engine.dispose()
    })

    it("abandons a playing round when the last opponent leaves", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        await startPlaying(engine)

        const socket = (engine as unknown as EngineInternals).signalingSocket!
        socket.emit(
            "message",
            JSON.stringify({
                type: "peer-left",
                peerId: "joiner-1",
                newLeaderId: null
            })
        )

        await vi.advanceTimersByTimeAsync(PEER_LEAVE_GRACE_MS)
        engine.canStartGame()

        const state = engine.getState()
        expect(state?.players.map(player => player.id)).toEqual([leaderId])
        expect(state?.phase).toBe(RoomPhase.Ended)
        expect(state?.abandoned).toBe(true)

        await engine.dispose()
    })

    it("does not abandon the lobby when a peer leaves and one player remains", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)

        const socket = (engine as unknown as EngineInternals).signalingSocket!
        socket.emit(
            "message",
            JSON.stringify({
                type: "peer-left",
                peerId: "joiner-1",
                newLeaderId: null
            })
        )

        await vi.advanceTimersByTimeAsync(PEER_LEAVE_GRACE_MS)
        engine.canStartGame()

        const state = engine.getState()
        expect(state?.players.map(player => player.id)).toEqual([leaderId])
        expect(state?.phase).toBe(RoomPhase.Lobby)
        expect(state?.abandoned).toBe(false)

        await engine.dispose()
    })

    it("abandons during countdown when the last opponent leaves", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        engine.send({ type: GameEngineMessageType.StartGame })
        expect(engine.getState()?.phase).toBe(RoomPhase.Countdown)

        const socket = (engine as unknown as EngineInternals).signalingSocket!
        socket.emit(
            "message",
            JSON.stringify({
                type: "peer-left",
                peerId: "joiner-1",
                newLeaderId: null
            })
        )

        await vi.advanceTimersByTimeAsync(PEER_LEAVE_GRACE_MS)
        engine.canStartGame()

        const state = engine.getState()
        expect(state?.players.map(player => player.id)).toEqual([leaderId])
        expect(state?.phase).toBe(RoomPhase.Ended)
        expect(state?.abandoned).toBe(true)
        expect(state?.countdown).toBeNull()

        await engine.dispose()
    })

    describe("leave grace and phantom peers", () => {
        function emitPeerLeft(engine: GameEngineCloudflare, peerId = "joiner-1", newLeaderId: string | null = null) {
            const socket = (engine as unknown as EngineInternals).signalingSocket!
            socket.emit(
                "message",
                JSON.stringify({
                    type: "peer-left",
                    peerId,
                    newLeaderId
                })
            )
        }

        function emitPeerJoined(
            engine: GameEngineCloudflare,
            peer: { id: string; nickname: string; isLeader: boolean } = {
                id: "joiner-1",
                nickname: "Beta",
                isLeader: false
            }
        ) {
            const socket = (engine as unknown as EngineInternals).signalingSocket!
            socket.emit(
                "message",
                JSON.stringify({
                    type: "peer-joined",
                    peer
                })
            )
        }

        it("keeps the peer listed during grace but excludes them from start eligibility", async () => {
            vi.useFakeTimers()

            const engine = new GameEngineCloudflare()
            const leaderId = await connectLeaderWithJoiner(engine)
            expect(engine.canStartGame()).toBe(true)

            emitPeerLeft(engine)

            expect(
                engine
                    .getState()
                    ?.players.map(player => player.id)
                    .sort()
            ).toEqual([leaderId, "joiner-1"].sort())
            expect(engine.canStartGame()).toBe(false)
            expect(() => engine.send({ type: GameEngineMessageType.StartGame })).toThrow(/two players/i)

            await engine.dispose()
        })

        it("removes the phantom peer from the roster when leave grace elapses", async () => {
            vi.useFakeTimers()

            const engine = new GameEngineCloudflare()
            const leaderId = await connectLeaderWithJoiner(engine)
            const snapshots: Array<string[] | null> = []
            const unsubscribe = engine.subscribe(state => {
                snapshots.push(state?.players.map(player => player.id) ?? null)
            })

            emitPeerLeft(engine)
            await vi.advanceTimersByTimeAsync(PEER_LEAVE_GRACE_MS)

            expect(engine.getState()?.players.map(player => player.id)).toEqual([leaderId])
            expect(snapshots.at(-1)).toEqual([leaderId])
            expect(engine.canStartGame()).toBe(false)

            unsubscribe()
            await engine.dispose()
        })

        it("sweeps expired leave grace via canStartGame when the timer was throttled", async () => {
            vi.useFakeTimers()

            const engine = new GameEngineCloudflare()
            const leaderId = await connectLeaderWithJoiner(engine)

            emitPeerLeft(engine)
            expect(engine.getState()?.players).toHaveLength(2)

            // Deadline passed without the setTimeout callback running (background-tab throttling).
            vi.setSystemTime(Date.now() + PEER_LEAVE_GRACE_MS + 50)
            expect(engine.canStartGame()).toBe(false)
            expect(engine.getState()?.players.map(player => player.id)).toEqual([leaderId])

            await engine.dispose()
        })

        it("sweeps expired leave grace when the tab becomes visible again", async () => {
            vi.useFakeTimers()

            const engine = new GameEngineCloudflare()
            const leaderId = await connectLeaderWithJoiner(engine)

            emitPeerLeft(engine)
            vi.setSystemTime(Date.now() + PEER_LEAVE_GRACE_MS + 50)

            Object.defineProperty(document, "visibilityState", {
                configurable: true,
                get: () => "visible"
            })
            document.dispatchEvent(new Event("visibilitychange"))

            expect(engine.getState()?.players.map(player => player.id)).toEqual([leaderId])

            await engine.dispose()
        })

        it("starts leave grace when the WebRTC connection fails", async () => {
            vi.useFakeTimers()

            const engine = new GameEngineCloudflare()
            const leaderId = await connectLeaderWithJoiner(engine)
            const peerConnection = (engine as unknown as EngineInternals).peers.get("joiner-1")?.connection
            expect(peerConnection).toBeTruthy()

            peerConnection!.connectionState = "failed"
            peerConnection!.emit("connectionstatechange")

            expect(
                engine
                    .getState()
                    ?.players.map(player => player.id)
                    .sort()
            ).toEqual([leaderId, "joiner-1"].sort())
            expect(engine.canStartGame()).toBe(false)

            await vi.advanceTimersByTimeAsync(PEER_LEAVE_GRACE_MS)

            expect(engine.getState()?.players.map(player => player.id)).toEqual([leaderId])

            await engine.dispose()
        })

        it("starts leave grace when the WebRTC connection closes unexpectedly", async () => {
            vi.useFakeTimers()

            const engine = new GameEngineCloudflare()
            const leaderId = await connectLeaderWithJoiner(engine)
            const peerConnection = (engine as unknown as EngineInternals).peers.get("joiner-1")?.connection
            expect(peerConnection).toBeTruthy()

            peerConnection!.connectionState = "closed"
            peerConnection!.emit("connectionstatechange")

            expect(engine.canStartGame()).toBe(false)

            await vi.advanceTimersByTimeAsync(PEER_LEAVE_GRACE_MS)

            expect(engine.getState()?.players.map(player => player.id)).toEqual([leaderId])

            await engine.dispose()
        })

        it("cancels leave grace when the same peer rejoins before the deadline", async () => {
            vi.useFakeTimers()

            const engine = new GameEngineCloudflare()
            const leaderId = await connectLeaderWithJoiner(engine)

            emitPeerLeft(engine)
            expect(engine.canStartGame()).toBe(false)

            emitPeerJoined(engine)
            expect(engine.canStartGame()).toBe(true)

            await vi.advanceTimersByTimeAsync(PEER_LEAVE_GRACE_MS)

            expect(
                engine
                    .getState()
                    ?.players.map(player => player.id)
                    .sort()
            ).toEqual([leaderId, "joiner-1"].sort())
            expect(engine.canStartGame()).toBe(true)
            expect(engine.getState()?.phase).toBe(RoomPhase.Lobby)

            await engine.dispose()
        })

        it("does not drop a rejoining peer because RTC teardown during peer-joined is suppressed", async () => {
            vi.useFakeTimers()

            const engine = new GameEngineCloudflare()
            const leaderId = await connectLeaderWithJoiner(engine)

            emitPeerLeft(engine)
            emitPeerJoined(engine)

            // peer-joined tears down the old RTC link under suppress; that close must not re-arm grace.
            await vi.advanceTimersByTimeAsync(PEER_LEAVE_GRACE_MS)

            expect(
                engine
                    .getState()
                    ?.players.map(player => player.id)
                    .sort()
            ).toEqual([leaderId, "joiner-1"].sort())
            expect(engine.canStartGame()).toBe(true)

            await engine.dispose()
        })

        it("re-arms leave grace if the rejoined peer's RTC fails again", async () => {
            vi.useFakeTimers()

            const engine = new GameEngineCloudflare()
            const leaderId = await connectLeaderWithJoiner(engine)

            emitPeerLeft(engine)
            emitPeerJoined(engine)

            const peerConnection = (engine as unknown as EngineInternals).peers.get("joiner-1")?.connection
            expect(peerConnection).toBeTruthy()

            peerConnection!.connectionState = "failed"
            peerConnection!.emit("connectionstatechange")

            expect(engine.canStartGame()).toBe(false)

            await vi.advanceTimersByTimeAsync(PEER_LEAVE_GRACE_MS)

            expect(engine.getState()?.players.map(player => player.id)).toEqual([leaderId])

            await engine.dispose()
        })

        it("applies leadership immediately on peer-left while deferring roster removal", async () => {
            vi.useFakeTimers()

            const engine = new GameEngineCloudflare()
            const leaderId = await connectLeaderWithJoiner(engine)

            // Pretend we were a joiner and the old leader left.
            const internals = engine as unknown as EngineInternals
            internals.state = {
                ...internals.state!,
                players: [
                    { id: leaderId, nickname: "Alpha", isLeader: false },
                    { id: "old-leader", nickname: "Boss", isLeader: true }
                ],
                pendingLeavePeerIds: []
            }
            ;(engine as unknown as { isLeader: boolean }).isLeader = false

            emitPeerLeft(engine, "old-leader", leaderId)

            const duringGrace = engine.getState()
            expect(duringGrace?.players).toHaveLength(2)
            expect(duringGrace?.players.find(player => player.id === leaderId)?.isLeader).toBe(true)
            expect(duringGrace?.pendingLeavePeerIds).toEqual(["old-leader"])
            expect(engine.canStartGame()).toBe(false)

            await vi.advanceTimersByTimeAsync(PEER_LEAVE_GRACE_MS)

            expect(engine.getState()?.players.map(player => player.id)).toEqual([leaderId])
            expect(engine.getState()?.players[0]?.isLeader).toBe(true)
            expect(engine.getState()?.pendingLeavePeerIds).toEqual([])

            await engine.dispose()
        })

        it("re-enables start for the promoted leader once the old leader rejoins", async () => {
            vi.useFakeTimers()

            const engine = new GameEngineCloudflare()
            const localId = await connectLeaderWithJoiner(engine)

            // Survivor starts as joiner; reloading peer was the leader.
            const internals = engine as unknown as EngineInternals
            internals.state = {
                ...internals.state!,
                players: [
                    { id: localId, nickname: "Alpha", isLeader: false },
                    { id: "old-leader", nickname: "Boss", isLeader: true }
                ],
                pendingLeavePeerIds: []
            }
            ;(engine as unknown as { isLeader: boolean }).isLeader = false

            const startEligibility: boolean[] = []
            const unsubscribe = engine.subscribe(state => {
                if (!state) return
                const pending = new Set(state.pendingLeavePeerIds)
                const activeCount = state.players.filter(player => !pending.has(player.id)).length
                const localIsLeader = Boolean(state.players.find(player => player.id === state.localPlayerId)?.isLeader)
                startEligibility.push(localIsLeader && state.phase === RoomPhase.Lobby && activeCount >= 2)
            })

            emitPeerLeft(engine, "old-leader", localId)

            expect(engine.getState()?.players.find(player => player.id === localId)?.isLeader).toBe(true)
            expect(engine.getState()?.pendingLeavePeerIds).toEqual(["old-leader"])
            expect(engine.canStartGame()).toBe(false)
            expect(startEligibility.at(-1)).toBe(false)

            emitPeerJoined(engine, { id: "old-leader", nickname: "Boss", isLeader: false })

            expect(engine.getState()?.pendingLeavePeerIds).toEqual([])
            expect(engine.getState()?.players.find(player => player.id === localId)?.isLeader).toBe(true)
            expect(engine.canStartGame()).toBe(true)
            expect(startEligibility.at(-1)).toBe(true)

            unsubscribe()
            await engine.dispose()
        })
    })

    it("persists the room session and restores it after disconnect teardown", async () => {
        const engine = new GameEngineCloudflare()
        const peerId = await connectLeaderWithJoiner(engine)

        expect(loadRoomSession()).toEqual({
            roomCode: "ABCDEF",
            nickname: "Alpha",
            peerId
        })

        await engine.disconnect()
        expect(loadRoomSession()).toBeNull()
        expect(engine.getState()).toBeNull()

        await engine.dispose()
    })

    it("keeps the persisted session across dispose so a reload can rejoin", async () => {
        const engine = new GameEngineCloudflare()
        const peerId = await connectLeaderWithJoiner(engine)

        await engine.dispose()

        expect(loadRoomSession()).toEqual({
            roomCode: "ABCDEF",
            nickname: "Alpha",
            peerId
        })
        expect(engine.getState()).toBeNull()
    })

    it("restoreSession rejoins using the persisted peer id", async () => {
        const first = new GameEngineCloudflare()
        const peerId = await connectLeaderWithJoiner(first)
        expect(loadRoomSession()?.peerId).toBe(peerId)

        // Simulate a full page reload: in-memory engine is gone, localStorage remains.
        await first.dispose()
        expect(loadRoomSession()?.peerId).toBe(peerId)

        const second = new GameEngineCloudflare()
        const restorePromise = second.restoreSession()

        await vi.waitFor(() => {
            const socket = (second as unknown as EngineInternals).signalingSocket
            expect(socket?.readyState).toBe(MockWebSocket.OPEN)
        })

        const socket = (second as unknown as EngineInternals).signalingSocket!
        const joinPayload = JSON.parse(socket.sent[0] as string) as {
            peerId: string
            role: string
            nickname: string
        }

        expect(joinPayload.peerId).toBe(peerId)
        expect(joinPayload.role).toBe(ConnectRole.Joiner)
        expect(joinPayload.nickname).toBe("Alpha")

        socket.emit(
            "message",
            JSON.stringify({
                type: "joined",
                peerId,
                roomCode: "ABCDEF",
                roomName: "Pup pack",
                peers: [{ id: peerId, nickname: "Alpha", isLeader: true }]
            })
        )

        const restored = await restorePromise
        expect(restored?.code).toBe("ABCDEF")
        expect(restored?.localPlayerId).toBe(peerId)
        expect(second.getState()?.players[0]?.isLeader).toBe(true)
        expect(loadRoomSession()?.peerId).toBe(peerId)

        await second.dispose()
    })

    it("keeps the persisted session when restore fails for a transient signaling error", async () => {
        vi.useFakeTimers()

        saveRoomSession({ roomCode: "ABCDEF", nickname: "Alpha", peerId: "peer-reload" })

        const engine = new GameEngineCloudflare()
        const restorePromise = engine.restoreSession()
        const restoreResult = restorePromise.then(
            state => ({ ok: true as const, state }),
            error => ({ ok: false as const, error })
        )

        await vi.waitFor(() => {
            const socket = (engine as unknown as EngineInternals).signalingSocket
            expect(socket?.readyState).toBe(MockWebSocket.OPEN)
        })

        const socket = (engine as unknown as EngineInternals).signalingSocket!
        socket.close()

        const result = await restoreResult
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.state).toBeNull()
        expect(loadRoomSession()).toEqual({
            roomCode: "ABCDEF",
            nickname: "Alpha",
            peerId: "peer-reload"
        })

        await vi.advanceTimersByTimeAsync(SIGNALING_RECONNECT_DELAY_MS)

        await vi.waitFor(() => {
            const next = (engine as unknown as EngineInternals).signalingSocket
            expect(next).not.toBeNull()
            expect(next).not.toBe(socket)
            expect(next?.readyState).toBe(MockWebSocket.OPEN)
        })

        await engine.dispose()
    })

    it("clears the persisted session when restore finds the room is gone", async () => {
        saveRoomSession({ roomCode: "ABCDEF", nickname: "Alpha", peerId: "peer-gone" })

        globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input)

            if (url.endsWith("/turn/credentials") && init?.method === "POST") {
                return Response.json({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] })
            }

            if (url.includes("/rooms/")) {
                return new Response("gone", { status: 404 })
            }

            return new Response("not found", { status: 404 })
        }) as typeof fetch

        const engine = new GameEngineCloudflare()
        await expect(engine.restoreSession()).resolves.toBeNull()
        expect(loadRoomSession()).toBeNull()

        await engine.dispose()
    })

    it("rejects connect when the signaling socket closes before join completes", async () => {
        const engine = new GameEngineCloudflare()
        const connectPromise = engine.connect({
            role: ConnectRole.Joiner,
            roomCode: "ABCDEF",
            nickname: "Mobile"
        })

        await vi.waitFor(() => {
            const socket = (engine as unknown as EngineInternals).signalingSocket
            expect(socket?.readyState).toBe(MockWebSocket.OPEN)
        })

        const socket = (engine as unknown as EngineInternals).signalingSocket!
        socket.close()

        await expect(connectPromise).rejects.toThrow(/connection closed/i)
        expect(engine.getState()).toBeNull()
        expect(loadRoomSession()).toBeNull()

        await engine.dispose()
    })

    it("rejects connect when the signaling join handshake times out", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const connectPromise = engine.connect({
            role: ConnectRole.Joiner,
            roomCode: "ABCDEF",
            nickname: "Mobile"
        })
        // Attach early so fake-timer rejection is not reported as unhandled.
        const connectResult = connectPromise.then(
            state => ({ ok: true as const, state }),
            error => ({ ok: false as const, error })
        )

        await vi.waitFor(() => {
            const socket = (engine as unknown as EngineInternals).signalingSocket
            expect(socket?.readyState).toBe(MockWebSocket.OPEN)
        })

        await vi.advanceTimersByTimeAsync(SIGNALING_CONNECT_TIMEOUT_MS)

        const result = await connectResult
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(String(result.error)).toMatch(/timed out/i)
        }
        expect(engine.getState()).toBeNull()

        await engine.dispose()
    })

    it("auto-reconnects signaling after an unexpected socket close using the persisted session", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const peerId = await connectLeaderWithJoiner(engine)
        const firstSocket = (engine as unknown as EngineInternals).signalingSocket!
        expect(loadRoomSession()?.peerId).toBe(peerId)

        firstSocket.close()
        expect((engine as unknown as EngineInternals).signalingSocket).toBeNull()
        expect(engine.getState()?.code).toBe("ABCDEF")

        await vi.advanceTimersByTimeAsync(SIGNALING_RECONNECT_DELAY_MS)

        await vi.waitFor(() => {
            const socket = (engine as unknown as EngineInternals).signalingSocket
            expect(socket).not.toBeNull()
            expect(socket).not.toBe(firstSocket)
            expect(socket?.readyState).toBe(MockWebSocket.OPEN)
        })

        const socket = (engine as unknown as EngineInternals).signalingSocket!
        const joinPayload = JSON.parse(socket.sent[0] as string) as { peerId: string; role: string }
        expect(joinPayload.peerId).toBe(peerId)
        expect(joinPayload.role).toBe(ConnectRole.Joiner)

        socket.emit(
            "message",
            JSON.stringify({
                type: "joined",
                peerId,
                roomCode: "ABCDEF",
                roomName: "Pup pack",
                peers: [
                    { id: peerId, nickname: "Alpha", isLeader: true },
                    { id: "joiner-1", nickname: "Beta", isLeader: false }
                ]
            })
        )

        await vi.waitFor(() => {
            expect(engine.getState()?.players).toHaveLength(2)
        })

        await engine.dispose()
    })

    it("lets the leader change round settings in lobby and keeps them after start", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        await connectLeaderWithJoiner(engine)

        engine.send({
            type: GameEngineMessageType.UpdateSettings,
            settings: { fullGridBingo: true, hardMode: true, limitIncorrectBindogs: true }
        })
        expect(engine.getState()?.settings).toEqual({
            fullGridBingo: true,
            hardMode: true,
            limitIncorrectBindogs: true
        })

        await startPlaying(engine)
        expect(engine.getState()?.settings.hardMode).toBe(true)
        expect(engine.getState()?.settings.fullGridBingo).toBe(true)
        expect(engine.getState()?.game?.disqualifiedPlayerIds).toEqual([])

        engine.send({
            type: GameEngineMessageType.UpdateSettings,
            settings: { fullGridBingo: false, hardMode: false, limitIncorrectBindogs: false }
        })
        expect(engine.getState()?.settings.hardMode).toBe(true)

        await engine.dispose()
    })

    it("ignores settings updates from non-leaders", async () => {
        const engine = new GameEngineCloudflare()
        await connectLeaderWithJoiner(engine)

        ;(engine as unknown as { isLeader: boolean }).isLeader = false
        engine.send({
            type: GameEngineMessageType.UpdateSettings,
            settings: { fullGridBingo: true, hardMode: true, limitIncorrectBindogs: true }
        })
        expect(engine.getState()?.settings.fullGridBingo).toBe(false)
        ;(engine as unknown as { isLeader: boolean }).isLeader = true

        await engine.dispose()
    })

    it("requires a full card when full-grid bingo is enabled", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        engine.send({
            type: GameEngineMessageType.UpdateSettings,
            settings: { fullGridBingo: true, hardMode: false, limitIncorrectBindogs: false }
        })
        await startPlaying(engine)

        const internals = engine as unknown as EngineInternals
        const rowOnly = coverCenterRow(internals.state!.game!, leaderId)
        internals.state = {
            ...internals.state!,
            game: {
                ...internals.state!.game!,
                announced: rowOnly,
                callOrder: internals.state!.game!.callOrder.filter(id => !rowOnly.includes(id))
            }
        }
        engine.send({ type: GameEngineMessageType.ClaimBingo })
        expect(engine.getState()?.phase).toBe(RoomPhase.Playing)
        expect(engine.getState()?.game?.fakeBingoPlayerId).toBe(leaderId)

        const fullCard = coverEntireBoard(engine.getState()!.game!, leaderId)
        internals.state = {
            ...engine.getState()!,
            game: {
                ...engine.getState()!.game!,
                announced: fullCard,
                callOrder: engine.getState()!.game!.callOrder.filter(id => !fullCard.includes(id)),
                fakeBingoPlayerId: null
            }
        }
        engine.send({ type: GameEngineMessageType.ClaimBingo })
        expect(engine.getState()?.phase).toBe(RoomPhase.Ended)
        expect(engine.getState()?.game?.winnerId).toBe(leaderId)
        expect(engine.getState()?.game?.progress?.[0]?.kind).toBe("grid")
        expect(engine.getState()?.game?.progress?.[0]?.total).toBe(25)

        await engine.dispose()
    })

    it("awards the last remaining player when everyone else is disqualified", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        engine.send({
            type: GameEngineMessageType.UpdateSettings,
            settings: { fullGridBingo: false, hardMode: false, limitIncorrectBindogs: true }
        })
        await startPlaying(engine)

        claimBingoFor(engine, leaderId)
        claimBingoFor(engine, leaderId)
        expect(engine.getState()?.phase).toBe(RoomPhase.Playing)

        claimBingoFor(engine, leaderId)
        expect(engine.getState()?.phase).toBe(RoomPhase.Ended)
        expect(engine.getState()?.game?.winnerId).toBe("joiner-1")
        expect(engine.getState()?.game?.disqualifiedPlayerIds).toEqual([leaderId])
        expect(engine.getState()?.wins["joiner-1"]).toBe(1)
        expect(engine.getState()?.wins[leaderId]).toBe(0)

        await engine.dispose()
    })

    it("keeps the round going until only one in-round player remains", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        const socket = (engine as unknown as EngineInternals).signalingSocket!
        socket.emit(
            "message",
            JSON.stringify({
                type: "peer-joined",
                peer: { id: "joiner-2", nickname: "Gamma", isLeader: false }
            })
        )
        engine.send({
            type: GameEngineMessageType.UpdateSettings,
            settings: { fullGridBingo: false, hardMode: false, limitIncorrectBindogs: true }
        })
        await startPlaying(engine)

        claimBingoFor(engine, leaderId)
        claimBingoFor(engine, leaderId)
        claimBingoFor(engine, leaderId)
        expect(engine.getState()?.phase).toBe(RoomPhase.Playing)
        expect(engine.getState()?.game?.winnerId).toBeNull()
        expect(engine.getState()?.game?.disqualifiedPlayerIds).toEqual([leaderId])

        claimBingoFor(engine, leaderId)
        expect(engine.getState()?.phase).toBe(RoomPhase.Playing)

        claimBingoFor(engine, "joiner-1")
        claimBingoFor(engine, "joiner-1")
        claimBingoFor(engine, "joiner-1")
        expect(engine.getState()?.phase).toBe(RoomPhase.Ended)
        expect(engine.getState()?.game?.winnerId).toBe("joiner-2")
        expect(engine.getState()?.game?.disqualifiedPlayerIds).toEqual([leaderId, "joiner-1"])
        expect(engine.getState()?.wins["joiner-2"]).toBe(1)

        await engine.dispose()
    })

    it("does not count late joiners without a board as remaining players", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        engine.send({
            type: GameEngineMessageType.UpdateSettings,
            settings: { fullGridBingo: false, hardMode: false, limitIncorrectBindogs: true }
        })
        await startPlaying(engine)

        const socket = (engine as unknown as EngineInternals).signalingSocket!
        socket.emit(
            "message",
            JSON.stringify({
                type: "peer-joined",
                peer: { id: "joiner-2", nickname: "Gamma", isLeader: false }
            })
        )

        claimBingoFor(engine, leaderId)
        claimBingoFor(engine, leaderId)
        claimBingoFor(engine, leaderId)

        expect(engine.getState()?.phase).toBe(RoomPhase.Ended)
        expect(engine.getState()?.game?.winnerId).toBe("joiner-1")
        expect(engine.getState()?.game?.boards["joiner-2"]).toBeUndefined()

        await engine.dispose()
    })

    it("does not disqualify unlimited incorrect Bindogs and resets the cap on restart", async () => {
        vi.useFakeTimers()

        const engine = new GameEngineCloudflare()
        const leaderId = await connectLeaderWithJoiner(engine)
        await startPlaying(engine)

        engine.send({ type: GameEngineMessageType.ClaimBingo })
        engine.send({ type: GameEngineMessageType.ClaimBingo })
        engine.send({ type: GameEngineMessageType.ClaimBingo })
        expect(engine.getState()?.game?.disqualifiedPlayerIds).toEqual([])
        expect(engine.getState()?.game?.incorrectBindogCounts[leaderId]).toBe(3)

        claimLegitimateBingo(engine, leaderId)
        expect(engine.getState()?.phase).toBe(RoomPhase.Ended)

        engine.send({
            type: GameEngineMessageType.UpdateSettings,
            settings: { fullGridBingo: false, hardMode: false, limitIncorrectBindogs: true }
        })
        expect(engine.getState()?.settings.limitIncorrectBindogs).toBe(true)

        engine.send({ type: GameEngineMessageType.RestartGame })
        await vi.waitFor(() => {
            expect(engine.getState()?.phase).toBe(RoomPhase.Playing)
        })
        expect(engine.getState()?.game?.incorrectBindogCounts).toEqual({})
        expect(engine.getState()?.game?.disqualifiedPlayerIds).toEqual([])
        expect(engine.getState()?.settings.limitIncorrectBindogs).toBe(true)

        await engine.dispose()
    })

    it("re-persists the room session on pagehide so reloads keep the room", async () => {
        const engine = new GameEngineCloudflare()
        const peerId = await connectLeaderWithJoiner(engine)

        clearRoomSession()
        expect(loadRoomSession()).toBeNull()

        window.dispatchEvent(new Event("pagehide"))

        expect(loadRoomSession()).toEqual({
            roomCode: "ABCDEF",
            nickname: "Alpha",
            peerId
        })

        await engine.dispose()
    })
})
