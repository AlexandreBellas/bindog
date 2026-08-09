import Game from "#/pages/Game"
import { m } from "#/paraglide/messages"
import { seo } from "#/utils/seo"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/game")({
    component: Game,
    head: () => {
        const title = `${m.app_name()} | ${m.game_page_title()}`
        const social = seo({
            title,
            description: m.app_description(),
            path: "/game"
        })

        return {
            meta: social.meta,
            links: social.links
        }
    }
})
