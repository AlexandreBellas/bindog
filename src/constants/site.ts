/** Production origin used for absolute Open Graph / Twitter preview URLs. */
export const SITE_URL = (
    import.meta.env.VITE_SITE_URL ?? "https://bindog.alebatistella.com"
).replace(/\/$/, "")

export const OG_IMAGE_PATH = "/og-image.jpg"
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const THEME_COLOR = "#c17a3a"
