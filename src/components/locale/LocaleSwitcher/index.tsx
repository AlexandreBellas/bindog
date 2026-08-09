import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select"
import { m } from "#/paraglide/messages"
import { getLocale, locales, setLocale } from "#/paraglide/runtime"
import { localeFlags } from "#/utils/constants/locale-flags"
import type { ILocale } from "#/utils/types/locale"
import { getLocaleDisplayName } from "./utils/get-locale-display-name"

export default function LocaleSwitcher() {
    // #region Custom hooks
    const currentLocale = getLocale()
    // #endregion

    return (
        <div className="flex items-center gap-1.5" aria-label={m.language_label()}>
            <Select
                value={currentLocale}
                onValueChange={value => setLocale(value as ILocale)}
            >
                <SelectTrigger
                    id="locale-switcher"
                    aria-label={m.language_label()}
                    className="h-9 max-w-[11rem] cursor-pointer rounded-full border border-(--chip-line) bg-(--chip-bg) px-3 text-xs font-semibold text-(--bark) shadow-[0_8px_22px_rgba(90,55,25,0.08)] sm:max-w-none sm:text-sm"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                    {locales.map(locale => (
                        <SelectItem key={locale} value={locale}>
                            {localeFlags[locale]} {getLocaleDisplayName(locale)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
