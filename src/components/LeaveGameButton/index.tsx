import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "#/components/ui/alert-dialog"
import { Button } from "#/components/ui/button"
import { m } from "#/paraglide/messages"
import type { ComponentProps } from "react"

interface ILeaveGameButtonProps {
    onConfirm: () => void | Promise<void>
    variant?: ComponentProps<typeof Button>["variant"]
    className?: string
}

export default function LeaveGameButton({
    onConfirm,
    variant = "outline",
    className
}: Readonly<ILeaveGameButtonProps>) {
    // #region Params
    const handleConfirm = () => {
        void onConfirm()
    }
    // #endregion

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button type="button" variant={variant} className={className}>
                    {m.leave_game()}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-(--line) bg-(--foam)">
                <AlertDialogHeader>
                    <AlertDialogTitle className="display-title text-(--bark)">{m.leave_confirm_title()}</AlertDialogTitle>
                    <AlertDialogDescription className="text-(--bark-soft)">
                        {m.leave_confirm_description()}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-2xl border-(--chip-line)">{m.cancel()}</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={handleConfirm}
                        className="rounded-2xl font-bold"
                    >
                        {m.leave_confirm_action()}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
