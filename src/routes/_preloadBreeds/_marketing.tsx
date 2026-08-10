import Footer from "#/components/base/Footer"
import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_preloadBreeds/_marketing")({
    component: MarketingLayout
})

function MarketingLayout() {
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:overflow-hidden">
            <div className="flex min-h-full flex-col justify-between md:min-h-0 md:flex-1 md:justify-start md:overflow-hidden">
                <Outlet />
                <div className="shrink-0 md:hidden">
                    <Footer />
                </div>
            </div>
        </div>
    )
}
