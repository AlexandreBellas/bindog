import * as parser from "@typescript-eslint/parser"
import { classifyStatement } from "./classify.mjs"
import { REGION_LABELS, regionIndex } from "./regions.mjs"

const REGION_OPEN_RE = /^\s*\/\/\s*#region\b/
const REGION_CLOSE_RE = /^\s*\/\/\s*#endregion\b/

const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/
const HOOK_NAME_RE = /^use[A-Z]/

/**
 * Top-level entry: take the source of a `.tsx` file and return a new source
 * with each React component's pre-JSX statements grouped into canonical
 * `// #region` blocks.
 *
 * Pipeline:
 *   1. Strip *every* `// #region X` / `// #endregion` line from the source.
 *      Per cursor rules, region markers only belong inside React component
 *      bodies; anywhere else (top-level type/context/provider blocks, helper
 *      functions, etc.) they are user-authored noise and must be removed.
 *   2. Re-parse the cleaned source and rebuild canonical regions inside each
 *      component body.
 *
 * If the source cannot be parsed, or any single component would have its
 * hook-dependency tree broken by reordering, the *cleaned* source is
 * returned for that component (the global region strip still applies).
 */
export function organizeRegions(text) {
    const cleaned = stripAllRegionMarkers(text)

    let ast
    try {
        ast = parser.parse(cleaned, {
            sourceType: "module",
            ecmaVersion: "latest",
            loc: true,
            range: true,
            comment: true,
            tokens: false,
            jsx: true,
            ecmaFeatures: { jsx: true }
        })
    } catch {
        return cleaned
    }

    const importMap = buildImportMap(ast)
    const components = findComponents(ast)
    if (components.length === 0) return cleaned

    const replacements = []
    for (const component of components) {
        const replacement = organizeComponentBody(cleaned, component, importMap, ast.comments ?? [])
        if (replacement === false) return text
        if (replacement !== null) replacements.push(replacement)
    }

    if (replacements.length === 0) return cleaned

    replacements.sort((a, b) => b.start - a.start)
    let result = cleaned
    for (const r of replacements) result = result.slice(0, r.start) + r.text + result.slice(r.end)

    return result
}

/**
 * Remove every line that consists of a `// #region X` or `// #endregion`
 * marker (with any leading indentation). This runs *before* parsing so
 * region markers inside non-component code (top-level helpers, utility
 * functions, type declarations) are simply erased — they are not
 * re-emitted because canonical regions only live inside component bodies.
 *
 * Note: matches are anchored to start-of-line in multiline mode, so markers
 * appearing inside multi-line string/template literals on their own line
 * would also be stripped. That is an accepted, vanishingly rare edge case.
 */
