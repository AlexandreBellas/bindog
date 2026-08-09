import type { IKeyable } from "#/utils/types/keyable"
import type { IRoomPlayer, IRoomState } from "./room"

export const dataChannelMessageTypes = ["sync", "countdown", "playing", "peer-hello"] as const

export type IDataChannelMessageType = (typeof dataChannelMessageTypes)[number]

export const DataChannelMessageType = {
    Sync: "sync",
    Countdown: "countdown",
    Playing: "playing",
    PeerHello: "peer-hello"
} as const satisfies Record<IKeyable<IDataChannelMessageType>, IDataChannelMessageType>

export interface ISyncMessage {
    type: typeof DataChannelMessageType.Sync
    code: string
    name: string
    players: IRoomPlayer[]
    phase: IRoomState["phase"]
    countdown: number | null
}

export interface ICountdownMessage {
    type: typeof DataChannelMessageType.Countdown
    value: number
}

export interface IPlayingMessage {
    type: typeof DataChannelMessageType.Playing
}

export interface IPeerHelloMessage {
    type: typeof DataChannelMessageType.PeerHello
    player: IRoomPlayer
}

export type IDataChannelMessage = ISyncMessage | ICountdownMessage | IPlayingMessage | IPeerHelloMessage

export const signalingClientMessageTypes = ["join", "signal", "leave"] as const

export type ISignalingClientMessageType = (typeof signalingClientMessageTypes)[number]

export const SignalingClientMessageType = {
    Join: "join",
    Signal: "signal",
    Leave: "leave"
} as const satisfies Record<IKeyable<ISignalingClientMessageType>, ISignalingClientMessageType>

export interface ISignalingJoinMessage {
    type: typeof SignalingClientMessageType.Join
    role: "leader" | "joiner"
    peerId: string
    nickname: string
}

export interface ISignalingRelayMessage {
    type: typeof SignalingClientMessageType.Signal
    to: string
    payload: IWebRtcSignalPayload
}

export interface ISignalingLeaveMessage {
    type: typeof SignalingClientMessageType.Leave
}

export type ISignalingClientMessage = ISignalingJoinMessage | ISignalingRelayMessage | ISignalingLeaveMessage

export const webRtcSignalKinds = ["offer", "answer", "ice"] as const

export type IWebRtcSignalKind = (typeof webRtcSignalKinds)[number]

export const WebRtcSignalKind = {
    Offer: "offer",
    Answer: "answer",
    Ice: "ice"
} as const satisfies Record<IKeyable<IWebRtcSignalKind>, IWebRtcSignalKind>

export interface IWebRtcOfferPayload {
    kind: typeof WebRtcSignalKind.Offer
    sdp: RTCSessionDescriptionInit
}

export interface IWebRtcAnswerPayload {
    kind: typeof WebRtcSignalKind.Answer
    sdp: RTCSessionDescriptionInit
}

export interface IWebRtcIcePayload {
    kind: typeof WebRtcSignalKind.Ice
    candidate: RTCIceCandidateInit
}

export type IWebRtcSignalPayload = IWebRtcOfferPayload | IWebRtcAnswerPayload | IWebRtcIcePayload

export const signalingServerMessageTypes = ["joined", "peer-joined", "peer-left", "signal", "error"] as const

export type ISignalingServerMessageType = (typeof signalingServerMessageTypes)[number]

export const SignalingServerMessageType = {
    Joined: "joined",
    PeerJoined: "peer-joined",
    PeerLeft: "peer-left",
    Signal: "signal",
    Error: "error"
} as const satisfies Record<IKeyable<ISignalingServerMessageType>, ISignalingServerMessageType>

export interface ISignalingJoinedMessage {
    type: typeof SignalingServerMessageType.Joined
    peerId: string
    roomCode: string
    roomName: string
    peers: IRoomPlayer[]
}

export interface ISignalingPeerJoinedMessage {
    type: typeof SignalingServerMessageType.PeerJoined
    peer: IRoomPlayer
}

export interface ISignalingPeerLeftMessage {
    type: typeof SignalingServerMessageType.PeerLeft
    peerId: string
    /** Present when the departing peer was the leader and another peer was promoted. */
    newLeaderId: string | null
}

export interface ISignalingIncomingSignalMessage {
    type: typeof SignalingServerMessageType.Signal
    from: string
    payload: IWebRtcSignalPayload
}

export interface ISignalingErrorMessage {
    type: typeof SignalingServerMessageType.Error
    message: string
}

export type ISignalingServerMessage =
    | ISignalingJoinedMessage
    | ISignalingPeerJoinedMessage
    | ISignalingPeerLeftMessage
    | ISignalingIncomingSignalMessage
    | ISignalingErrorMessage

export interface IIceServersResponse {
    iceServers: RTCIceServer[]
}

/** How the selected ICE candidate pair reaches the remote peer. */
export const iceTransportPaths = ["turn", "stun-or-direct", "unknown"] as const
export type IIceTransportPath = (typeof iceTransportPaths)[number]
export const IceTransportPath = {
    Turn: "turn",
    StunOrDirect: "stun-or-direct",
    Unknown: "unknown"
} as const satisfies Record<IKeyable<IIceTransportPath>, IIceTransportPath>
