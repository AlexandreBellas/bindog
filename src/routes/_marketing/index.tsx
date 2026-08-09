import Landing from "#/pages/Landing"
import { m } from "#/paraglide/messages"
import { seo } from "#/utils/seo"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_marketing/")({
    component: Landing,
    head: () => {
        const title = `${m.app_name()} | ${m.home_page_title()}`
        const social = seo({
            title,
            description: m.app_description(),
            path: "/"
        })

        return {
            meta: social.meta,
            links: social.links
        }
    }
})
