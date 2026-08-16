import { RoomPhase, type IRoomState } from "#/@types/room"
import { DataChannelMessageType, SignalingServerMessageType, WebRtcSignalKind } from "#/@types/signaling"
import { describe, expect, it } from "vitest"
import BaseWebRtcService from "./webrtc"

/**
 * Exposes protected helpers for unit testing.
 */
class TestableWebRtcService extends BaseWebRtcService {
    public normalizeRoomCode(code: string): string {
        return super.normalizeRoomCode(code)
    }

    public isValidRoomCode(code: string): boolean {
        return super.isValidRoomCode(code)
    }

    public createPeerId(): string {
        return super.createPeerId()
    }

    public evaluateCanStartGame(state: IRoomState): boolean {
        return super.evaluateCanStartGame(state)
    }

    public upsertPlayer(...args: Parameters<BaseWebRtcService["upsertPlayer"]>) {
        return super.upsertPlayer(...args)
    }

    public removePlayer(...args: Parameters<BaseWebRtcService["removePlayer"]>) {
        return super.removePlayer(...args)
    }

    public shouldAbandonGame(...args: Parameters<BaseWebRtcService["shouldAbandonGame"]>) {
        return super.shouldAbandonGame(...args)
    }

    public applyAbandoned(...args: Parameters<BaseWebRtcService["applyAbandoned"]>) {
        return super.applyAbandoned(...args)
    }

    public applyLeader(...args: Parameters<BaseWebRtcService["applyLeader"]>) {
        return super.applyLeader(...args)
    }

    public applyCountdown(...args: Parameters<BaseWebRtcService["applyCountdown"]>) {
        return super.applyCountdown(...args)
    }

    public applyPlaying(...args: Parameters<BaseWebRtcService["applyPlaying"]>) {
        return super.applyPlaying(...args)
    }

    public parseDataChannelMessage(...args: Parameters<BaseWebRtcService["parseDataChannelMessage"]>) {
        return super.parseDataChannelMessage(...args)
    }

    public parseSignalingServerMessage(...args: Parameters<BaseWebRtcService["parseSignalingServerMessage"]>) {
        return super.parseSignalingServerMessage(...args)
    }

    public parseWebRtcSignalPayload(...args: Parameters<BaseWebRtcService["parseWebRtcSignalPayload"]>) {
        return super.parseWebRtcSignalPayload(...args)
    }

    public resolveIceTransportPath(...args: Parameters<BaseWebRtcService["resolveIceTransportPath"]>) {
        return super.resolveIceTransportPath(...args)
    }
}

function makeState(overrides: Partial<IRoomState> = {}): IRoomState {
    return {
        code: "ABCDEF",
        name: "Pup pack",
        players: [
            { id: "leader-1", nickname: "Alpha", isLeader: true },
            { id: "joiner-1", nickname: "Beta", isLeader: false }
        ],
        phase: RoomPhase.Lobby,
        countdown: null,
        localPlayerId: "leader-1",
        game: null,
        abandoned: false,
        pendingLeavePeerIds: [],
        wins: {
            "leader-1": 0,
            "joiner-1": 0
        },
        settings: {
            fullGridBingo: false,
            hardMode: false,
            limitIncorrectBindogs: false
        },
        ...overrides
    }
}

const service = new TestableWebRtcService()

describe("normalizeRoomCode", () => {
    it("trims, uppercases, and strips non-alphanumeric characters", () => {
        expect(service.normalizeRoomCode(" ab-12 ")).toBe("AB12")
        expect(service.normalizeRoomCode("woof!")).toBe("WOOF")
    })
})

describe("isValidRoomCode", () => {
    it("accepts 4 to 8 alphanumeric codes", () => {
        expect(service.isValidRoomCode("ABCD")).toBe(true)
        expect(service.isValidRoomCode("AB12CD")).toBe(true)
        expect(service.isValidRoomCode("ABCDEFGH")).toBe(true)
    })

    it("rejects empty or out-of-range codes", () => {
        expect(service.isValidRoomCode("")).toBe(false)
        expect(service.isValidRoomCode("AB")).toBe(false)
        expect(service.isValidRoomCode("ABCDEFGHI")).toBe(false)
        expect(service.isValidRoomCode("!!!")).toBe(false)
    })
})

