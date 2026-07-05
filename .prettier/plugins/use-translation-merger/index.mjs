/**
 * Prettier plugin that merges duplicate `useTranslation` calls from
 * react-i18next / i18next within the same React component or hook into a
 * single call with an array of namespaces, automatically rewriting every old
 * t-variable call to use the namespace-prefixed form.
 *
 * Example – before formatting:
 *   const { t: tCommon }  = useTranslation("common")
 *   const { t: tProject } = useTranslation("project")
 *   return (
 *     <div>
 *       <p>{tCommon("translation-key")}</p>
 *       <p>{tProject("other-key")}</p>
 *     </div>
 *   )
 *
 * Example – after formatting:
 *   const { t } = useTranslation(["common", "project"])
 *   return (
 *     <div>
 *       <p>{t("common:translation-key")}</p>
 *       <p>{t("project:other-key")}</p>
 *     </div>
 *   )
 *
 * The plugin extends — it does *not* replace — the TypeScript parser by
 * wrapping its `preprocess` step. It chains off the already-processed parser
 * exported by `../eslint-directive-remover/index.mjs` so all four Prettier
 * plugins coexist without collision.
 * Default Prettier formatting still runs on the (already merged) source.
 *
 * Activation: register in `.prettierrc.json` under `plugins` (after
 * `eslint-directive-remover`). The transform kicks in for `.ts` and `.tsx`
 * files; `.d.ts` declaration files and other extensions pass through untouched.
 */

import { parsers as eslintDirectiveRemoverParsers } from "../eslint-directive-remover/index.mjs"
import { mergeUseTranslations } from "./merger.mjs"

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
                return mergeUseTranslations(initial)
            } catch (err) {
                console.warn("[use-translation-merger] failed to merge useTranslation calls:", err)
                return initial
            }
        }
    }
}

export const parsers = {
    typescript: makeWrappedParser(eslintDirectiveRemoverParsers.typescript)
}

export default {
    parsers
}
