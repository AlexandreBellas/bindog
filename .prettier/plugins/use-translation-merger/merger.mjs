/**
 * Core logic for the use-translation-merger Prettier plugin.
 *
 * Detects multiple `useTranslation` calls from react-i18next / i18next within
 * the same React component or hook body and merges them into a single call
 * with an array of namespaces, rewriting every old t-variable call to use the
 * namespace-prefixed form.
 *
 * Example input:
 *   const { t: tCommon } = useTranslation("common")
 *   const { t: tProject } = useTranslation("project")
 *   return <p>{tCommon("key1")}{tProject("key2")}</p>
 *
 * Example output:
 *   const { t } = useTranslation(["common", "project"])
 *   return <p>{t("common:key1")}{t("project:key2")}</p>
 */

import * as parser from "@typescript-eslint/parser"

/** Package names from which useTranslation is treated as i18next's. */
const I18NEXT_SOURCES = new Set(["react-i18next", "i18next"])

/** Namespace used when `useTranslation()` is called without arguments. */
const DEFAULT_NAMESPACE = "common"

// ─── AST Utilities ────────────────────────────────────────────────────────────

/** Minimal AST walker. Calls `visit(node, parent, grandparent)` for every node. */
function walk(node, visit, parent = null, grandparent = null) {
    if (!node || typeof node !== "object") return
    visit(node, parent, grandparent)
    for (const key of Object.keys(node)) {
        if (key === "parent" || key === "loc" || key === "range") continue
        const child = node[key]
        if (Array.isArray(child))
            for (const item of child) {
                if (item && typeof item === "object" && item.type) walk(item, visit, node, parent)
            }
        else if (child && typeof child === "object" && child.type)
            walk(child, visit, node, parent)
    }
}

/**
 * Returns the local name bound to i18next's `useTranslation` in the given AST,
 * or null if it is not imported.
 */
function findI18nextLocalName(ast) {
    for (const node of ast.body) {
        if (node.type !== "ImportDeclaration") continue
        if (!I18NEXT_SOURCES.has(node.source.value)) continue
        for (const spec of node.specifiers)
            if (
                spec.type === "ImportSpecifier" &&
                spec.imported.name === "useTranslation"
            )
                return spec.local.name


    }
    return null
}

/**
 * Finds top-level function/arrow/expression bodies in the AST that look like
 * React components (PascalCase) or hooks (use* prefix).
 */
function findComponentBodies(ast) {
    const PASCAL_RE = /^[A-Z][a-zA-Z0-9]*$/
    const HOOK_RE = /^use[A-Z]/
    const bodies = []

    function isTargetName(name) {
        return PASCAL_RE.test(name) || HOOK_RE.test(name)
    }

    function unwrapWrapper(node) {
        if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") return node
        if (node.type === "CallExpression" && node.arguments.length > 0) {
            const first = node.arguments[0]
            if (first.type === "ArrowFunctionExpression" || first.type === "FunctionExpression") return first
            if (first.type === "CallExpression") return unwrapWrapper(first)
        }
        return null
    }

    for (const node of ast.body) {
        // function MyComponent() { ... }
        if (node.type === "FunctionDeclaration" && node.id && isTargetName(node.id.name)) {
            if (node.body && node.body.type === "BlockStatement") bodies.push(node.body)
            continue
        }

        // const MyComponent = (...) => { ... }  or  const useHook = (...) => { ... }
        if (node.type === "VariableDeclaration")
            for (const decl of node.declarations)
                if (decl.id.type === "Identifier" && isTargetName(decl.id.name) && decl.init) {
                    const fn = unwrapWrapper(decl.init)
                    if (fn && fn.body && fn.body.type === "BlockStatement") bodies.push(fn.body)
                }



        // export default function MyComponent() { ... }
        if (
            node.type === "ExportDefaultDeclaration" &&
            node.declaration.type === "FunctionDeclaration"
        ) {
            const fn = node.declaration
            if (fn.id && isTargetName(fn.id.name) && fn.body && fn.body.type === "BlockStatement")
                bodies.push(fn.body)
            else if (fn.body && fn.body.type === "BlockStatement")
                // Anonymous default export function component
                bodies.push(fn.body)

        }

        // export function MyComponent() { ... }
        if (
            node.type === "ExportNamedDeclaration" &&
            node.declaration &&
            node.declaration.type === "FunctionDeclaration" &&
            node.declaration.id &&
            isTargetName(node.declaration.id.name)
        ) {
            const fn = node.declaration
            if (fn.body && fn.body.type === "BlockStatement") bodies.push(fn.body)
        }
    }

    return bodies
}

/**
 * Within a function body, finds all `useTranslation` calls at the DIRECT top
 * level (statements of the body, not nested in inner functions).
 *
 * Returns an array of:
 *   { declaratorNode, tVarName, namespace, callNode }
 * where `namespace` is the single string namespace (or null if not a simple
 * string literal, causing the merge to be skipped).
 */
