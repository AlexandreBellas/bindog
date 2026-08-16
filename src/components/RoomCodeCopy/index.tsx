import { Button } from "#/components/ui/button"
import { cn } from "#/lib/utils"
import { m } from "#/paraglide/messages"
import { Check, Copy } from "lucide-react"
import { useState } from "react"

interface IRoomCodeCopyProps {
    code: string
    variant?: "hero" | "compact"
    className?: string
}

export default function RoomCodeCopy({ code, variant = "hero", className }: Readonly<IRoomCodeCopyProps>) {
    // #region States
    const [copied, setCopied] = useState(false)
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        } catch {
            setCopied(false)
        }
    }
    // #endregion

    if (variant === "compact") {
        const copyLabel = copied ? m.lobby_code_copied() : m.lobby_copy_code()

        return (
            <div
                className={cn(
                    "@container/copy flex min-w-0 flex-nowrap items-center justify-center gap-2 sm:justify-start",
                    className
                )}
            >
                <p className="m-0 shrink-0 font-mono text-lg font-extrabold tracking-[0.12em] text-(--bark) sm:tracking-[0.2em]">
                    {code}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={copyLabel}
                    onClick={() => {
                        void handleCopy()
                    }}
                    className="shrink-0 rounded-xl border-(--chip-line) @max-[16rem]/copy:px-2"
                >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    <span className="@max-[16rem]/copy:hidden">{copyLabel}</span>
                </Button>
            </div>
        )
    }

    return (
        <section
            className={cn(
                "flex flex-col items-center gap-3 rounded-3xl border border-(--chip-line) bg-(--surface) px-5 py-6 text-center",
                className
            )}
        >
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-(--kicker)">
                {m.lobby_room_code()}
            </p>
            <p className="display-title m-0 text-4xl font-extrabold tracking-[0.28em] text-(--bark) sm:text-5xl">
                {code}
            </p>
            <Button
                type="button"
                variant="outline"
                onClick={() => {
                    void handleCopy()
                }}
                className="rounded-2xl border-(--chip-line)"
            >
                {copied ? m.lobby_code_copied() : m.lobby_copy_code()}
            </Button>
        </section>
    )
}
