/**
 * Prettier plugin that lifts plain `// line comments` above `useEffect` calls
 * into JSDoc (`/** ... *​/`) format, automatically satisfying the
 * `custom/useeffect` ESLint rule on save.
 *
 * Only comments that are:
 *   - `//` line comments (not `/* *​/` or `/** *​/`)
 *   - NOT `// #region` / `// #endregion` markers
 *   - placed directly above a `useEffect(` call with no blank line gap
 *
 * are converted. `useEffect` calls with no comment above them are left
 * untouched (the ESLint rule will still flag them — the developer must write
 * a description first).
 *
 * The plugin extends — it does *not* replace — the TypeScript parser by
 * wrapping its `preprocess` step. It chains off the already-processed parser
 * exported by `../use-translation-merger/index.mjs` so all Prettier plugins
 * coexist without collision.
 * Default Prettier formatting still runs on the (already transformed) source.
 *
 * Activation: register in `.prettierrc.json` under `plugins` (after
 * `use-translation-merger`). The transform kicks in for `.ts` and `.tsx`
 * files; `.d.ts` declaration files and other extensions pass through untouched.
 */

import { parsers as useTranslationMergerParsers } from "../use-translation-merger/index.mjs"
import { liftUseEffectComments } from "./converter.mjs"

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
                return liftUseEffectComments(initial)
            } catch (err) {
                if (process.env.NODE_ENV !== "production")
                    console.warn("[useeffect-comment-lifter] failed to lift comments:", err)
                return initial
            }
        }
    }
}

export const parsers = {
    typescript: makeWrappedParser(useTranslationMergerParsers.typescript)
}

export default {
    parsers
}
