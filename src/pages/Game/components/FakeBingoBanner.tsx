import { m } from "#/paraglide/messages"
import { useEffect, useState } from "react"

interface IFakeBingoBannerProps {
    playerName: string | null
}

export default function FakeBingoBanner({ playerName }: Readonly<IFakeBingoBannerProps>) {
    // #region States
    const [visibleName, setVisibleName] = useState<string | null>(null)
    // #endregion

    // #region Effects
    /**
     * Show a short-lived banner whenever a fake bingo claim arrives.
     * Clear immediately when the claim is wiped (e.g. game restart).
     */
    useEffect(() => {
        if (!playerName) {
            setVisibleName(null)
            return
        }

        setVisibleName(playerName)
        const id = window.setTimeout(() => setVisibleName(null), 10_000)
        return () => window.clearTimeout(id)
    }, [playerName])
    // #endregion

    if (!visibleName) return null

    return (
        <div
            role="status"
            className="rise-in rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm font-bold text-destructive"
        >
            {m.game_fake_bingo({ name: visibleName })}
        </div>
    )
}
