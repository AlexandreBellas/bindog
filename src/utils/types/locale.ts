import type { IKeyable } from "#/utils/types/keyable"

export const locales = ["en-US", "pt-BR", "fr-FR", "it-IT", "de-DE", "ko-KR"] as const

export type ILocale = (typeof locales)[number]

export const Locale = {
    EnUS: "en-US",
    PtBR: "pt-BR",
    FrFR: "fr-FR",
    ItIT: "it-IT",
    DeDE: "de-DE",
    KoKR: "ko-KR"
} as const satisfies Record<IKeyable<ILocale>, ILocale>
