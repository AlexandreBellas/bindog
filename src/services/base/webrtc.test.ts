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
})

describe("upsertPlayer", () => {
    it("adds a new player or replaces an existing one", () => {
        const withNew = service.upsertPlayer(makeState({ players: [] }), {
            id: "joiner-2",
            nickname: "Gamma",
            isLeader: false
        })
        expect(withNew.players).toHaveLength(1)

        const replaced = service.upsertPlayer(makeState(), {
            id: "joiner-1",
            nickname: "Beta 2",
            isLeader: false
        })
        expect(replaced.players.find(player => player.id === "joiner-1")?.nickname).toBe("Beta 2")
    })
})

describe("removePlayer", () => {
    it("removes a player by id", () => {
        const next = service.removePlayer(makeState(), "joiner-1")
        expect(next.players.map(player => player.id)).toEqual(["leader-1"])
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
                countdown: null
            })
        ).toMatchObject({ type: DataChannelMessageType.Sync, code: "ABCDEF" })

        expect(service.parseDataChannelMessage({ type: DataChannelMessageType.Countdown, value: 2 })).toEqual({
            type: DataChannelMessageType.Countdown,
            value: 2
        })

        expect(service.parseDataChannelMessage({ type: DataChannelMessageType.Playing })).toEqual({
            type: DataChannelMessageType.Playing
        })
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