function stripAllRegionMarkers(text) {
    return text.replace(/^[ \t]*\/\/[ \t]*#(?:region|endregion)\b[^\n]*\r?\n?/gm, "")
}

function buildImportMap(ast) {
    const map = new Map()
    for (const node of ast.body) {
        if (node.type !== "ImportDeclaration") continue
        const source = node.source.value
        for (const spec of node.specifiers) {
            const isImportSpec =
                spec.type === "ImportSpecifier" ||
                spec.type === "ImportDefaultSpecifier" ||
                spec.type === "ImportNamespaceSpecifier"
            if (isImportSpec) map.set(spec.local.name, source)
        }
    }
    return map
}

/**
 * Find every React-component-like function in the program. We accept:
 *   - PascalCase or `use*` named function declarations,
 *   - PascalCase or `use*` named variable declarators initialised with an
 *     arrow function or function expression (or wrapped, e.g. `forwardRef(...)`).
 */
function findComponents(ast) {
    const found = []
    walk(ast, node => {
        if (!node || typeof node !== "object" || !node.type) return

        if (node.type === "FunctionDeclaration" && node.id && isReactTargetName(node.id.name)) {
            const body = node.body
            if (body && body.type === "BlockStatement") found.push({ name: node.id.name, body })
            return
        }

        const isVarDecl =
            node.type === "VariableDeclarator" &&
            node.id.type === "Identifier" &&
            isReactTargetName(node.id.name) &&
            node.init
        if (isVarDecl) {
            const fn = unwrapReactWrapper(node.init)
            if (fn && fn.body && fn.body.type === "BlockStatement")
                found.push({ name: node.id.name, body: fn.body })

        }
    })
    return found
}

function isReactTargetName(name) {
    return PASCAL_CASE_RE.test(name) || HOOK_NAME_RE.test(name)
}

function unwrapReactWrapper(node) {
    if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") return node
    if (node.type === "CallExpression" && node.arguments.length > 0) {
        const first = node.arguments[0]
        if (first.type === "ArrowFunctionExpression" || first.type === "FunctionExpression") return first
        if (first.type === "CallExpression") return unwrapReactWrapper(first)
    }
    return null
}

function walk(node, visit) {
    if (!node || typeof node !== "object") return
    visit(node)
    for (const key of Object.keys(node)) {
        if (key === "parent" || key === "loc" || key === "range") continue
        const value = node[key]
        if (Array.isArray(value)) for (const item of value) walk(item, visit)
        else if (value && typeof value === "object" && value.type) walk(value, visit)
    }
}

/**
 * Build a replacement for a single component's pre-JSX body.
 *
 * Returns:
 *   - `{ start, end, text }` — a splice to apply to the cleaned source.
 *   - `null`  — no change needed (already organised, or nothing to reorder).
 *   - `false` — organising is unsafe (unclassifiable blocks or dependency
 *               violation); the caller must abort and return the original
 *               source to avoid stripping existing regions.
 */
function organizeComponentBody(source, component, importMap, allComments) {
    const body = component.body
    const statements = body.body

    const cutIndex = findHeadCutoff(statements)
    const headStatements = cutIndex < 0 ? statements : statements.slice(0, cutIndex)
    if (headStatements.length === 0) return null

    const blocks = collectStatementBlocks(source, body, headStatements, allComments)
    if (blocks.length === 0) return null

    const declMap = buildDeclMap(blocks)
    for (let i = 0; i < blocks.length; i++) {
        blocks[i].originalIndex = i
        blocks[i].region = classifyStatement(blocks[i].statement, importMap)
        const refs = collectReferencedIdentifiers(blocks[i].statement, declMap)
        const deps = new Set()
        for (const name of refs) {
            const declarerIdx = declMap.get(name)
            if (declarerIdx !== undefined && declarerIdx !== i) deps.add(declarerIdx)
        }
        blocks[i].deps = deps
    }

    propagateUnclassifiedRegions(blocks)

    if (blocks.some(b => b.region === null)) return false

    promoteSecondCustomHooks(blocks)
    promoteMemosToCustomHooks2(blocks)

    const orderedBlocks = computeNewOrder(blocks)
    if (!validateDepsInOrder(blocks, orderedBlocks)) return false

    const indent = computeIndent(source, body, headStatements)
    const newBodyText = renderRegions(orderedBlocks, indent)

    const replaceStart = body.range[0] + 1
    const replaceEnd = computeHeadEnd(source, headStatements, statements, cutIndex, body)

    const fullReplacement = "\n" + newBodyText
    const existing = source.slice(replaceStart, replaceEnd)
    if (normalize(existing) === normalize(fullReplacement)) return null

    return { start: replaceStart, end: replaceEnd, text: fullReplacement }
}

function normalize(text) {
    return text.replace(/\s+/g, " ").trim()
}

/**
 * The "head" of a component body is the prefix of statements that look like
 * hook declarations: `VariableDeclaration` (e.g. `const [x] = useState(0)`)
 * or `ExpressionStatement` (e.g. `useEffect(() => {}, [])`).
 *
 * Anything else — `ReturnStatement`, `IfStatement` (early return guards),
 * `SwitchStatement`, `ThrowStatement`, `BlockStatement` — terminates the head
 * and starts the *tail*. Tail statements are preserved verbatim, in their
 * original order, *after* all regions. This guarantees that conditional
 * rendering guards like `if (!data) return null` never get reordered into a
 * region (which would put hook calls below them and break the rules of hooks).
 *
 * Returns the index of the first tail statement, or -1 if every statement is
 * head-eligible.
 */
function findHeadCutoff(statements) {
    for (let i = 0; i < statements.length; i++) {
        const t = statements[i].type
        if (t !== "VariableDeclaration" && t !== "ExpressionStatement") return i
    }
    return -1
}

/**
 * For each top-level statement, capture:
 *   - the statement node,
 *   - the leading non-region comments that should travel with it,
 *   - the verbatim source text of the statement itself.
 */
function collectStatementBlocks(source, body, headStatements, allComments) {
    const blocks = []
    let prevEnd = body.range[0] + 1

    for (const statement of headStatements) {
        const stmtStart = statement.range[0]
        const stmtEnd = statement.range[1]

        const leadingComments = allComments.filter(
            c => c.range[0] >= prevEnd && c.range[1] <= stmtStart && !isRegionComment(c)
        )

        const leadingText =
            leadingComments.length > 0
                ? leadingComments
                    .map(c => (c.type === "Line" ? `//${c.value}` : `/*${c.value}*/`))
                    .join("\n")
                : ""

        const text = source.slice(stmtStart, stmtEnd)
        blocks.push({
            statement,
            text,
            leadingText
        })

        prevEnd = stmtEnd
    }

    return blocks
}

function isRegionComment(comment) {
    if (comment.type !== "Line") return false
    const raw = `//${comment.value}`
    return REGION_OPEN_RE.test(raw) || REGION_CLOSE_RE.test(raw)
}

/** Map identifier name → block index that declares it. */
function buildDeclMap(blocks) {
    const map = new Map()
    for (let i = 0; i < blocks.length; i++)
        for (const name of collectDeclaredIdentifiers(blocks[i].statement))
            if (!map.has(name)) map.set(name, i)


    return map
}

function collectDeclaredIdentifiers(statement) {
    const names = []
    if (statement.type !== "VariableDeclaration") return names
    for (const decl of statement.declarations) collectPatternNames(decl.id, names)
    return names
}

function collectPatternNames(pattern, out) {
    if (!pattern) return
    if (pattern.type === "Identifier") {
        out.push(pattern.name)
        return
    }
    if (pattern.type === "ObjectPattern") {
        for (const prop of pattern.properties)
            if (prop.type === "Property") collectPatternNames(prop.value, out)
            else if (prop.type === "RestElement") collectPatternNames(prop.argument, out)

        return
    }
    if (pattern.type === "ArrayPattern") {
        for (const element of pattern.elements) if (element) collectPatternNames(element, out)
        return
    }
    if (pattern.type === "AssignmentPattern") {
        collectPatternNames(pattern.left, out)
        return
    }
    if (pattern.type === "RestElement")
        collectPatternNames(pattern.argument, out)


}

/** Collect identifiers referenced inside a statement, restricted to body-declared names. */
function collectReferencedIdentifiers(statement, declMap) {
    const refs = new Set()
    walkReferences(statement, name => {
        if (declMap.has(name)) refs.add(name)
    })
    for (const declared of collectDeclaredIdentifiers(statement)) refs.delete(declared)
    for (const shadowed of collectNestedDeclaredNames(statement)) refs.delete(shadowed)
    return refs
}

/**
 * Walk the AST collecting only true variable-reference Identifiers.
 * Skips Identifiers that appear as:
 *   - non-computed property of a MemberExpression (`obj.prop` → skip `prop`)
 *   - non-computed key of a Property (`{ key: val }` → skip `key`)
 */
function walkReferences(node, onRef) {
    if (!node || typeof node !== "object" || !node.type) return

    if (node.type === "Identifier") {
        onRef(node.name)
        return
    }

    if (node.type === "MemberExpression") {
        walkReferences(node.object, onRef)
        if (node.computed) walkReferences(node.property, onRef)
        return
    }

    if (node.type === "Property") {
        if (node.computed) walkReferences(node.key, onRef)
        walkReferences(node.value, onRef)
        return
    }

    for (const key of Object.keys(node)) {
        if (key === "parent" || key === "loc" || key === "range") continue
        const child = node[key]
        if (Array.isArray(child)) for (const item of child) walkReferences(item, onRef)
        else if (child && typeof child === "object" && child.type) walkReferences(child, onRef)
    }
}

/**
 * Collect every name declared inside nested scopes of a statement
 * (VariableDeclarations, function/arrow parameters, catch params).
 * These shadow outer body-level declarations and must be excluded
 * from the reference set to avoid false dependencies.
 */
function collectNestedDeclaredNames(statement) {
    const names = []
    walk(statement, node => {
        if (node.type === "VariableDeclaration")
            for (const decl of node.declarations)
                collectPatternNames(decl.id, names)
        if (
            node.type === "ArrowFunctionExpression" ||
            node.type === "FunctionExpression" ||
            node.type === "FunctionDeclaration"
        )
            for (const param of node.params)
                collectPatternNames(param, names)
        if (node.type === "CatchClause" && node.param)
            collectPatternNames(node.param, names)
    })
    return names
}

/**
 * Statements with no hook call (region === null) inherit the region of their
 * latest body-dependency. Iterates until a fixed point. Statements that depend
 * on nothing in the body get parked in `customHooks`; the parking happens
 * *inside* the fixed-point loop so that downstream blocks depending on a
 * parked block can subsequently inherit its region in a later pass. Blocks
 * that depend only on still-unclassified blocks remain `null` and will trigger
 * an abort.
 */
function propagateUnclassifiedRegions(blocks) {
    let changed = true
    let safety = 50
    while (changed && safety-- > 0) {
        changed = false
        for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].region !== null) continue
            let inherited = null
            let inheritedRank = -1
            for (const depIdx of blocks[i].deps) {
                const depRegion = blocks[depIdx].region
                if (depRegion === null) continue
                const rank = regionIndex(depRegion)
                if (rank > inheritedRank) {
                    inherited = depRegion
                    inheritedRank = rank
                }
            }
            if (inherited !== null) {
                blocks[i].region = inherited
                changed = true
                continue
            }
            if (blocks[i].deps.size === 0) {
                blocks[i].region = "customHooks"
                changed = true
            }
        }
    }
}