function findUseTranslationCallsInBody(body, i18nextLocalName) {
    const results = []

    for (const stmt of body.body) {
        if (stmt.type !== "VariableDeclaration") continue

        for (const decl of stmt.declarations) {
            if (!decl.init || decl.init.type !== "CallExpression") continue
            const call = decl.init

            // Match callee to the i18next local name
            if (call.callee.type !== "Identifier" || call.callee.name !== i18nextLocalName) continue

            // Extract t variable name from destructuring: { t } or { t: alias }
            const tVarName = extractTVarName(decl)
            if (!tVarName) continue

            // Extract namespace – must be a simple string literal
            const ns = extractSingleStringNamespace(call)
            if (ns === null) continue // skip dynamic/array/missing namespace

            results.push({
                declaratorNode: decl,
                declarationNode: stmt,
                tVarName,
                namespace: ns,
                callNode: call
            })
        }
    }

    return results
}

/** Extracts `t` (or its alias) from `{ t: alias }` in a variable declarator. */
function extractTVarName(decl) {
    const id = decl.id
    if (id.type !== "ObjectPattern") return null
    for (const prop of id.properties) {
        if (prop.type !== "Property") continue
        if (prop.key.type !== "Identifier" || prop.key.name !== "t") continue
        if (prop.value.type === "Identifier") return prop.value.name
    }
    return null
}

/**
 * Returns the namespace as a string if the first argument to `useTranslation`
 * is a simple string literal, otherwise null (skip merge).
 * Array arguments are explicitly rejected to avoid double-merging.
 */
function extractSingleStringNamespace(callNode) {
    const arg = callNode.arguments[0]
    if (!arg) return DEFAULT_NAMESPACE
    if (arg.type === "Literal" && typeof arg.value === "string") return arg.value
    return null // array, dynamic, or other – skip merge
}

// ─── Replacement Builder ──────────────────────────────────────────────────────

/**
 * Finds every call expression `tVarName(...)` within `body` (including nested
 * arrow/function children) and returns their ranges + first-argument info.
 */
function findTCalls(body, tVarName) {
    const calls = []
    walk(body, node => {
        if (
            node.type === "CallExpression" &&
            node.callee.type === "Identifier" &&
            node.callee.name === tVarName &&
            node.range
        ) {
            const firstArg = node.arguments[0] ?? null
            calls.push({ callNode: node, firstArg })
        }
    })
    return calls
}

/**
 * Checks whether all call-expression usages of `tVarName` in `body` have
 * string-literal first arguments (so the namespace prefix can be prepended).
 */
function areCallsSafeToMerge(body, tVarName) {
    const calls = findTCalls(body, tVarName)
    return calls.every(
        ({ firstArg }) => firstArg && firstArg.type === "Literal" && typeof firstArg.value === "string"
    )
}

/**
 * Finds every non-call reference to `tVarName` within `body` — usages where
 * the variable appears but NOT as the direct callee of a call expression
 * (e.g. passed as a function argument like `helper(tVarName)`).
 *
 * These references are replaced with namespace-bound wrapper functions during
 * the merge so the receiving code keeps resolving keys in the correct namespace.
 *
 * Returns `{ refs, hasUnsafe }`:
 * - `refs`: AST nodes for references that CAN be safely wrapped.
 * - `hasUnsafe`: true when a reference was found in a position that cannot be
 *   automatically rewritten (e.g. shorthand property `{ tAlias }` in an object
 *   literal), in which case the entire merge must be skipped.
 */
function findNonCallReferences(body, tVarName) {
    const refs = []
    let hasUnsafe = false
    walk(body, (node, parent, grandparent) => {
        if (node.type !== "Identifier" || node.name !== tVarName) return

        if (parent && parent.type === "CallExpression" && parent.callee === node) return

        // Safe: identifier is the value binding inside a destructuring ObjectPattern
        // (e.g. the `tAlias` in `const { t: tAlias } = useTranslation("ns")`).
        // We distinguish this from a shorthand reference in an ObjectExpression
        // (e.g. `{ tAlias }` as a value) by requiring the grandparent to be an
        // ObjectPattern (destructuring) rather than an ObjectExpression (object literal).
        if (
            parent &&
            parent.type === "Property" &&
            grandparent &&
            grandparent.type === "ObjectPattern"
        ) return

        // Unsafe: shorthand property in an object literal (`{ tAlias }`) cannot
        // be wrapped without breaking the key — skip the entire merge.
        if (
            parent &&
            parent.type === "Property" &&
            parent.shorthand &&
            grandparent &&
            grandparent.type === "ObjectExpression"
        ) {
            hasUnsafe = true
            return
        }

        refs.push(node)
    })
    return { refs, hasUnsafe }
}

// ─── Main Transform ───────────────────────────────────────────────────────────

/**
 * Merges duplicate `useTranslation` calls within all detected component/hook
 * bodies. Returns a new source string with the transformations applied.
 *
 * If the source cannot be parsed, or any merge would be unsafe (dynamic keys,
 * missing string literals, namespace arrays already in use), the original
 * source is returned unchanged.
 */
