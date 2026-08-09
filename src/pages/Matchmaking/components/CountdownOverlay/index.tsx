import { m } from "#/paraglide/messages"

interface ICountdownOverlayProps {
    value: number
}

export default function CountdownOverlay({ value }: Readonly<ICountdownOverlayProps>) {
    return (
        <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-(--bark)/55 backdrop-blur-sm"
            role="status"
            aria-live="assertive"
            aria-label={m.countdown_aria({ value: String(value) })}
        >
            <p className="display-title m-0 animate-pulse text-8xl font-extrabold text-(--foam) sm:text-9xl">{value}</p>
        </div>
    )
}
