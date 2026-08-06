import type { IKeyable } from "#/utils/types/keyable"

export const themeModes = ["light", "dark", "auto"] as const
export type IThemeMode = (typeof themeModes)[number]
export const ThemeMode = {
    Light: "light",
    Dark: "dark",
    Auto: "auto"
} as const satisfies Record<IKeyable<IThemeMode>, IThemeMode>
