/**
 * Prettier plugin that removes ESLint directive comments from source files.
 *
 * Strips all forms of ESLint directives:
 *   - `// eslint-disable-next-line [rules]`
 *   - `// eslint-disable-line [rules]`
 *   - `/* eslint-disable [rules] *​/`
 *   - `/* eslint-enable [rules] *​/`
 *
 * The plugin extends — it does *not* replace — the TypeScript parser by
 * wrapping its `preprocess` step. To avoid the plugin key collision that
 * would otherwise make Prettier's last-plugin-wins behaviour silently drop
 * the sibling plugins, this wrapper chains off the already-processed parser
 * exported by `../design-token-formatter/index.mjs`.
 * Default Prettier formatting still runs afterwards.
 *
 * Activation: register in `.prettierrc.json` under `plugins` (after
 * `design-token-formatter`). The transform kicks in for `.ts` and `.tsx`
 * files; `.d.ts` declaration files and other extensions pass through
 * untouched.
 */

import { parsers as designTokenParsers } from "../design-token-formatter/index.mjs"
import { removeEslintDirectives } from "./remover.mjs"

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
                return removeEslintDirectives(initial)
            } catch (err) {
                if (process.env.NODE_ENV !== "production")
                    console.warn("[eslint-directive-remover] failed to remove directives:", err)
                return initial
            }
        }
    }
}

export const parsers = {
    typescript: makeWrappedParser(designTokenParsers.typescript)
}

export default {
    parsers
}
