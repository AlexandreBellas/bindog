import type { TSESLint, TSESTree } from "@typescript-eslint/utils"

type IMessageIds =
    | "outOfOrder"
    | "unclosedRegion"
    | "nestedRegion"
    | "unknownRegion"
    | "duplicateRegion"
    | "adjacentDuplicateRegion"
type IRuleContext = Readonly<TSESLint.RuleContext<IMessageIds, []>>

const REGION_ORDER = [
    "params",
    "contexts",
    "services",
    "custom hooks",
    "states",
    "refs",
    "memos",
    "callbacks",
    "custom hooks",
    "element memos",
    "element callbacks",
    "effects"
]
const CANONICAL_ORDER_LABEL = REGION_ORDER.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(" → ")

const ALLOWED_DUPLICATE_REGIONS = new Map(
    Object.entries(
        REGION_ORDER.reduce<Record<string, number>>((acc, r) => {
            acc[r] = (acc[r] ?? 0) + 1
            return acc
        }, {})
    ).filter(([, count]) => count > 1)
)
const ALLOWED_REGIONS = new Set(REGION_ORDER)
const ALLOWED_REGIONS_LABEL = REGION_ORDER.filter((v, i, a) => a.indexOf(v) === i)
    .map(r => r.charAt(0).toUpperCase() + r.slice(1))
    .map(r => `"${r}"`)
    .join(", ")

const REGION_OPEN_RE = /^\s*\/\/\s*#region\s+(.+?)\s*$/
const REGION_CLOSE_RE = /^\s*\/\/\s*#endregion\b/

interface IRegionOccurrence {
    name: string
    normalized: string
    line: number
    node: TSESTree.Comment
}

interface IFunctionScope {
    startLine: number
    endLine: number
}

function normalizeRegionName(name: string): string {
    return name.toLowerCase().trim()
}

function getCanonicalIndex(normalized: string): number {
    if (normalized === "custom hooks") return -1

    return REGION_ORDER.indexOf(normalized)
}

function findRegions(context: IRuleContext, comments: TSESTree.Comment[]): IRegionOccurrence[] {
    const regions: IRegionOccurrence[] = []
    let openRegion: { name: string; normalized: string; line: number; node: TSESTree.Comment } | null = null

    for (const comment of comments) {
        if (comment.type !== "Line") continue

        const text = `//${comment.value}`
        const openMatch = REGION_OPEN_RE.exec(text)

        if (openMatch) {
            if (openRegion) {
                context.report({
                    node: comment,
                    messageId: "nestedRegion",
                    data: {
                        outer: openRegion.name,
                        inner: openMatch[1]
                    }
                })
                return regions
            }

            const normalized = normalizeRegionName(openMatch[1])

            if (!ALLOWED_REGIONS.has(normalized)) {
                context.report({
                    node: comment,
                    messageId: "unknownRegion",
                    data: {
                        name: openMatch[1],
                        allowed: ALLOWED_REGIONS_LABEL
                    }
                })
                openRegion = { name: openMatch[1], normalized, line: comment.loc.start.line, node: comment }
                continue
            }

            openRegion = {
                name: openMatch[1],
                normalized,
                line: comment.loc.start.line,
                node: comment
            }
            continue
        }

        if (REGION_CLOSE_RE.test(text)) {
            if (!openRegion) continue

            if (ALLOWED_REGIONS.has(openRegion.normalized))
                regions.push({
                    name: openRegion.name,
                    normalized: openRegion.normalized,
                    line: openRegion.line,
                    node: openRegion.node
                })

            openRegion = null
        }
    }

    if (openRegion)
        context.report({
            node: openRegion.node,
            messageId: "unclosedRegion",
            data: { name: openRegion.name }
        })

    return regions
}

function checkOrdering(context: IRuleContext, regions: IRegionOccurrence[]): void {
    const totalCustomHooks = regions.filter(r => r.normalized === "custom hooks").length

    for (let i = 1; i < regions.length; i++) {
        const prev = regions[i - 1]
        const curr = regions[i]

        const prevIdx = getCanonicalIndex(prev.normalized)
        const currIdx = getCanonicalIndex(curr.normalized)

        if (prevIdx === -1 || currIdx === -1) {
            if (totalCustomHooks === 1) {
                const firstPos = REGION_ORDER.indexOf("custom hooks")
                const secondPos = REGION_ORDER.lastIndexOf("custom hooks")
                const prevOptions = prevIdx === -1 ? [firstPos, secondPos] : [prevIdx]
                const currOptions = currIdx === -1 ? [firstPos, secondPos] : [currIdx]

                if (!prevOptions.some(p => currOptions.some(c => p <= c)))
                    context.report({
                        node: curr.node,
                        messageId: "outOfOrder",
                        data: {
                            current: curr.name,
                            previous: prev.name
                        }
                    })
            } else {
                const prevCustomCount = countCustomHooksUpTo(regions, i - 1)
                const currCustomCount = countCustomHooksUpTo(regions, i)
                const prevEffective = prevIdx === -1 ? getCustomHooksEffectiveIndex(prevCustomCount) : prevIdx
                const currEffective = currIdx === -1 ? getCustomHooksEffectiveIndex(currCustomCount) : currIdx

                if (prevEffective > currEffective)
                    context.report({
                        node: curr.node,
                        messageId: "outOfOrder",
                        data: {
                            current: curr.name,
                            previous: prev.name
                        }
                    })
            }

            continue
        }

        if (prevIdx > currIdx)
            context.report({
                node: curr.node,
                messageId: "outOfOrder",
                data: {
                    current: curr.name,
                    previous: prev.name
                }
            })
    }
}

