import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog"
import { m } from "#/paraglide/messages"

interface ISettingsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export default function SettingsModal({ open, onOpenChange }: Readonly<ISettingsModalProps>) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="border-(--line) bg-(--foam) sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="display-title text-2xl text-(--bark)">{m.settings_title()}</DialogTitle>
                    <DialogDescription className="sr-only">{m.coming_soon()}</DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}
