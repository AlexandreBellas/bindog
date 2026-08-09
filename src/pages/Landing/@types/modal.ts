import type { IKeyable } from "#/utils/types/keyable"

export const landingModalKinds = ["start", "join", "settings", "tutorial"] as const

export type ILandingModalKind = (typeof landingModalKinds)[number]

export const LandingModalKind = {
    Start: "start",
    Join: "join",
    Settings: "settings",
    Tutorial: "tutorial"
} as const satisfies Record<IKeyable<ILandingModalKind>, ILandingModalKind>

export type ILandingModal = ILandingModalKind | null