/**
 * If a `customHooks` block depends (transitively) on any state/ref/memo/callback
 * block, promote it to the second `Custom hooks` slot (after Callbacks).
 */
function promoteSecondCustomHooks(blocks) {
    const lateRegions = new Set(["states", "refs", "memos", "callbacks", "customHooks2"])
    let changed = true
    while (changed) {
        changed = false
        for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].region !== "customHooks") continue
            for (const depIdx of blocks[i].deps)
                if (lateRegions.has(blocks[depIdx].region)) {
                    blocks[i].region = "customHooks2"
                    changed = true
                    break
                }

        }
    }
}

/**
 * If a `memos` block depends (transitively) on any `customHooks2` block,
 * promote it into the `customHooks2` slot.
 *
 * Because `customHooks2` renders with the "Custom hooks" label — the only
 * region allowed to appear more than once — this avoids creating a duplicate
 * "Memos" region while still satisfying the dependency order.
 *
 * Callbacks are intentionally *not* promoted here: when callbacks depend on
 * `customHooks2`, the organiser aborts and preserves the original source.
 */
function promoteMemosToCustomHooks2(blocks) {
    let changed = true
    while (changed) {
        changed = false
        for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].region !== "memos") continue
            for (const depIdx of blocks[i].deps)
                if (blocks[depIdx].region === "customHooks2") {
                    blocks[i].region = "customHooks2"
                    changed = true
                    break
                }
        }
    }
}

