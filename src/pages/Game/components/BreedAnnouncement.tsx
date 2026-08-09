import { BREED_BY_ID } from "#/constants/breeds"
import { m } from "#/paraglide/messages"
import { useEffect, useState } from "react"

interface IBreedAnnouncementProps {
    breedId: string | null
    announceStartedAt: number | null
    announceIntervalMs: number
}

export default function BreedAnnouncement({
    breedId,
    announceStartedAt,
    announceIntervalMs
}: Readonly<IBreedAnnouncementProps>) {
    // #region Custom hooks
    const remainingMs = useAnnounceRemainingMs(announceStartedAt, announceIntervalMs)
    const remainingSeconds = Math.ceil(remainingMs / 1000)
    const progress = announceIntervalMs <= 0 ? 0 : Math.min(1, remainingMs / announceIntervalMs)
    const breed = breedId ? BREED_BY_ID[breedId] : null
    // #endregion

    return (
        <section className="flex w-full items-center gap-3 rounded-2xl border border-(--chip-line) bg-(--surface) px-3 py-3 sm:gap-4 sm:px-5 sm:py-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-(--chip-bg) sm:size-20 sm:rounded-2xl">
                {breed ? (
                    <img src={breed.imageSrc} alt="" className="size-full object-contain p-1" draggable={false} />
                ) : (
                    <span className="text-2xl text-(--bark-soft)">…</span>
                )}
            </div>

            <div className="min-w-0 flex-1 space-y-2 text-left">
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-(--kicker)">
                    {m.game_announcement_label()}
                </p>
                <h2 className="display-title m-0 truncate text-xl font-extrabold text-(--bark) sm:text-2xl">
                    {breed?.name ?? "—"}
                </h2>
                <div
                    className="h-2 overflow-hidden rounded-full bg-(--chip-bg)"
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
