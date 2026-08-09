import type { IBingoBoard } from "#/@types/game"
import { Button } from "#/components/ui/button"
import { BREED_BY_ID, WILD_CELL_INDEX } from "#/constants/breeds"
import { cn } from "#/lib/utils.ts"
import { m } from "#/paraglide/messages"

interface IBingoBoardProps {
    board: IBingoBoard
    marks: boolean[]
    onToggle: (index: number) => void
}

export default function BingoBoard({ board, marks, onToggle }: Readonly<IBingoBoardProps>) {
    return (
        <div
            role="grid"
            aria-label={m.game_board_aria()}
            className="mx-auto grid w-full max-w-md grid-cols-5 gap-1.5 sm:max-w-lg sm:gap-2"
        >
            {board.cells.map((breedId, index) => {
                const isWild = index === WILD_CELL_INDEX
                const marked = marks[index] ?? false
                const breed = breedId ? BREED_BY_ID[breedId] : null

                return (
                    <Button
                        key={`${breedId ?? "wild"}-${index}`}
                        type="button"
                        variant="outline"
                        role="gridcell"
                        aria-pressed={marked}
                        aria-label={isWild ? m.game_wild_aria() : (breed?.name ?? "Breed")}
                        disabled={isWild}
                        onClick={() => {
                            if (!isWild) onToggle(index)
                        }}
                        className={cn(
                            "relative flex aspect-square h-auto min-h-11 flex-col items-center justify-center overflow-hidden rounded-xl border p-0.5 shadow-none sm:min-h-14 sm:rounded-2xl",
                            marked
                                ? "border-(--cta) bg-(--cta)/20 hover:bg-(--cta)/25"
                                : "border-(--chip-line) bg-(--surface) hover:bg-(--chip-bg)",
                            isWild && "cursor-default border-(--caramel) bg-(--caramel)/25 hover:bg-(--caramel)/25"
                        )}
                    >
                        {isWild ? (
                            <span className="display-title text-[10px] font-extrabold uppercase tracking-wide text-(--bark) sm:text-xs">
                                {m.game_wild_aria()}
                            </span>
                        ) : (
                            <>
                                <img
                                    src={breed?.imageSrc ?? "/breeds/placeholder.svg"}
                                    alt=""
                                    className="size-[70%] object-contain"
                                    draggable={false}
                                />
                                <span className="sr-only">{breed?.name}</span>
                            </>
                        )}
                        {marked && !isWild ? (
                            <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-(--cta)/15 ring-2 ring-inset ring-(--cta)"
                            />
                        ) : null}
                    </Button>
                )
            })}
        </div>
    )
}