/**
 * Stable sort by region rank, preserving original order within the same region.
 */
function computeNewOrder(blocks) {
    return blocks
        .map((b, i) => ({ block: b, originalIndex: i }))
        .sort((a, b) => {
            const ra = regionIndex(a.block.region)
            const rb = regionIndex(b.block.region)
            if (ra !== rb) return ra - rb
            return a.originalIndex - b.originalIndex
        })
        .map(x => x.block)
}

/**
 * Verify that for every block, all its dependencies are positioned before it
 * in the new order. If not, the formatting would change semantics — abort.
 */
function validateDepsInOrder(originalBlocks, orderedBlocks) {
    const newPos = new Map()
    orderedBlocks.forEach((b, i) => newPos.set(b, i))

    for (const block of orderedBlocks) {
        const myPos = newPos.get(block)
        for (const depOriginalIdx of block.deps) {
            const depBlock = originalBlocks[depOriginalIdx]
            const depPos = newPos.get(depBlock)
            if (depPos === undefined) continue
            if (depPos >= myPos) return false
        }
    }
    return true
}

/**
 * Render the ordered blocks as a sequence of `// #region X` ... `// #endregion`
 * sections. Adjacent same-region blocks are folded into one region.
 *
 * Each statement's verbatim source is included; only its leading whitespace
 * is reset to the component-body indent so the result is self-consistent.
 */
