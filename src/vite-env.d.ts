/// <reference types="vite/client" />

/**
 * Vite built-ins plus app `VITE_*` variables.
 * Declared here so `import.meta.env` stays typed even when `vite/client`
 * is not merged into the editor program.
 *
 * @see https://vite.dev/guide/env-and-mode.html
 */
interface ImportMetaEnv {
    readonly BASE_URL: string
    readonly MODE: string
    readonly DEV: boolean
    readonly PROD: boolean
    readonly SSR: boolean
    readonly VITE_SIGNALING_URL: string
    readonly VITE_SITE_URL?: string
    readonly VITE_POSTHOG_KEY?: string
    readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
