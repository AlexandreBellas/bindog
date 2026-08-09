import {
    OG_IMAGE_HEIGHT,
    OG_IMAGE_PATH,
    OG_IMAGE_WIDTH,
    SITE_URL,
    THEME_COLOR
} from "#/constants/site"

type ISeoInput = {
    title: string
    description: string
    /** Absolute or site-relative path. Defaults to the shared Bindog preview image. */
    image?: string
    /** Absolute or site-relative path. Defaults to the site root. */
    path?: string
    type?: "website" | "article"
}

/**
 * Resolves a site-relative path or absolute URL into a full absolute URL.
 */
function toAbsoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl
    }

    return `${SITE_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`
}

/**
 * Builds title, description, Open Graph, and Twitter Card meta tags for link previews
 * (WhatsApp, Discord, Slack, iMessage, etc.).
 */
export function seo({
    title,
    description,
    image = OG_IMAGE_PATH,
    path = "/",
    type = "website"
}: ISeoInput) {
    const url = toAbsoluteUrl(path)
    const imageUrl = toAbsoluteUrl(image)

    return {
        meta: [
            { title },
            { name: "description", content: description },
            { name: "theme-color", content: THEME_COLOR },
            { name: "application-name", content: "Bindog" },

            // Open Graph
            { property: "og:site_name", content: "Bindog" },
            { property: "og:type", content: type },
            { property: "og:url", content: url },
            { property: "og:title", content: title },
            { property: "og:description", content: description },
            { property: "og:image", content: imageUrl },
            { property: "og:image:secure_url", content: imageUrl },
            { property: "og:image:type", content: "image/jpeg" },
            { property: "og:image:width", content: String(OG_IMAGE_WIDTH) },
            { property: "og:image:height", content: String(OG_IMAGE_HEIGHT) },
            { property: "og:image:alt", content: title },
            { property: "og:locale", content: "en_US" },

            // Twitter / X
            { name: "twitter:card", content: "summary_large_image" },
            { name: "twitter:title", content: title },
            { name: "twitter:description", content: description },
            { name: "twitter:image", content: imageUrl },
            { name: "twitter:image:alt", content: title }
        ],
        links: [
            { rel: "canonical", href: url },
            { rel: "manifest", href: "/manifest.json" }
        ]
    }
}