export function mergeUseTranslations(text) {
    if (typeof text !== "string" || text.length === 0) return text

    let ast
    try {
        ast = parser.parse(text, {
            sourceType: "module",
            ecmaVersion: "latest",
            loc: true,
            range: true,
            comment: false,
            tokens: false,
            jsx: true,
            ecmaFeatures: { jsx: true }
        })
    } catch {
        return text
    }

    const i18nextLocalName = findI18nextLocalName(ast)
    if (!i18nextLocalName) return text

    const bodies = findComponentBodies(ast)
    if (bodies.length === 0) return text

    // Collect all splice operations, apply from last to first to preserve offsets
    const splices = []

    for (const body of bodies) {
        const calls = findUseTranslationCallsInBody(body, i18nextLocalName)
        if (calls.length < 2) continue

        const callsSafe = calls.every(({ tVarName }) => areCallsSafeToMerge(body, tVarName))
        if (!callsSafe) continue

        // Collect non-call references; bail out if any are in unsafe positions
        const nonCallRefsByVar = []
        let hasUnsafeRef = false
        for (const { tVarName, namespace } of calls) {
            const { refs, hasUnsafe } = findNonCallReferences(body, tVarName)
            if (hasUnsafe) { hasUnsafeRef = true; break }
            nonCallRefsByVar.push({ refs, namespace })
        }
        if (hasUnsafeRef) continue

        // Collect all t-call replacements for this body
        const tCallSplices = []
        for (const { tVarName, namespace } of calls)
            for (const { callNode, firstArg } of findTCalls(body, tVarName)) {
                const key = firstArg.value // guaranteed string literal by callsSafe check
                const alreadyPrefixed = key.includes(":")
                const newKey = alreadyPrefixed ? key : `${namespace}:${key}`
                const quote = text[firstArg.range[0]]
                tCallSplices.push({
                    // Replace callee name: tOldVar → t
                    calleeStart: callNode.callee.range[0],
                    calleeEnd: callNode.callee.range[1],
                    newCallee: "t",
                    // Replace first arg value with prefixed key
                    argStart: firstArg.range[0],
                    argEnd: firstArg.range[1],
                    newArg: `${quote}${newKey}${quote}`
                })
            }

        // Replace non-call references with namespace-bound wrappers so the
        // receiving code keeps resolving keys in the correct namespace.
        for (const { refs, namespace } of nonCallRefsByVar)
            for (const ref of refs) {
                const wrapper = `((key, ...args) => t(\`${namespace}:\${key}\`, ...args))`
                splices.push({ start: ref.range[0], end: ref.range[1], text: wrapper })
            }

        // Build merged useTranslation declaration.
        // Namespaces are sorted alphabetically so the output is deterministic
        // regardless of the order in which the original calls appeared in source.
        const namespaces = [...new Set(calls.map(c => c.namespace))].sort()
        const namespaceArray = `["${namespaces.join('", "')}"]`
        const mergedDecl = `const { t } = ${i18nextLocalName}(${namespaceArray})`

        // Mark declaration nodes for removal/replacement
        // The first declaration gets replaced with the merged line
        // Subsequent declarations are removed
        const firstDecl = calls[0].declarationNode
        splices.push({
            start: firstDecl.range[0],
            end: firstDecl.range[1],
            text: mergedDecl
        })
        for (let i = 1; i < calls.length; i++) {
            const decl = calls[i].declarationNode
            // Remove the whole line including leading whitespace + newline
            const lineStart = findLineStart(text, decl.range[0])
            const lineEnd = findLineEnd(text, decl.range[1])
            splices.push({ start: lineStart, end: lineEnd, text: "" })
        }

        // Flatten tCallSplices into the main splices array
        for (const sp of tCallSplices) {
            // Callee replacement
            splices.push({ start: sp.calleeStart, end: sp.calleeEnd, text: sp.newCallee })
            // Arg replacement
            splices.push({ start: sp.argStart, end: sp.argEnd, text: sp.newArg })
        }
    }

    if (splices.length === 0) return text

    // Sort descending by start offset and apply
    splices.sort((a, b) => b.start - a.start)

    let result = text
    for (const sp of splices)
        result = result.slice(0, sp.start) + sp.text + result.slice(sp.end)


    return result
}

// ─── Offset Helpers ───────────────────────────────────────────────────────────

/**
 * Returns the offset of the start of the line containing `offset`.
 * Leading whitespace on the line is included so the entire indented line
 * is removed.
 */
function findLineStart(text, offset) {
    let i = offset
    while (i > 0 && text[i - 1] !== "\n") i--
    return i
}

/**
 * Returns the offset immediately after the newline that terminates the line
 * containing `offset` (i.e., the first character of the next line).
 */
function findLineEnd(text, offset) {
    let i = offset
    while (i < text.length && text[i] !== "\n") i++
    if (i < text.length) i++ // include the newline itself
    return i
}
