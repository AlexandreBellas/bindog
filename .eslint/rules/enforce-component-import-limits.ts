import type { TSESLint, TSESTree } from "@typescript-eslint/utils"

type IMessageIds =
    | "importFromDisallowedAlias"
    | "importSubComponent"
    | "localImportSubComponent"
    | "parentImportSubComponent"
    | "parentImportNotAllowed"
    | "parentImportFromDisallowedFolder"

const DISALLOWED_ALIAS_FOLDERS: ReadonlySet<string> = new Set(["services", "pages"])

const UNLIMITED_PARENT_FOLDERS: ReadonlySet<string> = new Set(["hooks", "utils", "contexts", "@types", "constants"])

const SUB_FOLDER_INDICATORS: ReadonlySet<string> = new Set([
    "components",
    "hooks",
    "utils",
    "contexts",
    "providers",
    "constants",
    "stores",
    "docs",
    "types",
    "@types"
])

function parseWorkspaceAlias(source: string): { folder: string; remainder: string } | null {
    if (source.startsWith("@/")) {
        const rest = source.slice(2)
        const slashIndex = rest.indexOf("/")
        if (slashIndex === -1) return { folder: rest, remainder: "" }
        return { folder: rest.slice(0, slashIndex), remainder: rest.slice(slashIndex + 1) }
    }

    if (source.startsWith("@") && !source.startsWith("@/")) {
        const slashIndex = source.indexOf("/")
        if (slashIndex === -1) {
            if (source.length === 1) return null
            return { folder: source.slice(1), remainder: "" }
        }

        const aliasHead = source.slice(0, slashIndex)
        if (aliasHead.length < 2) return null

        return { folder: aliasHead.slice(1), remainder: source.slice(slashIndex + 1) }
    }

    return null
}

function findSubComponentIndicator(remainder: string): { hasIndicator: boolean; topLevel: string } {
    const segments = remainder.split("/").filter(Boolean)
    if (segments.length <= 1) return { hasIndicator: false, topLevel: segments[0] ?? "" }

    for (let i = 1; i < segments.length; i++)
        if (SUB_FOLDER_INDICATORS.has(segments[i]))
            return { hasIndicator: true, topLevel: segments.slice(0, i).join("/") }

    return { hasIndicator: false, topLevel: segments[0] }
}

function countParentDepth(source: string): number {
    let depth = 0
    let rest = source
    while (rest.startsWith("../")) {
        depth += 1
        rest = rest.slice(3)
    }
    if (rest === "..") depth += 1
    return depth
}

function stripLeadingParents(source: string): string {
    let rest = source
    while (rest.startsWith("../")) rest = rest.slice(3)
    if (rest === "..") return ""
    return rest
}

function stripLeadingDot(source: string): string {
    if (source === ".") return ""
    if (source.startsWith("./")) return source.slice(2)
    return source
}

function startsWithParent(source: string): boolean {
    return source === ".." || source.startsWith("../")
}

/**
 * Parent imports through a `components/` segment (sibling, uncle, grand-uncle, …).
 * Any positive `../` depth is allowed; sub-component paths are blocked separately.
 */
export function isAllowedComponentsParentImportDepth(parentDepth: number): boolean {
    return parentDepth >= 1
}

/**
 * Parent imports of a sibling/uncle component by folder name (e.g. `../Bro`, `../../../Foo`).
 */
export function isAllowedComponentNameParentDepth(parentDepth: number): boolean {
    return parentDepth >= 1
}

/**
 * Returns whether a parent-relative path reaches past a sibling/uncle component root
 * (e.g. `components/ActionsBox/components/Child` or `ActionsBox/hooks/useX`).
 */
