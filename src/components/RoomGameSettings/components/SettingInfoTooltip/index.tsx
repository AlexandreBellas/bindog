import { Button } from "#/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip"
import { m } from "#/paraglide/messages"
import { CircleHelp } from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { fitBalloonToText } from "./utils/fit-balloon-to-text"

interface ISettingInfoTooltipProps {
    children: ReactNode
}

export default function SettingInfoTooltip({ children }: Readonly<ISettingInfoTooltipProps>) {
    // #region States
    const [canHover, setCanHover] = useState(
        () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches
    )
    // #endregion

    // #region Refs
    const balloonRef = useRef<HTMLSpanElement>(null)
    // #endregion

    // #region Callbacks
    const assignBalloonElement = useCallback((balloon: HTMLSpanElement | null) => {
        balloonRef.current = balloon
        if (balloon) {
            fitBalloonToText(balloon)
        }
    }, [])
    // #endregion

    // #region Effects
    /**
     * Switch between hover tooltips and tap popovers when the pointer capability changes.
     */
    useEffect(() => {
        const media = window.matchMedia("(hover: hover) and (pointer: fine)")
        const onChange = () => {
            setCanHover(media.matches)
        }

        onChange()
        media.addEventListener("change", onChange)
        return () => {
            media.removeEventListener("change", onChange)
        }
    }, [])

    /**
     * Re-measure when the help copy changes while the popover stays open.
     */
    useLayoutEffect(() => {
        const balloon = balloonRef.current
        if (!balloon) {
            return
        }

        fitBalloonToText(balloon)
    }, [children])
    // #endregion

    if (canHover) {
        return (
            <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="inline-flex size-6 shrink-0 rounded-full text-(--bark-soft) hover:bg-transparent hover:text-(--bark)"
                        aria-label={m.setting_info_aria()}
                    >
                        <CircleHelp className="size-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left">{children}</TooltipContent>
            </Tooltip>
        )
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="inline-flex size-6 shrink-0 rounded-full text-(--bark-soft) hover:bg-transparent hover:text-(--bark)"
                    aria-label={m.setting_info_aria()}
                >
                    <CircleHelp className="size-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                data-setting-info=""
                className="w-max min-w-0 max-w-xs border-none bg-transparent p-0 shadow-none"
            >
                <span
                    ref={assignBalloonElement}
                    className="inline-block w-max max-w-xs rounded-md bg-foreground px-3 py-1.5 text-left text-xs text-background"
                >
                    {children}
                </span>
            </PopoverContent>
        </Popover>
    )
}
