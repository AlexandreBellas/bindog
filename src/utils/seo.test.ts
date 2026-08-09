import { OG_IMAGE_HEIGHT, OG_IMAGE_PATH, OG_IMAGE_WIDTH, SITE_URL } from "#/constants/site"
import { describe, expect, it } from "vitest"
import { seo } from "./seo"

describe("seo", () => {
    it("returns title, description, and theme meta tags", () => {
        const result = seo({
            title: "Bindog",
            description: "Dog-themed bingo"
        })

        expect(result.meta).toContainEqual({ title: "Bindog" })
        expect(result.meta).toContainEqual({ name: "description", content: "Dog-themed bingo" })
        expect(result.meta).toContainEqual({ name: "theme-color", content: "#c17a3a" })
    })

    it("builds absolute Open Graph and Twitter image URLs from the default asset", () => {
        const result = seo({
            title: "Bindog",
            description: "Dog-themed bingo"
        })
        const imageUrl = `${SITE_URL}${OG_IMAGE_PATH}`

        expect(result.meta).toContainEqual({ property: "og:image", content: imageUrl })
        expect(result.meta).toContainEqual({ property: "og:image:width", content: String(OG_IMAGE_WIDTH) })
        expect(result.meta).toContainEqual({ property: "og:image:height", content: String(OG_IMAGE_HEIGHT) })
        expect(result.meta).toContainEqual({ name: "twitter:card", content: "summary_large_image" })
        expect(result.meta).toContainEqual({ name: "twitter:image", content: imageUrl })
    })

    it("uses custom path and absolute image URL when provided", () => {
        const result = seo({
            title: "Bindog | Game",
            description: "Lobby",
            path: "/game",
            image: "https://cdn.example.com/preview.jpg",
            type: "article"
        })

        expect(result.meta).toContainEqual({ property: "og:url", content: `${SITE_URL}/game` })
        expect(result.meta).toContainEqual({ property: "og:type", content: "article" })
        expect(result.meta).toContainEqual({
            property: "og:image",
            content: "https://cdn.example.com/preview.jpg"
        })
        expect(result.links).toContainEqual({ rel: "canonical", href: `${SITE_URL}/game` })
    })
})
