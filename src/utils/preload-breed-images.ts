import { BREEDS } from "#/constants/breeds"

/** Cap parallel downloads so preloading does not saturate slow mobile links. */
const PRELOAD_CONCURRENCY = 6

let preloadPromise: Promise<void> | null = null

/**
 * Loads one image into the browser cache. Failures are ignored so a missing
 * asset cannot stall the rest of the queue.
 */
function loadImage(src: string): Promise<void> {
    return new Promise(resolve => {
        const image = new Image()
        image.decoding = "async"
        image.onload = () => resolve()
        image.onerror = () => resolve()
        image.src = src
    })
}

/**
 * Downloads every breed image with a small worker pool.
 */
async function preloadAllBreedImages(): Promise<void> {
    const sources = BREEDS.map(breed => breed.imageSrc)
    let nextIndex = 0

    /**
     * Pulls the next pending source from the shared queue until empty.
     */
    const worker = async () => {
        while (nextIndex < sources.length) {
            const index = nextIndex
            nextIndex += 1
            const src = sources[index]
            if (src) await loadImage(src)
        }
    }

    const workers = Array.from({ length: PRELOAD_CONCURRENCY }, () => worker())
    await Promise.all(workers)
}

/**
 * Schedules work after the main thread is idle so first paint stays snappy.
 */
function scheduleIdle(task: () => void): void {
    if (typeof requestIdleCallback === "function") {
        requestIdleCallback(() => task(), { timeout: 2000 })
        return
    }

    window.setTimeout(task, 1)
}

/**
 * Starts a one-shot background preload of all breed art.
 * Safe to call from home and lobby; subsequent calls share the same promise.
 */
export function preloadBreedImages(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve()
    if (preloadPromise) return preloadPromise

    preloadPromise = new Promise(resolve => {
        scheduleIdle(() => {
            void preloadAllBreedImages().then(resolve)
        })
    })

    return preloadPromise
}
