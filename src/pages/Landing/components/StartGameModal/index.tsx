import { Button } from "#/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "#/components/ui/dialog"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"
import { m } from "#/paraglide/messages"
import { ConnectRole } from "#/@types/room"
import gameEngine from "#/services/public/game-engine"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import type { FormEvent } from "react"

interface IStartGameModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export default function StartGameModal({ open, onOpenChange }: Readonly<IStartGameModalProps>) {
    // #region Params
    const navigate = useNavigate()
    // #endregion

    // #region States
    const [roomName, setRoomName] = useState("")
    const [nickname, setNickname] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setError(null)
            setIsSubmitting(false)
        }
        onOpenChange(nextOpen)
    }
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)
        setIsSubmitting(true)

        try {
            await gameEngine.connect({
                role: ConnectRole.Leader,
                roomName,
                nickname
            })
            onOpenChange(false)
            await navigate({ to: "/matchmaking" })
        } catch {
            setError(m.error_connection_failed())
            setIsSubmitting(false)
        }
    }
    // #endregion

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="border-(--line) bg-(--foam) sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="display-title text-2xl text-(--bark)">{m.start_game_title()}</DialogTitle>
                    <DialogDescription className="text-base text-(--bark-soft)">
                        {m.start_game_description()}
                    </DialogDescription>
                </DialogHeader>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <Label htmlFor="start-room-name" className="text-(--bark)">
                            {m.room_name_label()}
                        </Label>
                        <Input
                            id="start-room-name"
                            value={roomName}
                            onChange={event => setRoomName(event.target.value)}
                            maxLength={48}
                            required
                            autoComplete="off"
                            className="rounded-xl border-(--chip-line) bg-(--cream) text-(--bark)"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="start-nickname" className="text-(--bark)">
                            {m.nickname_label()}
                        </Label>
                        <Input
                            id="start-nickname"
                            value={nickname}
                            onChange={event => setNickname(event.target.value)}
                            maxLength={24}
                            required
                            autoComplete="nickname"
                            className="rounded-xl border-(--chip-line) bg-(--cream) text-(--bark)"
                        />
                    </div>

                    {error ? <p className="m-0 text-sm text-destructive">{error}</p> : null}

                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full rounded-2xl bg-(--cta) font-bold text-(--cta-foreground)! hover:bg-(--cta-hover)"
                        >
                            {isSubmitting ? m.connecting() : m.create_room_submit()}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
