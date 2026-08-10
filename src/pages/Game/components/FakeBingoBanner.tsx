import { cn } from "#/lib/utils.ts"
import { m } from "#/paraglide/messages"
import { useEffect, useState } from "react"

interface IFakeBingoBannerProps {
    playerName: string | null
}

export default function FakeBingoBanner({ playerName }: Readonly<IFakeBingoBannerProps>) {
    // #region States
    const [visibleName, setVisibleName] = useState<string | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    // #endregion

    // #region Effects
    /**
     * Show a short-lived banner whenever a fake bingo claim arrives.
     * Clear immediately when the claim is wiped (e.g. game restart).
     * Space stays reserved via invisible/visible so the board does not jump.
     */
    useEffect(() => {
        if (!playerName) {
            setIsVisible(false)
            return
        }

        setVisibleName(playerName)
        setIsVisible(true)
        const id = window.setTimeout(() => setIsVisible(false), 10_000)
        return () => window.clearTimeout(id)
    }, [playerName])
    // #endregion

    return (
        <div
            role="status"
            aria-hidden={!isVisible}
            className={cn(
                "rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm font-bold text-destructive transition-[opacity,transform] duration-300 ease-out",
                isVisible ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
            )}
        >
            {m.game_fake_bingo({ name: visibleName ?? "…" })}
        </div>
    )
}
