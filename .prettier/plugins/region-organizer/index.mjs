/**
 * Prettier plugin that auto-organises React component pre-JSX statements into
 * `// #region` blocks following the canonical order defined in
 * `.eslint/rules/region-ordering.ts` and the workspace
 * `react-component-structure.mdc` cursor rule.
 *
 * The plugin extends — *not replaces* — the built-in `typescript` parser by
 * wrapping its `preprocess` step. Default Prettier formatting still runs on
 * the (already region-organised) source.
 *
 * Activation: register in `.prettierrc.json` under `plugins`. The transform
 * kicks in for `.ts` and `.tsx` files (React components and hooks);
 * `.d.ts` declaration files and other extensions pass through untouched.
 */

import { parsers as typescriptParsers } from "prettier/plugins/typescript"
import { organizeRegions } from "./organizer.mjs"

function shouldTransform(options) {
    const filepath = options && options.filepath
    if (!filepath) return false
    if (filepath.endsWith(".d.ts")) return false
    return filepath.endsWith(".tsx") || filepath.endsWith(".ts")
}

function makeWrappedParser(original) {
    const upstream = original.preprocess

    return {
        ...original,
        preprocess(text, options) {
            const initial = upstream ? upstream(text, options) : text
            if (!shouldTransform(options)) return initial
            try {
                return organizeRegions(initial)
            } catch (err) {
                if (process.env.NODE_ENV !== "production")
                    console.warn("[region-organizer] failed to organise regions:", err)

                return initial
            }
        }
    }
}

export const parsers = {
    typescript: makeWrappedParser(typescriptParsers.typescript)
}

export default {
    parsers
}