describe("evaluateCanStartGame", () => {
    it("allows the leader to start with two or more players in lobby", () => {
        expect(service.evaluateCanStartGame(makeState())).toBe(true)
    })

    it("blocks start with fewer than two players", () => {
        expect(
            service.evaluateCanStartGame(
                makeState({
                    players: [{ id: "leader-1", nickname: "Alpha", isLeader: true }]
                })
            )
        ).toBe(false)
    })

    it("blocks joiners from starting", () => {
        expect(service.evaluateCanStartGame(makeState({ localPlayerId: "joiner-1" }))).toBe(false)
    })

    it("ignores peers inside leave-grace when counting players", () => {
        expect(
            service.evaluateCanStartGame(
                makeState({
                    pendingLeavePeerIds: ["joiner-1"]
                })
            )
        ).toBe(false)
    })
})

describe("upsertPlayer", () => {
    it("adds a new player or replaces an existing one", () => {
        const withNew = service.upsertPlayer(makeState({ players: [] }), {
            id: "joiner-2",
            nickname: "Gamma",
            isLeader: false
        })
        expect(withNew.players).toHaveLength(1)
        expect(withNew.wins["joiner-2"]).toBe(0)

        const replaced = service.upsertPlayer(makeState(), {
            id: "joiner-1",
            nickname: "Beta 2",
            isLeader: false
        })
        expect(replaced.players.find(player => player.id === "joiner-1")?.nickname).toBe("Beta 2")
        expect(replaced.wins["joiner-1"]).toBe(0)
    })
})

describe("removePlayer", () => {
    it("removes a player by id", () => {
        const next = service.removePlayer(makeState({ wins: { "leader-1": 2, "joiner-1": 1 } }), "joiner-1")
        expect(next.players.map(player => player.id)).toEqual(["leader-1"])
        expect(next.wins).toEqual({ "leader-1": 2, "joiner-1": 1 })
    })
})

describe("shouldAbandonGame", () => {
    it("is true when alone during playing or countdown", () => {
        const alone = makeState({
            players: [{ id: "leader-1", nickname: "Alpha", isLeader: true }],
            phase: RoomPhase.Playing
        })
        expect(service.shouldAbandonGame(alone)).toBe(true)
        expect(service.shouldAbandonGame({ ...alone, phase: RoomPhase.Countdown, countdown: 2 })).toBe(true)
    })

    it("is false in lobby or when two or more players remain", () => {
        expect(service.shouldAbandonGame(makeState({ phase: RoomPhase.Playing }))).toBe(false)
        expect(
            service.shouldAbandonGame(
                makeState({
                    players: [{ id: "leader-1", nickname: "Alpha", isLeader: true }],
                    phase: RoomPhase.Lobby
                })
            )
        ).toBe(false)
    })
})

describe("applyAbandoned", () => {
    it("ends the round and marks the room abandoned", () => {
        expect(
            service.applyAbandoned(
                makeState({
                    phase: RoomPhase.Playing,
                    countdown: null,
                    players: [{ id: "leader-1", nickname: "Alpha", isLeader: true }]
                })
            )
        ).toMatchObject({
            phase: RoomPhase.Ended,
            countdown: null,
            abandoned: true
        })
    })
})

describe("applyLeader", () => {
    it("moves the crown to the promoted peer", () => {
        const next = service.applyLeader(makeState(), "joiner-1")
        expect(next.players.find(player => player.id === "leader-1")?.isLeader).toBe(false)
        expect(next.players.find(player => player.id === "joiner-1")?.isLeader).toBe(true)
    })
})

describe("applyCountdown", () => {
    it("sets countdown phase for positive values", () => {
        expect(service.applyCountdown(makeState(), 3)).toMatchObject({
            phase: RoomPhase.Countdown,
            countdown: 3
        })
    })

    it("transitions to playing when the countdown reaches zero", () => {
        expect(service.applyCountdown(makeState({ phase: RoomPhase.Countdown, countdown: 1 }), 0)).toMatchObject({
            phase: RoomPhase.Playing,
            countdown: null
        })
    })
})

describe("applyPlaying", () => {
    it("marks the room as playing", () => {
        expect(service.applyPlaying(makeState({ phase: RoomPhase.Countdown, countdown: 1 }))).toMatchObject({
            phase: RoomPhase.Playing,
            countdown: null
        })
    })
})

