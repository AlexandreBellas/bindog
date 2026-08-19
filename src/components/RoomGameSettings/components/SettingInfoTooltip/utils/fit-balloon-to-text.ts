import { VIEWPORT_BALLOON_GUTTER_PX } from "../constants/balloon"

/**
 * Shrinks a wrapped balloon to the narrowest width that still fits the same
 * number of lines. `width: max-content` plus a `max-width` cap leaves the box
 * at the cap, so wrapped lines look right-padded.
 */
export function fitBalloonToText(balloon: HTMLElement) {
    balloon.style.width = "max-content"

    const naturalWidth = balloon.getBoundingClientRect().width
    if (naturalWidth === 0) {
        balloon.style.removeProperty("width")
        return
    }

    const computedMaxWidth = Number.parseFloat(getComputedStyle(balloon).maxWidth)
    const maxWidth = Math.min(
        Number.isFinite(computedMaxWidth) ? computedMaxWidth : Number.POSITIVE_INFINITY,
        window.innerWidth - VIEWPORT_BALLOON_GUTTER_PX
    )

    if (naturalWidth <= maxWidth) {
        balloon.style.width = `${naturalWidth}px`
        return
    }

    balloon.style.width = `${maxWidth}px`
    const wrappedHeight = balloon.scrollHeight
    let tooNarrow = 0
    let fits = maxWidth

    while (fits - tooNarrow > 1) {
        const mid = (tooNarrow + fits) / 2
        balloon.style.width = `${mid}px`
        if (balloon.scrollHeight > wrappedHeight) {
            tooNarrow = mid
        } else {
            fits = mid
        }
    }

    balloon.style.width = `${fits}px`
}
