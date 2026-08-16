import { cn } from "#/lib/utils.ts"
import { useEffect, useState } from "react"

interface IRoundAlertBannerProps {
    message: string | null
}

export default function RoundAlertBanner({ message }: Readonly<IRoundAlertBannerProps>) {
    // #region States
    const [visibleMessage, setVisibleMessage] = useState<string | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    // #endregion

    // #region Effects
    /**
     * Show a short-lived banner whenever a round alert arrives.
     * Clear immediately when the claim is wiped (e.g. game restart).
     * Space stays reserved via invisible/visible so the board does not jump.
     */
    useEffect(() => {
        if (!message) {
            setIsVisible(false)
            return
        }

        setVisibleMessage(message)
        setIsVisible(true)
        const id = window.setTimeout(() => setIsVisible(false), 10_000)
        return () => window.clearTimeout(id)
    }, [message])
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
            {visibleMessage ?? "…"}
        </div>
    )
}
