import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "#/components/ui/alert-dialog"
import { m } from "#/paraglide/messages"

interface IPlayersLeftAlertProps {
    open: boolean
    onGoHome: () => void | Promise<void>
}

export default function PlayersLeftAlert({ open, onGoHome }: Readonly<IPlayersLeftAlertProps>) {
    // #region Params
    const handleGoHome = () => {
        void onGoHome()
    }
    // #endregion

    return (
        <AlertDialog open={open}>
            <AlertDialogContent className="border-(--line) bg-(--foam)">
                <AlertDialogHeader>
                    <AlertDialogTitle className="display-title text-(--bark)">
                        {m.game_players_left_title()}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-(--bark-soft)">
                        {m.game_players_left_description()}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={handleGoHome} className="rounded-2xl font-bold">
                        {m.back_home()}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
