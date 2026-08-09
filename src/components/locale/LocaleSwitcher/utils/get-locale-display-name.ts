import { m } from "#/paraglide/messages"
import type { ILocale } from "#/utils/types/locale"
import { Locale } from "#/utils/types/locale"

/**
 * Returns the translated display name for a locale option.
 */
export function getLocaleDisplayName(locale: ILocale): string {
    switch (locale) {
        case Locale.PtBR:
            return m.locale_pt_BR()
        case Locale.EnUS:
            return m.locale_en_US()
        case Locale.FrFR:
            return m.locale_fr_FR()
        case Locale.ItIT:
            return m.locale_it_IT()
        case Locale.DeDE:
            return m.locale_de_DE()
        case Locale.KoKR:
            return m.locale_ko_KR()
    }
}
