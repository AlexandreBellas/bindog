import { Button } from "#/components/ui/button"
import { m } from "#/paraglide/messages"

interface IBingoButtonProps {
    ready: boolean
    onClaim: () => void
}

export default function BingoButton({ ready, onClaim }: Readonly<IBingoButtonProps>) {
    return (
        <div className="flex w-full flex-col gap-2">
            <Button
                type="button"
                size="lg"
                disabled={!ready}
                onClick={onClaim}
                className="h-14 w-full rounded-2xl bg-(--cta) text-lg font-extrabold tracking-wide text-(--cta-foreground)! hover:bg-(--cta-hover) sm:h-16 sm:text-xl"
            >
                {m.game_bingo_button()}
            </Button>
            {!ready ? (
                <p className="m-0 text-center text-xs font-semibold text-(--bark-soft) sm:text-sm">
                    {m.game_bingo_disabled_hint()}
                </p>
            ) : null}
        </div>
    )
}
