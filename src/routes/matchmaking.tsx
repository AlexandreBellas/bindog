import Matchmaking from "#/pages/Matchmaking"
import { m } from "#/paraglide/messages"
import { seo } from "#/utils/seo"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/matchmaking")({
    component: Matchmaking,
    head: () => {
        const title = `${m.app_name()} | ${m.matchmaking_page_title()}`
        const social = seo({
            title,
            description: m.app_description(),
            path: "/matchmaking"
        })

        return {
            meta: social.meta,
            links: social.links
        }
    }
})
