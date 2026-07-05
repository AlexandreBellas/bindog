import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"

type IMessageIds = "missingRefSuffix" | "unexpectedRefSuffix"

function normalizePath(filename: string): string {
    return filename.replace(/\\/g, "/")
}

function isTsxFile(filename: string): boolean {
    return normalizePath(filename).endsWith(".tsx")
}

function isHookFile(filename: string): boolean {
    const normalised = normalizePath(filename)
    // Matches src/**/hooks/**/use*.ts  and  src/**/hooks/*/index.ts
    return /\/hooks\/(.+\/)?use[^/]+\.ts$/.test(normalised) || /\/hooks\/[^/]+\/index\.ts$/.test(normalised)
}

/**
 * Returns true when the file is subject to the full rule (both checks).
 * Hook `.ts` files only get the `missingRefSuffix` half — they may freely use
 * the `Ref` suffix on callback-ref functions and other hook API members.
 */
function isApplicableFile(filename: string): boolean {
    return isTsxFile(filename) || isHookFile(filename)
}

/**
 * Returns true when the expression is a direct `useRef(...)` or `React.useRef(...)` call.
 * Generic type arguments (e.g. `useRef<HTMLDivElement>`) are handled transparently because
 * they don't change the `CallExpression` callee shape in the AST.
 */
function isUseRefCall(node: TSESTree.Expression | null | undefined): boolean {
    if (!node || node.type !== AST_NODE_TYPES.CallExpression) return false
    const { callee } = node

    if (callee.type === AST_NODE_TYPES.Identifier && callee.name === "useRef") return true

    if (
        callee.type === AST_NODE_TYPES.MemberExpression &&
        !callee.computed &&
        callee.object.type === AST_NODE_TYPES.Identifier &&
        callee.object.name === "React" &&
        callee.property.type === AST_NODE_TYPES.Identifier &&
        callee.property.name === "useRef"
    )
        return true

    return false
}

function hasRefSuffix(name: string): boolean {
    return name.endsWith("Ref")
}

/** Returns the string name of a property key when it can be statically determined. */
function getPropertyKeyName(key: TSESTree.Node): string | null {
    if (key.type === AST_NODE_TYPES.Identifier) return key.name
    if (key.type === AST_NODE_TYPES.Literal && typeof key.value === "string") return key.value
    return null
}

interface IBoundIdentifier {
    node: TSESTree.Identifier
    /**
     * True when the object-pattern property key that introduces this binding already
     * ends with `Ref` — meaning the `Ref` suffix is inherited from the source's own
     * naming convention (e.g. `const { audioRef } = useInterviewRefs()`).
     * In that case the bound variable is allowed to keep the suffix.
     */
    keyEndsInRef: boolean
}

/**
 * Recursively collects every bound `Identifier` node inside a binding pattern,
 * together with whether its property key already ends in `Ref`.
 *
 * Rules for `keyEndsInRef`:
 *  - Object shorthand  `{ audioRef }` → key = `audioRef` → `keyEndsInRef = true`
 *  - Object rename     `{ ref: audioRef }` → key = `ref` → `keyEndsInRef = false`
 *  - Object rename     `{ audioRef: el }` → bound name is `el` (no Ref) — not our concern
 *  - Array element     `[audioRef]` → no key → `keyEndsInRef = false`
 *  - Rest element      `{ ...rest }` → no key → `keyEndsInRef = false`
 *  - Default value     `{ audioRef = null }` → inherits the enclosing property's key
 *
 * Accepts `TSESTree.Node` so callers can pass `prop.value` / `prop.argument`
 * without type assertions — the switch narrows to the correct concrete type.
 */