function checkDuplicates(context: IRuleContext, regions: IRegionOccurrence[]): void {
    const counts = new Map<string, number>()
    for (const region of regions) counts.set(region.normalized, (counts.get(region.normalized) ?? 0) + 1)

    for (const [normalized, count] of counts) {
        const maxAllowed = ALLOWED_DUPLICATE_REGIONS.get(normalized) ?? 1
        if (count <= maxAllowed) continue

        const excess = regions.filter(r => r.normalized === normalized).slice(maxAllowed)
        for (const region of excess)
            context.report({
                node: region.node,
                messageId: "duplicateRegion",
                data: { name: region.name }
            })
    }

    // An excess occurrence (already flagged as duplicateRegion above) may also
    // trigger adjacentDuplicateRegion if it happens to be adjacent to its
    // predecessor. This double-reporting is intentional: both problems are real
    // and a developer deserves to see both messages on the same node.
    for (let i = 1; i < regions.length; i++) {
        const curr = regions[i].normalized
        if (ALLOWED_DUPLICATE_REGIONS.has(curr) && regions[i - 1].normalized === curr)
            context.report({
                node: regions[i].node,
                messageId: "adjacentDuplicateRegion",
                data: { name: regions[i].name }
            })
    }
}

function countCustomHooksUpTo(regions: IRegionOccurrence[], index: number): number {
    let count = 0
    for (let i = 0; i <= index; i++) if (regions[i].normalized === "custom hooks") count++

    return count
}

function getCustomHooksEffectiveIndex(occurrence: number): number {
    if (occurrence <= 1) return REGION_ORDER.indexOf("custom hooks")

    return REGION_ORDER.lastIndexOf("custom hooks")
}

function validateRegions(context: IRuleContext, comments: TSESTree.Comment[]): void {
    const regions = findRegions(context, comments)
    if (regions.length < 2) return

    checkDuplicates(context, regions)
    checkOrdering(context, regions)
}

function collectFunctionScopes(body: TSESTree.Program["body"]): IFunctionScope[] {
    const scopes: IFunctionScope[] = []

    for (const statement of body)
        if (statement.type === "FunctionDeclaration") {
            scopes.push({ startLine: statement.loc.start.line, endLine: statement.loc.end.line })
        } else if (statement.type === "ExportNamedDeclaration" && statement.declaration) {
            if (statement.declaration.type === "FunctionDeclaration")
                scopes.push({
                    startLine: statement.declaration.loc.start.line,
                    endLine: statement.declaration.loc.end.line
                })
            else if (statement.declaration.type === "VariableDeclaration")
                pushArrowFunctionScopes(statement.declaration, scopes)
        } else if (statement.type === "ExportDefaultDeclaration") {
            if (statement.declaration.type === "FunctionDeclaration")
                scopes.push({
                    startLine: statement.declaration.loc.start.line,
                    endLine: statement.declaration.loc.end.line
                })
        } else if (statement.type === "VariableDeclaration") {
            pushArrowFunctionScopes(statement, scopes)
        }

    return scopes
}

function pushArrowFunctionScopes(decl: TSESTree.VariableDeclaration, scopes: IFunctionScope[]): void {
    for (const declarator of decl.declarations)
        if (declarator.init?.type === "ArrowFunctionExpression" || declarator.init?.type === "FunctionExpression")
            scopes.push({ startLine: declarator.init.loc.start.line, endLine: declarator.init.loc.end.line })
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "enforce the canonical ordering of " + "// #region … // #endregion blocks " + "inside React components"
        },
        messages: {
            outOfOrder:
                'Region "{{ current }}" must come before ' +
                '"{{ previous }}". Follow the canonical ' +
                `order: ${CANONICAL_ORDER_LABEL}.`,
            unclosedRegion:
                'Region "{{ name }}" is opened with ' + "`// #region` but never closed with " + "`// #endregion`.",
            nestedRegion:
                'Region "{{ inner }}" is nested inside ' + '"{{ outer }}". Nested regions are not ' + "allowed.",
            unknownRegion:
                'Region "{{ name }}" is not a recognized region. ' +
                "Only the following regions are allowed: {{ allowed }}.",
            duplicateRegion:
                'Region "{{ name }}" is duplicated. ' +
                'Only "Custom hooks" may appear twice; all other regions must be unique.',
            adjacentDuplicateRegion: 'The two "{{ name }}" regions must not be placed next to each other.'
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        return {
            "Program:exit"() {
                const comments = context.sourceCode.getAllComments()
                if (comments.length === 0) return

                const hasRegion = comments.some(c => c.type === "Line" && REGION_OPEN_RE.test(`//${c.value}`))
                if (!hasRegion) return

                const scopes = collectFunctionScopes(context.sourceCode.ast.body)

                if (scopes.length <= 1) {
                    validateRegions(context, comments)
                    return
                }

                for (const scope of scopes) {
                    const scopeComments = comments.filter(
                        c => c.loc.start.line >= scope.startLine && c.loc.end.line <= scope.endLine
                    )
                    if (!scopeComments.some(c => c.type === "Line" && REGION_OPEN_RE.test(`//${c.value}`))) continue
                    validateRegions(context, scopeComments)
                }
            }
        }
    }
}

export default rule
