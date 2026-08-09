import { localeFlags } from "#/utils/constants/locale-flags"
import { m } from "#/paraglide/messages"
import { getLocale, locales, setLocale } from "#/paraglide/runtime"
import type { ILocale } from "#/utils/types/locale"
import { getLocaleDisplayName } from "./utils/get-locale-display-name"

export default function LocaleSwitcher() {
    // #region Custom hooks
    const currentLocale = getLocale()
    // #endregion

    return (
        <div className="flex items-center gap-1.5" aria-label={m.language_label()}>
            <label className="sr-only" htmlFor="locale-switcher">
                {m.language_label()}
            </label>
            <select
                id="locale-switcher"
                value={currentLocale}
                onChange={event => setLocale(event.target.value as ILocale)}
                className="h-9 max-w-[11rem] cursor-pointer rounded-full border border-(--chip-line) bg-(--chip-bg) px-3 text-xs font-semibold text-(--bark) shadow-[0_8px_22px_rgba(90,55,25,0.08)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:max-w-none sm:text-sm"
            >
                {locales.map(locale => (
                    <option key={locale} value={locale}>
                        {localeFlags[locale]} {getLocaleDisplayName(locale)}
                    </option>
                ))}
            </select>
        </div>
    )
}
