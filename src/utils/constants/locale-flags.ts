import type { ILocale } from "#/utils/types/locale"
import { Locale } from "#/utils/types/locale"

export const localeFlags = {
    [Locale.PtBR]: "🇧🇷",
    [Locale.EnUS]: "🇺🇸",
    [Locale.FrFR]: "🇫🇷",
    [Locale.ItIT]: "🇮🇹",
    [Locale.DeDE]: "🇩🇪",
    [Locale.KoKR]: "🇰🇷"
} as const satisfies Record<ILocale, string>
