import { m } from "#/paraglide/messages"
import type { IRoomPlayer } from "#/@types/room"
import { Crown } from "lucide-react"

interface IPlayerListProps {
    players: IRoomPlayer[]
    localPlayerId: string
}

export default function PlayerList({ players, localPlayerId }: Readonly<IPlayerListProps>) {
    return (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {players.map(player => {
                const isLocal = player.id === localPlayerId

                return (
                    <li
                        key={player.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-(--chip-line) bg-(--foam) px-4 py-3"
                    >
                        <div className="flex min-w-0 items-center gap-2">
                            {player.isLeader ? (
                                <Crown
                                    className="size-4 shrink-0 text-(--caramel-deep)"
                                    aria-label={m.lobby_leader()}
                                />
                            ) : null}
                            <span className="truncate font-semibold text-(--bark)">{player.nickname}</span>
                        </div>
                        {isLocal ? (
                            <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-(--kicker)">
                                {m.lobby_you()}
                            </span>
                        ) : null}
                    </li>
                )
            })}
        </ul>
    )
}