describe("parseDataChannelMessage", () => {
    it("parses sync, countdown, and playing messages", () => {
        expect(
            service.parseDataChannelMessage({
                type: DataChannelMessageType.Sync,
                code: "ABCDEF",
                name: "Room",
                players: [{ id: "1", nickname: "A", isLeader: true }],
                phase: "lobby",
                countdown: null,
                game: null,
                wins: { "1": 2 }
            })
        ).toMatchObject({
            type: DataChannelMessageType.Sync,
            code: "ABCDEF",
            game: null,
            wins: { "1": 2 },
            settings: { fullGridBingo: false, hardMode: false, limitIncorrectBindogs: false }
        })

        expect(
            service.parseDataChannelMessage({
                type: DataChannelMessageType.Sync,
                code: "ABCDEF",
                name: "Room",
                players: [{ id: "1", nickname: "A", isLeader: true }],
                phase: "lobby",
                countdown: null,
                game: null,
                wins: { "1": 2 },
                settings: { fullGridBingo: true, hardMode: true, limitIncorrectBindogs: true }
            })
        ).toMatchObject({
            settings: { fullGridBingo: true, hardMode: true, limitIncorrectBindogs: true }
        })

        expect(service.parseDataChannelMessage({ type: DataChannelMessageType.Countdown, value: 2 })).toEqual({
            type: DataChannelMessageType.Countdown,
            value: 2
        })

        expect(service.parseDataChannelMessage({ type: DataChannelMessageType.Playing })).toEqual({
            type: DataChannelMessageType.Playing
        })
    })

    it("parses game snapshot, breed announce, fake bingo, ended, and claim messages", () => {
        const board = { cells: Array.from({ length: 25 }, (_, index) => (index === 12 ? null : `b-${index}`)) }
        const game = {
            callOrder: ["a", "b"],
            announced: ["c"],
            currentBreedId: "c",
            announceIntervalMs: 5000,
            announceStartedAt: 100,
            boards: { "1": board },
            winnerId: null,
            fakeBingoPlayerId: null,
            progress: null
        }

        expect(
            service.parseDataChannelMessage({
                type: DataChannelMessageType.GameSnapshot,
                phase: "playing",
                game
            })
        ).toMatchObject({ type: DataChannelMessageType.GameSnapshot, phase: "playing" })

        expect(
            service.parseDataChannelMessage({
                type: DataChannelMessageType.BreedAnnounced,
                breedId: "a",
                announced: ["a"],
                callOrder: ["b"],
                announceStartedAt: 123
            })
        ).toEqual({
            type: DataChannelMessageType.BreedAnnounced,
            breedId: "a",
            announced: ["a"],
            callOrder: ["b"],
            announceStartedAt: 123
        })

        expect(
            service.parseDataChannelMessage({
                type: DataChannelMessageType.FakeBingo,
                playerId: "1"
            })
        ).toEqual({ type: DataChannelMessageType.FakeBingo, playerId: "1", incorrectBindogCounts: {} })

        expect(
            service.parseDataChannelMessage({
                type: DataChannelMessageType.PlayerDisqualified,
                playerId: "1",
                incorrectBindogCounts: { "1": 3 },
                disqualifiedPlayerIds: ["1"]
            })
        ).toEqual({
            type: DataChannelMessageType.PlayerDisqualified,
            playerId: "1",
            incorrectBindogCounts: { "1": 3 },
            disqualifiedPlayerIds: ["1"]
        })

        expect(
            service.parseDataChannelMessage({
                type: DataChannelMessageType.ClaimBingo,
                playerId: "1"
            })
        ).toEqual({ type: DataChannelMessageType.ClaimBingo, playerId: "1" })

        expect(
            service.parseDataChannelMessage({
                type: DataChannelMessageType.GameEnded,
                winnerId: "1",
                progress: [{ playerId: "1", nickname: "A", kind: "row", index: 0, filled: 5, total: 5 }],
                game: { ...game, winnerId: "1", progress: [] },
                wins: { "1": 1 }
            })
        ).toMatchObject({ type: DataChannelMessageType.GameEnded, winnerId: "1", wins: { "1": 1 } })
    })

    it("returns null for invalid payloads", () => {
        expect(service.parseDataChannelMessage(null)).toBeNull()
        expect(service.parseDataChannelMessage({ type: DataChannelMessageType.Countdown })).toBeNull()
        expect(service.parseDataChannelMessage({ type: "nope" })).toBeNull()
    })
})