function collectBoundIdentifiers(
    node: TSESTree.Node,
    keyEndsInRef: boolean = false
): IBoundIdentifier[] {
    const ids: IBoundIdentifier[] = []

    switch (node.type) {
        case AST_NODE_TYPES.Identifier:
            ids.push({ node, keyEndsInRef })
            break

        case AST_NODE_TYPES.ObjectPattern:
            for (const prop of node.properties) {
                if (prop.type === AST_NODE_TYPES.RestElement) {
                    ids.push(...collectBoundIdentifiers(prop.argument, false))
                } else {
                    const keyName = getPropertyKeyName(prop.key)
                    const propKeyEndsInRef = keyName !== null && hasRefSuffix(keyName)
                    ids.push(...collectBoundIdentifiers(prop.value, propKeyEndsInRef))
                }
            }
            break

        case AST_NODE_TYPES.ArrayPattern:
            for (const element of node.elements) {
                if (!element) continue
                ids.push(...collectBoundIdentifiers(element, false))
            }
            break

        case AST_NODE_TYPES.AssignmentPattern:
            // `{ x = default }` — the key was established by the enclosing Property;
            // inherit `keyEndsInRef` from the caller.
            ids.push(...collectBoundIdentifiers(node.left, keyEndsInRef))
            break

        case AST_NODE_TYPES.RestElement:
            ids.push(...collectBoundIdentifiers(node.argument, false))
            break

        default:
            break
    }

    return ids
}

/**
 * Enforces a strict naming convention for React ref variables:
 *
 * - Variables declared with `useRef` (or `React.useRef`) MUST end with the `Ref` suffix.
 * - Variables declared without `useRef` MUST NOT end with the `Ref` suffix UNLESS the
 *   variable is bound through an object-destructuring property whose key already ends in
 *   `Ref` — in that case the naming is inherited from the source's own convention and is
 *   therefore permitted.
 *
 * Examples that are allowed:
 *   const inputRef = useRef(null)              // useRef → must have suffix ✓
 *   const { audioRef } = useInterviewRefs()    // shorthand, key = audioRef ✓
 *   const { bodyRef } = useSomePropReturner()  // shorthand, key = bodyRef ✓
 *
 * Examples that are errors:
 *   const input = useRef(null)                 // useRef without suffix ✗
 *   const inputRef = useState(null)            // non-useRef with suffix ✗
 *   const { ref: inputRef } = useSomething()   // key = ref (no suffix), value has suffix ✗
 *
 * This applies only to `.tsx` files and covers simple declarations, object/array
 * destructuring, nested patterns, default values, and rest elements.
 *
 * When `useRef` result is destructured (e.g. `const { current } = useRef(null)`), the
 * suffix requirement is not applied to the destructured properties because they represent
 * members of the ref object rather than the ref handle itself.
 */
const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "require `Ref` suffix for `useRef` variables and " +
                "forbid `Ref` suffix on all other variables (unless inherited from " +
                "an object property key that already ends in `Ref`)"
        },
        messages: {
            missingRefSuffix:
                "Variable `{{ name }}` is created with `useRef` and must end with the `Ref` suffix " +
                "(e.g. rename to `{{ name }}Ref`).",
            unexpectedRefSuffix:
                "Variable `{{ name }}` ends with the `Ref` suffix but is not created with `useRef`. " +
                "Only `useRef` variables may use the `Ref` suffix."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        if (!isApplicableFile(context.filename)) return {}

        return {
            VariableDeclarator(node: TSESTree.VariableDeclarator) {
                const fromUseRef = isUseRefCall(node.init ?? undefined)

                if (fromUseRef) {
                    // Direct assignment: const myVar = useRef(...) → must have Ref suffix
                    if (node.id.type === AST_NODE_TYPES.Identifier && !hasRefSuffix(node.id.name))
                        context.report({
                            node: node.id,
                            messageId: "missingRefSuffix",
                            data: { name: node.id.name }
                        })

                    // Destructuring from useRef (e.g. const { current } = useRef(null)) is
                    // unusual and the destructured names are ref properties, not the ref itself,
                    // so we do not enforce the suffix on them.
                } else if (isTsxFile(context.filename)) {
                    // In .tsx files: non-useRef declarations may not carry the Ref suffix unless the
                    // object-property key they come from already ends in Ref (inherited convention).
                    const boundIds = collectBoundIdentifiers(node.id)
                    for (const { node: id, keyEndsInRef } of boundIds) {
                        if (hasRefSuffix(id.name) && !keyEndsInRef)
                            context.report({
                                node: id,
                                messageId: "unexpectedRefSuffix",
                                data: { name: id.name }
                            })
                    }
                }
                // In hook .ts files: Ref-suffixed callback-ref functions and other hook API members
                // are allowed without restriction — hooks establish naming conventions for consumers.
            }
        }
    }
}

export default rule
