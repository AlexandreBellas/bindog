import type { IRoomState } from "#/@types/room"
import { GameEngineMessageType, RoomPhase } from "#/@types/room"
import LeaveGameButton from "#/components/LeaveGameButton"
import RoomCodeCopy from "#/components/RoomCodeCopy"
import { ANNOUNCE_INTERVAL_MS } from "#/constants/announce"
import { m } from "#/paraglide/messages"
import { createInitialMarks, isBingoReady } from "#/services/base/utils/bingo"
import { isPlayerDisqualified } from "#/services/base/utils/bingo-claim"
import { buildLeaderboard, isSittingOutRound } from "#/services/base/utils/leaderboard"
import { createDefaultRoomSettings } from "#/services/base/utils/room-settings"
import { loadRoomSession } from "#/services/public/cloudflare/room-session"
import gameEngine from "#/services/public/game-engine"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import BingoBoard from "./components/BingoBoard"
import BingoButton from "./components/BingoButton"
import BreedAnnouncement from "./components/BreedAnnouncement"
import GameResults from "./components/GameResults"
import PlayersLeftAlert from "./components/PlayersLeftAlert"
import RoundAlertBanner from "./components/RoundAlertBanner"
import WaitingForNextRound from "./components/WaitingForNextRound"

export default function Game() {
    // #region Params
    const navigate = useNavigate()
    const handleLeave = async () => {
        await gameEngine.disconnect()
        await navigate({ to: "/" })
    }
    // #endregion

    // #region Custom hooks
    const handleClaimBingo = () => {
        gameEngine.send({ type: GameEngineMessageType.ClaimBingo })
    }
    const handleRestart = () => {
        gameEngine.send({ type: GameEngineMessageType.RestartGame })
    }
    const handleSettingsChange = (settings: IRoomState["settings"]) => {
        gameEngine.send({ type: GameEngineMessageType.UpdateSettings, settings })
    }
    // #endregion

    // #region States
    const [room, setRoom] = useState<IRoomState | null>(() => gameEngine.getState())
    const [marks, setMarks] = useState<boolean[]>(() => createInitialMarks())
    // #endregion

    // #region Memos
    const boardIdentity = useMemo(() => {
        const board = room?.game?.boards[room.localPlayerId]
        if (!board) return null
        return board.cells.join("|")
    }, [room?.game?.boards, room?.localPlayerId])
    // #endregion

    // #region Effects
    /**
     * Keep the playing shell subscribed to the gateway session.
     */
    useEffect(() => {
        return gameEngine.subscribe(next => {
            setRoom(next)
        })
    }, [])
    /**
     * Guard: playing requires an active gateway session (or a successful restore).
     * Abandoned rooms stay mounted so the home redirect alert can show.
     */
    useEffect(() => {
        if (room?.abandoned) return

        if (room) {
            if (room.phase === RoomPhase.Lobby || room.phase === RoomPhase.Countdown) {
                void navigate({ to: "/matchmaking" })
            }
            return
        }

        let cancelled = false

        void (async () => {
            const restored = await gameEngine.restoreSession()
            if (cancelled) return

            if (!restored) {
                // Transient signaling failures keep localStorage; only bail when nothing to retry.
                if (!loadRoomSession()) {
                    void navigate({ to: "/" })
                }
                return
            }

            if (restored.phase === RoomPhase.Lobby || restored.phase === RoomPhase.Countdown) {
                void navigate({ to: "/matchmaking" })
            }
        })()

        return () => {
            cancelled = true
        }
    }, [navigate, room])
    /**
     * Reset local marks whenever a fresh board is dealt.
     */
    useEffect(() => {
        if (!boardIdentity) return
        setMarks(createInitialMarks())
    }, [boardIdentity])
    // #endregion

    if (!room) return null

    const game = room.game
    const board = game?.boards[room.localPlayerId] ?? null
    const localPlayer = room.players.find(player => player.id === room.localPlayerId)
    const isLeader = Boolean(localPlayer?.isLeader)
    const settings = room.settings ?? createDefaultRoomSettings()
    const disqualified = isPlayerDisqualified(game?.disqualifiedPlayerIds, room.localPlayerId)
    const bingoReady = !disqualified && isBingoReady(marks, settings.fullGridBingo)
    const fakePlayer = game?.fakeBingoPlayerId
        ? room.players.find(player => player.id === game.fakeBingoPlayerId)
        : null
    const disqualifiedOther =
        game?.disqualifiedPlayerId && game.disqualifiedPlayerId !== room.localPlayerId
            ? room.players.find(player => player.id === game.disqualifiedPlayerId)
            : null
    const roundAlert = disqualifiedOther
        ? m.game_disqualified({ name: disqualifiedOther.nickname })
        : fakePlayer
          ? m.game_fake_bingo({ name: fakePlayer.nickname })
          : null
    const winner = game?.winnerId ? room.players.find(player => player.id === game.winnerId) : null
    const sittingOut = isSittingOutRound(room.phase, room.localPlayerId, game?.boards)
    const leaderboard = buildLeaderboard(room.players, room.wins)

    const handleToggleMark = (index: number) => {
        setMarks(current => {
            const next = [...current]
            next[index] = !next[index]
            return next
        })
    }

    return (
        <main className="page-wrap relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:pt-10">
            <div className="rise-in mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 sm:max-w-4xl sm:gap-5">
                <header className="shrink-0 space-y-2 text-center sm:text-left">
                    <p className="island-kicker m-0">{room.name}</p>
                    <div className="flex flex-nowrap items-center gap-2 sm:flex-col sm:items-start sm:gap-2">
                        <h1 className="display-title m-0 shrink-0 whitespace-nowrap text-3xl font-extrabold text-(--bark) sm:text-4xl">
                            {m.game_page_title()}
                        </h1>
                        <RoomCodeCopy
                            code={room.code}
                            variant="compact"
                            className="min-w-0 flex-1 justify-end sm:flex-none sm:justify-start"
                        />
                    </div>
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden sm:gap-5">
                    <div className="min-h-0 max-h-[min(4.75rem,12dvh)] w-full shrink-0 sm:max-h-none">
                        <BreedAnnouncement
                            breedId={game?.currentBreedId ?? null}
                            announceStartedAt={game?.announceStartedAt ?? null}
                            announceIntervalMs={game?.announceIntervalMs ?? ANNOUNCE_INTERVAL_MS}
                            hardMode={settings.hardMode}
                            className="h-full max-h-full"
                        />
                    </div>
                    <RoundAlertBanner message={roundAlert} />

                    <div className="@container-size flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
                        {disqualified && board ? (
                            <WaitingForNextRound
                                title={m.game_disqualified_self()}
                                hint={m.game_disqualified_self_hint()}
                            />
                        ) : board ? (
                            <BingoBoard board={board} marks={marks} onToggle={handleToggleMark} />
                        ) : sittingOut ? (
                            <WaitingForNextRound />
                        ) : (
                            <div className="rounded-2xl border border-dashed border-(--chip-line) bg-(--surface) px-4 py-10 text-center text-sm text-(--bark-soft)">
                                …
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3">
                    {room.phase === RoomPhase.Playing && board && !disqualified ? (
                        <BingoButton
                            ready={bingoReady}
                            onClaim={handleClaimBingo}
                            hint={
                                settings.fullGridBingo
                                    ? m.game_bingo_disabled_hint_full_grid()
                                    : m.game_bingo_disabled_hint()
                            }
                        />
                    ) : null}
                    <LeaveGameButton
                        onConfirm={handleLeave}
                        variant="outline"
                        className="rounded-2xl border-(--chip-line)"
                    />
                </div>
            </div>

            {room.phase === RoomPhase.Ended && !room.abandoned && game?.progress && winner ? (
                <GameResults
                    winnerName={winner.nickname}
                    progress={game.progress}
                    leaderboard={leaderboard}
                    roomCode={room.code}
                    localPlayerId={room.localPlayerId}
                    isLeader={isLeader}
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
                    onRestart={handleRestart}
                />
            ) : null}

            <PlayersLeftAlert open={room.abandoned} onGoHome={handleLeave} />
        </main>
    )
}