describe("parseSignalingServerMessage", () => {
    it("parses joined and peer lifecycle messages", () => {
        expect(
            service.parseSignalingServerMessage({
                type: SignalingServerMessageType.Joined,
                peerId: "1",
                roomCode: "ABCDEF",
                roomName: "Room",
                peers: [{ id: "1", nickname: "A", isLeader: true }]
            })
        ).toMatchObject({ type: SignalingServerMessageType.Joined, roomCode: "ABCDEF" })

        expect(
            service.parseSignalingServerMessage({
                type: SignalingServerMessageType.PeerLeft,
                peerId: "2"
            })
        ).toEqual({ type: SignalingServerMessageType.PeerLeft, peerId: "2", newLeaderId: null })

        expect(
            service.parseSignalingServerMessage({
                type: SignalingServerMessageType.PeerLeft,
                peerId: "2",
                newLeaderId: "3"
            })
        ).toEqual({ type: SignalingServerMessageType.PeerLeft, peerId: "2", newLeaderId: "3" })
    })

    it("returns null for malformed signaling payloads", () => {
        expect(service.parseSignalingServerMessage({ type: SignalingServerMessageType.Joined })).toBeNull()
    })
})

describe("parseWebRtcSignalPayload", () => {
    it("parses offer and ice payloads", () => {
        expect(
            service.parseWebRtcSignalPayload({
                kind: WebRtcSignalKind.Offer,
                sdp: { type: "offer", sdp: "v=0" }
            })
        ).toMatchObject({ kind: WebRtcSignalKind.Offer })

        expect(
            service.parseWebRtcSignalPayload({
                kind: WebRtcSignalKind.Ice,
                candidate: { candidate: "candidate:1", sdpMid: "0" }
            })
        ).toMatchObject({ kind: WebRtcSignalKind.Ice })
    })

    it("returns null for unknown kinds", () => {
        expect(service.parseWebRtcSignalPayload({ kind: "nope" })).toBeNull()
    })
})

describe("resolveIceTransportPath", () => {
    function mockConnection(reports: Map<string, object>): RTCPeerConnection {
        return {
            getStats: async () => reports
        } as unknown as RTCPeerConnection
    }

    it("detects a TURN relay path from the selected candidate pair", async () => {
        const reports = new Map<string, object>([
            [
                "pair-1",
                {
                    type: "candidate-pair",
                    selected: true,
                    localCandidateId: "local-1",
                    remoteCandidateId: "remote-1"
                }
            ],
            ["local-1", { type: "local-candidate", candidateType: "relay" }],
            ["remote-1", { type: "remote-candidate", candidateType: "srflx" }]
        ])

        await expect(service.resolveIceTransportPath(mockConnection(reports))).resolves.toBe("turn")
    })

    it("detects a STUN or direct path when neither candidate is relay", async () => {
        const reports = new Map<string, object>([
            [
                "pair-1",
                {
                    type: "candidate-pair",
                    selected: true,
                    localCandidateId: "local-1",
                    remoteCandidateId: "remote-1"
                }
            ],
            ["local-1", { type: "local-candidate", candidateType: "host" }],
            ["remote-1", { type: "remote-candidate", candidateType: "srflx" }]
        ])

        await expect(service.resolveIceTransportPath(mockConnection(reports))).resolves.toBe("stun-or-direct")
    })

    it("falls back to the transport selectedCandidatePairId", async () => {
        const reports = new Map<string, object>([
            ["transport-1", { type: "transport", selectedCandidatePairId: "pair-1" }],
            [
                "pair-1",
                {
                    type: "candidate-pair",
                    localCandidateId: "local-1",
                    remoteCandidateId: "remote-1"
                }
            ],
            ["local-1", { type: "local-candidate", candidateType: "host" }],
            ["remote-1", { type: "remote-candidate", candidateType: "host" }]
        ])

        await expect(service.resolveIceTransportPath(mockConnection(reports))).resolves.toBe("stun-or-direct")
    })

    it("returns unknown when no selected pair is present", async () => {
        await expect(service.resolveIceTransportPath(mockConnection(new Map()))).resolves.toBe("unknown")
    })
})
