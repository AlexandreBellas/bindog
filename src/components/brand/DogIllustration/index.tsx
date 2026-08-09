export default function DogIllustration() {
    return (
        <svg
            viewBox="0 0 320 280"
            role="img"
            aria-hidden="true"
            className="mx-auto h-auto w-full max-w-[18rem] drop-shadow-[0_18px_30px_rgba(90,55,25,0.18)] sm:max-w-[22rem]"
        >
            <ellipse cx="160" cy="248" rx="92" ry="14" className="fill-(--caramel)/20" />
            <path d="M78 118c-18-34-8-72 18-78 16-4 30 10 36 34l8 34c-22 4-42 18-62 10z" className="fill-(--honey)" />
            <path d="M242 118c18-34 8-72-18-78-16-4-30 10-36 34l-8 34c22 4 42 18 62 10z" className="fill-(--honey)" />
            <path d="M64 150c0-52 42-94 96-94s96 42 96 94c0 64-40 104-96 104S64 214 64 150z" className="fill-(--paw)" />
            <ellipse cx="160" cy="168" rx="58" ry="48" className="fill-(--biscuit)" />
            <circle cx="128" cy="142" r="10" className="fill-(--bark)" />
            <circle cx="192" cy="142" r="10" className="fill-(--bark)" />
            <circle cx="131" cy="139" r="3" className="fill-(--foam)" />
            <circle cx="195" cy="139" r="3" className="fill-(--foam)" />
            <ellipse cx="160" cy="168" rx="16" ry="12" className="fill-(--bark)" />
            <path d="M144 184c8 12 24 12 32 0" className="fill-none stroke-(--bark) stroke-[4] stroke-linecap-round" />
            <circle cx="108" cy="168" r="14" className="fill-(--caramel)/35" />
            <circle cx="212" cy="168" r="14" className="fill-(--caramel)/35" />
            <circle cx="54" cy="56" r="10" className="fill-(--caramel) paw-pulse" />
            <circle cx="268" cy="72" r="8" className="fill-(--honey) paw-pulse [animation-delay:0.6s]" />
            <circle cx="246" cy="210" r="7" className="fill-(--paw) paw-pulse [animation-delay:1.2s]" />
        </svg>
    )
}