export function findParentRelativeSubComponent(remainder: string): { hasIndicator: boolean; topLevel: string } {
    const segments = remainder.split("/").filter(Boolean)
    if (segments.length === 0) return { hasIndicator: false, topLevel: "" }

    const pathAfterComponentsFolder = segments[0] === "components" ? segments.slice(1).join("/") : remainder

    return findSubComponentIndicator(pathAfterComponentsFolder)
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "When editing a component under src/components or src/pages, limit which modules may be " +
                "imported: only 1st-level local children, sibling and uncle (not parent) components, " +
                "top-level global components, and parent hooks/utils/contexts/@types/constants. " +
                "Alias imports from @services and @pages are forbidden."
        },
        messages: {
            importFromDisallowedAlias:
                "Components must not import from `@{{ folder }}`. " +
                'Found import "{{ source }}". Lift shared code to `src/components`, `src/hooks`, ' +
                "`src/utils`, `src/contexts`, `src/stores`, or `src/constants` instead.",
            importSubComponent:
                "Only the top-most global component may be imported. " +
                '"{{ source }}" reaches into the internals of "{{ topLevel }}". Import the ' +
                "top-level component (e.g. `@components/{{ topLevel }}`) or expose it via a barrel instead.",
            localImportSubComponent:
                "Only 1st-level child components may be imported locally. " +
                '"{{ source }}" reaches into the internals of "{{ topLevel }}". Import ' +
                "`./components/{{ topLevel }}` or lift the child to a sibling folder.",
            parentImportSubComponent:
                "Only the top-most sibling or uncle component may be imported via a parent path. " +
                '"{{ source }}" reaches into the internals of "{{ topLevel }}". Import ' +
                "`…/components/{{ topLevel }}` or expose the API via the sibling barrel instead.",
            parentImportNotAllowed:
                "Parent-relative imports must target a recognised folder or a sibling/uncle component. " +
                '"{{ source }}" is not allowed — use `../hooks`, `../utils`, `../../components/…`, ' +
                "`../SiblingComponent`, or similar.",
            parentImportFromDisallowedFolder:
                'Parent-relative imports from "{{ folder }}" are not allowed. ' +
                'Found import "{{ source }}". Allowed parent folders are `hooks`, `utils`, ' +
                "`contexts`, `@types`, `components`, and `constants`."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        function report(node: TSESTree.ImportDeclaration, messageId: IMessageIds, data: Record<string, string>): void {
            context.report({ node: node.source, messageId, data })
        }

        function checkWorkspaceAlias(node: TSESTree.ImportDeclaration, source: string): void {
            const parsed = parseWorkspaceAlias(source)
            if (!parsed) return

            if (DISALLOWED_ALIAS_FOLDERS.has(parsed.folder)) {
                report(node, "importFromDisallowedAlias", { source, folder: parsed.folder })
                return
            }

            if (parsed.folder !== "components") return

            const { hasIndicator, topLevel } = findSubComponentIndicator(parsed.remainder)
            if (!hasIndicator) return

            report(node, "importSubComponent", { source, topLevel })
        }

        function checkLocalImport(node: TSESTree.ImportDeclaration, source: string): void {
            const remainder = stripLeadingDot(source)
            if (!remainder) return

            const segments = remainder.split("/").filter(Boolean)
            if (segments[0] !== "components" || segments.length <= 1) return

            const childPath = segments.slice(1).join("/")
            const { hasIndicator, topLevel } = findSubComponentIndicator(childPath)
            if (!hasIndicator) return

            report(node, "localImportSubComponent", { source, topLevel })
        }

        function checkParentImport(node: TSESTree.ImportDeclaration, source: string): void {
            const depth = countParentDepth(source)
            const remainder = stripLeadingParents(source)
            const segments = remainder.split("/").filter(Boolean)
            const firstSegment = segments[0]

            if (!firstSegment) {
                report(node, "parentImportNotAllowed", { source })
                return
            }

            if (UNLIMITED_PARENT_FOLDERS.has(firstSegment)) return

            if (firstSegment === "components") {
                if (!isAllowedComponentsParentImportDepth(depth)) return

                const { hasIndicator, topLevel } = findParentRelativeSubComponent(remainder)
                if (hasIndicator) report(node, "parentImportSubComponent", { source, topLevel })

                return
            }

            if (SUB_FOLDER_INDICATORS.has(firstSegment)) {
                report(node, "parentImportFromDisallowedFolder", { source, folder: firstSegment })
                return
            }

            if (!isAllowedComponentNameParentDepth(depth)) return

            const { hasIndicator, topLevel } = findParentRelativeSubComponent(remainder)
            if (hasIndicator) report(node, "parentImportSubComponent", { source, topLevel })
        }

        return {
            ImportDeclaration(node: TSESTree.ImportDeclaration) {
                const source = node.source.value
                if (typeof source !== "string") return

                if (startsWithParent(source)) {
                    checkParentImport(node, source)
                    return
                }

                if (source === "." || source.startsWith("./")) {
                    checkLocalImport(node, source)
                    return
                }

                if (source.startsWith("@")) checkWorkspaceAlias(node, source)
            }
        }
    }
}

export default rule
