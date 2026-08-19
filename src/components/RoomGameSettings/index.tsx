import type { IRoomSettings } from "#/@types/room"
import { Label } from "#/components/ui/label"
import { Switch } from "#/components/ui/switch"
import { m } from "#/paraglide/messages"
import SettingInfoTooltip from "./components/SettingInfoTooltip"

interface IRoomGameSettingsProps {
    settings: IRoomSettings
    editable: boolean
    onChange: (settings: IRoomSettings) => void
}

export default function RoomGameSettings({ settings, editable, onChange }: Readonly<IRoomGameSettingsProps>) {
    return (
        <section className="space-y-3 rounded-2xl border border-(--chip-line) bg-(--chip-bg) px-4 py-3">
            <h2 className="display-title m-0 text-lg font-bold text-(--bark)">{m.lobby_game_options()}</h2>
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <Label htmlFor="setting-full-grid" className="text-sm font-semibold text-(--bark)">
                            {m.setting_full_grid_label()}
                        </Label>
                        <SettingInfoTooltip>{m.setting_full_grid_tooltip()}</SettingInfoTooltip>
                    </div>
                    <Switch
                        id="setting-full-grid"
                        checked={settings.fullGridBingo}
                        disabled={!editable}
                        onCheckedChange={checked => onChange({ ...settings, fullGridBingo: checked })}
                        aria-label={m.setting_full_grid_label()}
                    />
                </div>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <Label htmlFor="setting-hard-mode" className="text-sm font-semibold text-(--bark)">
                            {m.setting_hard_mode_label()}
                        </Label>
                        <SettingInfoTooltip>{m.setting_hard_mode_tooltip()}</SettingInfoTooltip>
                    </div>
                    <Switch
                        id="setting-hard-mode"
                        checked={settings.hardMode}
                        disabled={!editable}
                        onCheckedChange={checked => onChange({ ...settings, hardMode: checked })}
                        aria-label={m.setting_hard_mode_label()}
                    />
                </div>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <Label htmlFor="setting-limit-bindogs" className="text-sm font-semibold text-(--bark)">
                            {m.setting_limit_bindogs_label()}
                        </Label>
                        <SettingInfoTooltip>{m.setting_limit_bindogs_tooltip()}</SettingInfoTooltip>
                    </div>
                    <Switch
                        id="setting-limit-bindogs"
                        checked={settings.limitIncorrectBindogs}
                        disabled={!editable}
                        onCheckedChange={checked => onChange({ ...settings, limitIncorrectBindogs: checked })}
                        aria-label={m.setting_limit_bindogs_label()}
                    />
                </div>
            </div>
        </section>
    )
}
