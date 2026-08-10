import { usePreloadBreedImages } from "#/hooks/use-preload-breed-images"
import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_preloadBreeds")({
    component: PreloadBreedsLayout
})

function PreloadBreedsLayout() {
    // #region Custom hooks
    usePreloadBreedImages()
    // #endregion

    return <Outlet />
}