function renderRegions(orderedBlocks, indent) {
    const out = []
    let currentRegion = null

    for (const block of orderedBlocks) {
        if (block.region !== currentRegion) {
            if (currentRegion !== null) {
                out.push(`${indent}// #endregion`)
                out.push("")
            }
            currentRegion = block.region
            out.push(`${indent}// #region ${REGION_LABELS[currentRegion]}`)
        }

        if (block.leadingText)
            for (const ln of block.leadingText.split("\n")) out.push(`${indent}${ln}`)


        const statementLines = reIndent(block.text, indent)
        for (const ln of statementLines) out.push(ln)
    }

    if (currentRegion !== null) out.push(`${indent}// #endregion`)

    return out.join("\n") + "\n"
}

/**
 * Re-indent a verbatim statement so its first line gets `indent` and every
 * subsequent line preserves its *relative* indentation against the original
 * first line.
 */
function reIndent(text, indent) {
    const lines = text.split("\n")
    if (lines.length === 0) return []
    const first = lines[0]
    const firstStripped = first.replace(/^\s+/, "")
    const out = [`${indent}${firstStripped}`]
    const originalFirstIndentMatch = /^(\s*)/.exec(first)
    const originalFirstIndent = originalFirstIndentMatch ? originalFirstIndentMatch[1] : ""

    for (let i = 1; i < lines.length; i++) {
        const ln = lines[i]
        if (ln.trim() === "") {
            out.push("")
            continue
        }
        if (ln.startsWith(originalFirstIndent))
            out.push(`${indent}${ln.slice(originalFirstIndent.length)}`)
        else
            out.push(`${indent}${ln.replace(/^\s+/, "")}`)

    }

    return out
}

function computeIndent(source, body, headStatements) {
    if (headStatements.length === 0) return "    "
    const first = headStatements[0]
    const lineStart = source.lastIndexOf("\n", first.range[0] - 1) + 1
    const slice = source.slice(lineStart, first.range[0])
    const m = /^(\s*)/.exec(slice)
    if (m && m[1].length > 0) return m[1]
    return "    "
}

/**
 * Extend the head replacement range past any trailing region markers (open
 * *or* close, known *or* unknown name) and incidental whitespace, so that
 * stale `// #region Foo` / `// #endregion` lines left between the last hook
 * and the first tail statement are stripped before fresh canonical markers
 * are emitted.
 */
function computeHeadEnd(source, headStatements, allStatements, cutIndex, body) {
    if (headStatements.length === 0) return body.range[0] + 1
    const lastHead = headStatements[headStatements.length - 1]
    let end = lastHead.range[1]
    const nextAnchor = cutIndex < 0 ? body.range[1] - 1 : allStatements[cutIndex].range[0]

    while (end < nextAnchor) {
        const tail = source.slice(end, nextAnchor)

        const regionMarkerMatch = /^\s*\/\/\s*#(?:region|endregion)\b[^\n]*\n?/.exec(tail)
        if (regionMarkerMatch) {
            end += regionMarkerMatch[0].length
            continue
        }

        const trailingSpace = /^[ \t]+/.exec(tail)
        if (trailingSpace) {
            end += trailingSpace[0].length
            continue
        }

        break
    }

    return end
}

