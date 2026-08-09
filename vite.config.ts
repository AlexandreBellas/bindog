/// <reference types="vitest/config" />
import { paraglideVitePlugin } from "@inlang/paraglide-js"
import babel from "@rolldown/plugin-babel"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url))

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const config = defineConfig({
    resolve: {
        tsconfigPaths: true
    },
    // Bind preview to loopback so SPA prerender can reach the local server during `vite build`
    preview: {
        host: "127.0.0.1"
    },
    plugins: [
        devtools(),
        paraglideVitePlugin({
            project: "./project.inlang",
            outdir: "./src/paraglide",
            strategy: ["localStorage", "baseLocale"]
        }),
        tailwindcss(),
        tanstackStart({
            spa: {
                enabled: true,
                prerender: {
                    // Classic static-host entry so `/` works without rewrite tricks
                    outputPath: "/index.html"
                }
            }
        }),
        viteReact(),
        babel({
            presets: [reactCompilerPreset()]
        })
    ],
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: "unit",
                    environment: "jsdom",
                    include: ["src/**/*.test.{ts,tsx}"],
                    setupFiles: ["src/tests/setup.ts"]
                }
            },
            {
                extends: true,
                plugins: [
                    // The plugin will run tests for the stories defined in your Storybook config
                    // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
                    storybookTest({
                        configDir: path.join(dirname, ".storybook")
                    })
                ],
                test: {
                    name: "storybook",
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright({}),
                        instances: [
                            {
                                browser: "chromium"
                            }
                        ]
                    }
                }
            }
        ]
    }
})
export default config
