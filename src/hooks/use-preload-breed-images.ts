import { preloadBreedImages } from "#/utils/preload-breed-images"
import { useEffect } from "react"

/**
 * Warms the browser cache for breed images while the player is on home or lobby.
 */
export function usePreloadBreedImages(): void {
    // #region Effects
    /**
     * Kick off a shared background download; safe across remounts / navigation.
     */
    useEffect(() => {
        void preloadBreedImages()
    }, [])
    // #endregion
}
