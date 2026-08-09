import Landing from "#/pages/Landing"
import { m } from "#/paraglide/messages"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_marketing/")({
    component: Landing,
    head: () => ({
        meta: [
            {
                title: `${m.app_name()} | ${m.home_page_title()}`
            }
        ]
    })
})
