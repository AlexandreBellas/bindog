import type { IPlayerProgress } from "#/@types/game"
import { ProgressLineKind } from "#/@types/game"
import { Button } from "#/components/ui/button"
import { m } from "#/paraglide/messages"

interface IGameResultsProps {
    winnerName: string
    progress: IPlayerProgress[]
    isLeader: boolean
    onRestart: () => void
}

export default function GameResults({ winnerName, progress, isLeader, onRestart }: Readonly<IGameResultsProps>) {
    return (
        <div className="rise-in absolute inset-0 z-20 flex items-end justify-center overflow-y-auto bg-(--bark)/45 p-4 backdrop-blur-[2px] sm:items-center">
            <section className="my-auto flex w-full max-w-md flex-col gap-4 rounded-3xl border border-(--chip-line) bg-(--surface) p-5 shadow-lg sm:p-6">
                <header className="space-y-2 text-center">
                    <p className="island-kicker m-0">{m.game_results_title()}</p>
                    <h2 className="display-title m-0 text-3xl font-extrabold text-(--bark) sm:text-4xl">
                        {m.game_winner({ name: winnerName })}
                    </h2>
                </header>

                <ol className="m-0 flex list-none flex-col gap-2 p-0">
                    {progress.map((entry, rank) => (
                        <li
                            key={entry.playerId}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-(--chip-line) bg-(--chip-bg) px-3 py-2.5"
                        >
                            <div className="min-w-0 text-left">
                                <p className="m-0 truncate text-sm font-bold text-(--bark)">
                                    {rank + 1}. {entry.nickname}
                                </p>
                                <p className="m-0 text-xs font-semibold text-(--bark-soft)">
                                    {m.game_progress_line({
                                        filled: String(entry.filled),
                                        total: String(entry.total),
                                        kind:
                                            entry.kind === ProgressLineKind.Row
                                                ? m.game_progress_row()
                                                : m.game_progress_col(),
                                        index: String(entry.index + 1)
                                    })}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>

                {isLeader ? (
                    <Button
                        type="button"
                        size="lg"
                        onClick={onRestart}
                        className="h-12 rounded-2xl bg-(--cta) text-base font-bold text-(--cta-foreground)! hover:bg-(--cta-hover)"
                    >
                        {m.game_restart()}
                    </Button>
                ) : (
                    <p className="m-0 rounded-2xl border border-(--chip-line) bg-(--chip-bg) px-4 py-3 text-center text-sm font-semibold text-(--bark-soft)">
                        {m.game_waiting_restart()}
                    </p>
                )}
            </section>
        </div>
    )
}
