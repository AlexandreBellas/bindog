/**
 * Prettier plugin that auto-formats const-array / union-type / pascal-const
 * groups into the canonical three-statement form required by the ESLint rule
 * `.eslint/rules/enforce-union-types-source-of-truth.ts`.
 *
 * The plugin only activates on `.ts` files that live inside a `/@types/`
 * folder (the scope where the ESLint rule is enforced). It handles three
 * starting states so the developer can hit "Format" from any partial state:
 *
 *   1. Const string array alone
 *        const colors = ["red", "blue"] as const
 *      Becomes:
 *        const colors = ["red", "blue"] as const
 *        type IColor = (typeof colors)[number]
 *        const Color = { Red: "red", Blue: "blue" } as const satisfies ...
 *
 *   2. Raw string union type
 *        type IColor = "red" | "blue"
 *      Becomes:
 *        const colors = ["red", "blue"] as const
 *        type IColor = (typeof colors)[number]
 *        const Color = { Red: "red", Blue: "blue" } as const satisfies ...
 *
 *   3. Const array + derived type (missing pascal const)
 *        const colors = ["red", "blue"] as const
 *        type IColor = (typeof colors)[number]
 *      Becomes:
 *        const colors = ["red", "blue"] as const
 *        type IColor = (typeof colors)[number]
 *        const Color = { Red: "red", Blue: "blue" } as const satisfies ...
 *
 * Starting with only a const object (const Color = {...}) is explicitly NOT
 * handled (no reverse-engineering from the object shape).
 *
 * The plugin chains off the already-processed parser exported by
 * `../useeffect-comment-lifter/index.mjs` so all plugins coexist without
 * collision.
 *
 * Activation: register in `.prettierrc.json` under `plugins` (after
 * `useeffect-comment-lifter`).
 */

import { parsers as useeffectCommentLifterParsers } from "../useeffect-comment-lifter/index.mjs"
import { formatUnionTypes } from "./formatter.mjs"

function shouldTransform(options) {
    const filepath = options && options.filepath
    if (!filepath) return false
    if (filepath.endsWith(".d.ts")) return false
    if (!filepath.endsWith(".ts")) return false
    return filepath.includes("/@types/") || filepath.includes("\\@types\\")
}

function makeWrappedParser(original) {
    const upstream = original.preprocess

    return {
        ...original,
        preprocess(text, options) {
            const initial = upstream ? upstream(text, options) : text
            if (!shouldTransform(options)) return initial
            try {
                return formatUnionTypes(initial)
            } catch (err) {
                if (process.env.NODE_ENV !== "production")
                    console.warn("[union-type-formatter] failed to format union types:", err)
                return initial
            }
        }
    }
}

export const parsers = {
    typescript: makeWrappedParser(useeffectCommentLifterParsers.typescript)
}

export default {
    parsers
}
