import { m } from "#/paraglide/messages"

export default function WaitingForNextRound() {
    return (
        <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-3xl border border-dashed border-(--chip-line) bg-(--surface) px-5 py-10 text-center">
            <p className="display-title m-0 text-xl font-extrabold text-(--bark)">{m.game_waiting_next_round()}</p>
            <p className="m-0 text-sm font-semibold text-(--bark-soft)">{m.game_waiting_next_round_hint()}</p>
        </div>
    )
}
