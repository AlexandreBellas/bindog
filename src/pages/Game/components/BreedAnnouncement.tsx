import { BREED_BY_ID } from "#/constants/breeds"
import { cn } from "#/lib/utils.ts"
import { m } from "#/paraglide/messages"
import { getBreedName } from "#/utils/get-breed-name"
import { useEffect, useState } from "react"

interface IBreedAnnouncementProps {
    breedId: string | null
    announceStartedAt: number | null
    announceIntervalMs: number
    hardMode?: boolean
    className?: string
}

export default function BreedAnnouncement({
    breedId,
    announceStartedAt,
    announceIntervalMs,
    hardMode = false,
    className
}: Readonly<IBreedAnnouncementProps>) {
    // #region Custom hooks
    const remainingMs = useAnnounceRemainingMs(announceStartedAt, announceIntervalMs)
    const remainingSeconds = Math.ceil(remainingMs / 1000)
    const progress = announceIntervalMs <= 0 ? 0 : Math.min(1, remainingMs / announceIntervalMs)
    const breed = breedId ? BREED_BY_ID[breedId] : null
    // #endregion

    return (
        <section
            className={cn(
                "flex w-full min-h-0 items-center gap-2 overflow-hidden rounded-xl border border-(--chip-line) bg-(--surface) px-2 py-1.5 sm:gap-4 sm:rounded-2xl sm:px-5 sm:py-4",
                className
            )}
        >
            {!hardMode ? (
                <div className="flex aspect-square h-full max-h-14 min-h-0 w-auto shrink-0 items-center justify-center overflow-hidden rounded-lg bg-(--chip-bg) sm:size-20 sm:max-h-none sm:rounded-2xl">
                    {breed ? (
                        <img
                            src={breed.imageSrc}
                            alt=""
                            className="size-full min-h-0 object-contain p-0.5 sm:p-1"
                            draggable={false}
                        />
                    ) : (
                        <span className="text-lg text-(--bark-soft) sm:text-2xl">…</span>
                    )}
                </div>
            ) : null}

            <div className="min-h-0 min-w-0 flex-1 space-y-1 text-left sm:space-y-2">
                <p className="m-0 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-(--kicker) sm:text-xs">
                    {m.game_announcement_label()}
                </p>
                <h2 className="display-title m-0 truncate text-sm font-extrabold leading-tight text-(--bark) sm:overflow-visible sm:text-2xl sm:leading-normal sm:whitespace-normal sm:text-clip">
                    {breed ? getBreedName(breed.id) : "—"}
                </h2>
                <div
                    className="h-1.5 overflow-hidden rounded-full bg-(--chip-bg) sm:h-2"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={Math.round(announceIntervalMs / 1000)}
                    aria-valuenow={remainingSeconds}
                    aria-label={m.game_timer_aria({ seconds: String(remainingSeconds) })}
                >
                    <div
                        className="h-full rounded-full bg-(--cta) transition-[width] duration-100 ease-linear"
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>
            </div>
        </section>
    )
}

function useAnnounceRemainingMs(announceStartedAt: number | null, announceIntervalMs: number): number {
    // #region States
    const [remainingMs, setRemainingMs] = useState(announceIntervalMs)
    // #endregion

    // #region Effects
    /**
     * Tick the shared countdown from announceStartedAt so every client stays aligned.
     */
    useEffect(() => {
        if (announceStartedAt === null) {
            setRemainingMs(announceIntervalMs)
            return
        }

        const update = () => {
            const elapsed = Date.now() - announceStartedAt
            setRemainingMs(Math.max(0, announceIntervalMs - elapsed))
        }

        update()
        const id = window.setInterval(update, 100)
        return () => window.clearInterval(id)
    }, [announceStartedAt, announceIntervalMs])
    // #endregion

    return remainingMs
}
