/// <reference types="vite/client" />

/**
 * App-specific `VITE_*` variables. Built-ins (`DEV`, `PROD`, `MODE`, …)
 * come from `vite/client` via interface merging.
 *
 * @see https://vite.dev/guide/env-and-mode.html
 */
interface ImportMetaEnv {
    readonly VITE_SIGNALING_URL: string
    readonly VITE_SITE_URL?: string
    readonly VITE_POSTHOG_KEY?: string
    readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
