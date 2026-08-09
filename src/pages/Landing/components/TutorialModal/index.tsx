import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog"
import { m } from "#/paraglide/messages"

interface ITutorialModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export default function TutorialModal({ open, onOpenChange }: Readonly<ITutorialModalProps>) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto border-(--line) bg-(--foam) sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="display-title text-2xl text-(--bark)">{m.tutorial_title()}</DialogTitle>
                    <DialogDescription className="text-base text-(--bark-soft)">{m.tutorial_intro()}</DialogDescription>
                </DialogHeader>

                <div className="space-y-5 text-left">
                    <section className="space-y-2">
                        <h3 className="display-title text-lg font-bold text-(--caramel-deep)">
                            {m.tutorial_bingo_title()}
                        </h3>
                        <p className="text-sm leading-relaxed text-(--bark-soft) sm:text-base">
                            {m.tutorial_bingo_body()}
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h3 className="display-title text-lg font-bold text-(--caramel-deep)">
                            {m.tutorial_bindog_title()}
                        </h3>
                        <p className="text-sm leading-relaxed text-(--bark-soft) sm:text-base">
                            {m.tutorial_bindog_body()}
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h3 className="display-title text-lg font-bold text-(--caramel-deep)">
                            {m.tutorial_multiplayer_title()}
                        </h3>
                        <p className="text-sm leading-relaxed text-(--bark-soft) sm:text-base">
                            {m.tutorial_multiplayer_body()}
                        </p>
                    </section>
                </div>
            </DialogContent>
        </Dialog>
    )
}
