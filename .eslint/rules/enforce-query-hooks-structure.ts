import { simpleTraverse } from "@typescript-eslint/typescript-estree"
import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"
import { basename, extname } from "node:path"

type IMessageIds =
    | "useQueryOutsideQueriesFolder"
    | "useMutationOutsideQueriesFolder"
    | "fileNotInPrivateOrPublic"
    | "invalidFileName"
    | "invalidSharedFile"
    | "missingQueryKeysConstant"
    | "queryKeysConstantNotExported"
    | "queryKeysMissingAllProperty"
    | "invalidTopLevelFunction"
    | "hookMissingUseQueryCall"
    | "hookMissingUseMutationCall"
    | "hookMissingUseInfiniteQueryCall"
    | "hookMissingFetchQueryReturn"
    | "hookMissingUsePrefetchAdjacentPagesCall"
    | "forbiddenUseMutationInQueryHook"
    | "forbiddenUseQueryInMutationHook"

const VALID_HOOK_SUFFIXES = [
    "FetchQuery",
    "PrefetchAdjacentPages",
    "InfiniteQuery",
    "Stream",
    "Query",
    "Mutation"
] as const

type IHookSuffix = (typeof VALID_HOOK_SUFFIXES)[number]

function normalize(filename: string): string {
    return filename.replace(/\\/g, "/")
}

function isTestFile(filename: string): boolean {
    return /\.(test|spec)\.[jt]sx?$/.test(normalize(filename))
}

function isInQueriesFolder(filename: string): boolean {
    return normalize(filename).includes("/hooks/queries/")
}

function getQueriesSubfolder(filename: string): "private" | "public" | null {
    const match = normalize(filename).match(/\/hooks\/queries\/(private|public)\//)
    if (!match) return null
    const folder = match[1]
    if (folder === "private" || folder === "public") return folder
    return null
}

function isInSharedFolder(filename: string): boolean {
    return normalize(filename).includes("/hooks/queries/@shared/")
}

type IHookFileResolution =
    | { kind: "hookFile"; baseName: string; isFolderBased: boolean }
    | { kind: "keysFile"; expectedKeysName: string }
    | { kind: "supportingFile" }

function resolveHookFile(filename: string, subfolder: "private" | "public"): IHookFileResolution {
    const norm = normalize(filename)
    const marker = `/hooks/queries/${subfolder}/`
    const idx = norm.indexOf(marker)
    if (idx === -1) return { kind: "hookFile", baseName: "", isFolderBased: false }

    const relativePath = norm.slice(idx + marker.length)
    const segments = relativePath.split("/")

    if (segments.length === 1)
        return { kind: "hookFile", baseName: basename(segments[0], extname(segments[0])), isFolderBased: false }

    const folderName = segments[0]
    const hookPattern = subfolder === "private" ? /^usePrivate\w+Query$/ : /^usePublic\w+Query$/
    if (hookPattern.test(folderName)) {
        if (segments.length === 2 && basename(segments[1], extname(segments[1])) === "index")
            return { kind: "hookFile", baseName: folderName, isFolderBased: true }

        if (segments.length === 3 && segments[1] === "constants") {
            const expectedKeysName = deriveExpectedKeysName(subfolder, folderName)
            const fileBaseName = basename(segments[2], extname(segments[2]))
            if (expectedKeysName && fileBaseName === expectedKeysName) return { kind: "keysFile", expectedKeysName }
        }

        return { kind: "supportingFile" }
    }

    return {
        kind: "hookFile",
        baseName: basename(segments[segments.length - 1], extname(segments[segments.length - 1])),
        isFolderBased: false
    }
}

/**
 * Returns the hook suffix matched by name (longest match first to avoid
 * e.g. "Query" matching before "FetchQuery" or "InfiniteQuery").
 */
function getHookSuffix(name: string): IHookSuffix | null {
    if (name.endsWith("FetchQuery")) return "FetchQuery"
    if (name.endsWith("PrefetchAdjacentPages")) return "PrefetchAdjacentPages"
    if (name.endsWith("InfiniteQuery")) return "InfiniteQuery"
    if (name.endsWith("Stream")) return "Stream"
    if (name.endsWith("Query")) return "Query"
    if (name.endsWith("Mutation")) return "Mutation"
    return null
}

/**
 * A name is a valid hook if it starts with "use" and ends with one of the
 * recognised TanStack Query hook suffixes.
 */
function isValidHookName(name: string): boolean {
    return name.startsWith("use") && VALID_HOOK_SUFFIXES.some(suffix => name.endsWith(suffix))
}

/**
 * Derives the expected keys constant name from the file name and folder.
 *
 * Example:
 *   folder = "private", baseName = "usePrivateInsightsQuery"
 *   → entity = "Insights"
 *   → result = "privateInsightsQueryKeys"
 */
function deriveExpectedKeysName(folder: "private" | "public", baseName: string): string | null {
    const prefix = folder === "private" ? "usePrivate" : "usePublic"
    if (!baseName.startsWith(prefix)) return null
    const afterPrefix = baseName.slice(prefix.length) // e.g. "InsightsQuery"
    if (!afterPrefix.endsWith("Query")) return null
    const entity = afterPrefix.slice(0, -"Query".length) // e.g. "Insights"
    if (!entity) return null
    return `${folder}${entity}QueryKeys`
}

/**
 * Returns true if a CallExpression with callee.name === callName appears
 * anywhere within the given AST subtree.
 */
function hasCallInNode(node: TSESTree.Node, callName: string): boolean {
    let found = false
    simpleTraverse(node, {
        enter(n) {
            if (found) return
            if (
                n.type === AST_NODE_TYPES.CallExpression &&
                n.callee.type === AST_NODE_TYPES.Identifier &&
                n.callee.name === callName
            )
                found = true
        }
    })
    return found
}

/**
 * Returns true if the block statement contains a ReturnStatement whose
 * argument is an ObjectExpression that has a property keyed "fetchQuery".
 */
function hasReturnWithFetchQueryKey(body: TSESTree.BlockStatement): boolean {
    let found = false
    simpleTraverse(body, {
        enter(n) {
            if (found) return
            if (n.type === AST_NODE_TYPES.ReturnStatement && n.argument) {
                const arg = n.argument
                if (arg.type === AST_NODE_TYPES.ObjectExpression)
                    found = arg.properties.some(
                        prop =>
                            prop.type === AST_NODE_TYPES.Property &&
                            prop.key.type === AST_NODE_TYPES.Identifier &&
                            prop.key.name === "fetchQuery"
                    )
            }
        }
    })
    return found
}

/**
 * Returns true when a FetchQuery hook's body contains a `{ fetchQuery }` return.
 * Handles both block-body functions (`return { fetchQuery }`) and concise
 * arrow functions where the body expression is itself `{ fetchQuery, ... }`.
 */
function hasFetchQueryReturn(body: TSESTree.BlockStatement | TSESTree.Expression): boolean {
    if (body.type === AST_NODE_TYPES.BlockStatement) return hasReturnWithFetchQueryKey(body)

    // Concise arrow body: `() => ({ fetchQuery })` — the expression IS the return value.
    if (body.type === AST_NODE_TYPES.ObjectExpression)
        return body.properties.some(
            prop =>
                prop.type === AST_NODE_TYPES.Property &&
                prop.key.type === AST_NODE_TYPES.Identifier &&
                prop.key.name === "fetchQuery"
        )

    return false
}

/**
 * Returns true when a VariableDeclarator at the top level of a query hook
 * file has an ArrowFunctionExpression or FunctionExpression as its init.
 * Only top-level `const` declarators (directly under Program or an
 * ExportNamedDeclaration that is a direct child of Program) are considered.
 */
function isTopLevelArrowOrFunctionExpressionDeclarator(node: TSESTree.VariableDeclarator): boolean {
    const varDecl = node.parent
    if (varDecl.type !== AST_NODE_TYPES.VariableDeclaration) return false
    if (varDecl.kind !== "const") return false

    const parent = varDecl.parent
    if (parent.type === AST_NODE_TYPES.Program) return true
    if (parent.type === AST_NODE_TYPES.ExportNamedDeclaration && parent.parent.type === AST_NODE_TYPES.Program)
        return true
    return false
}

/**
 * Runs the hook-body validation for a given hook name and body.
 * Shared between FunctionDeclaration and arrow/function-expression hooks.
 */
function validateHookBody(
    reportNode: TSESTree.Node,
    name: string,
    body: TSESTree.BlockStatement | TSESTree.Expression,
    context: TSESLint.RuleContext<IMessageIds, []>
): void {
    const suffix = getHookSuffix(name)!

    switch (suffix) {
        case "Query":
            if (!hasCallInNode(body, "useQuery"))
                context.report({ node: reportNode, messageId: "hookMissingUseQueryCall", data: { name } })
            if (hasCallInNode(body, "useMutation"))
                context.report({ node: reportNode, messageId: "forbiddenUseMutationInQueryHook", data: { name } })
            break
        case "Mutation":
            if (!hasCallInNode(body, "useMutation"))
                context.report({ node: reportNode, messageId: "hookMissingUseMutationCall", data: { name } })
            if (hasCallInNode(body, "useQuery"))
                context.report({ node: reportNode, messageId: "forbiddenUseQueryInMutationHook", data: { name } })
            break
        case "InfiniteQuery":
            if (!hasCallInNode(body, "useInfiniteQuery"))
                context.report({ node: reportNode, messageId: "hookMissingUseInfiniteQueryCall", data: { name } })
            break
        case "FetchQuery":
            if (!hasFetchQueryReturn(body))
                context.report({ node: reportNode, messageId: "hookMissingFetchQueryReturn", data: { name } })
            break
        case "PrefetchAdjacentPages":
            if (!hasCallInNode(body, "usePrefetchAdjacentPages"))
                context.report({
                    node: reportNode,
                    messageId: "hookMissingUsePrefetchAdjacentPagesCall",
                    data: { name }
                })
            break
        case "Stream":
            break
    }
}

/**
 * Returns true when node is a top-level FunctionDeclaration — i.e. either
 * a direct child of Program, or the declaration of an ExportNamedDeclaration
 * that is itself a direct child of Program.
 */
function isTopLevelFunctionDeclaration(node: TSESTree.FunctionDeclaration): boolean {
    const parent = node.parent
    if (parent.type === AST_NODE_TYPES.Program) return true
    if (parent.type === AST_NODE_TYPES.ExportNamedDeclaration && parent.parent.type === AST_NODE_TYPES.Program)
        return true
    return false
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "enforce correct placement, naming, and implementation of " +
                "query/mutation hooks under src/hooks/queries/"
        },
        messages: {
            useQueryOutsideQueriesFolder:
                "`useQuery` must only be used inside `src/hooks/queries/`. " +
                "Move this logic into a hook under `src/hooks/queries/private/` " +
                "or `src/hooks/queries/public/`.",
            useMutationOutsideQueriesFolder:
                "`useMutation` must only be used inside `src/hooks/queries/`. " +
                "Move this logic into a hook under `src/hooks/queries/private/` " +
                "or `src/hooks/queries/public/`.",
            fileNotInPrivateOrPublic:
                "Files inside `src/hooks/queries/` must be placed in either " +
                "the `private/` or the `public/` subfolder. No other folders are allowed. " +
                "Move this file to the correct location.",
            invalidFileName:
                "Files in `src/hooks/queries/{{ folder }}/` must follow the naming " +
                "convention `use{{ Folder }}*Query.ts` (e.g. `usePrivateInsightsQuery.ts`). " +
                "Rename this file accordingly.",
            invalidSharedFile:
                "Only `queries.ts` and `mutations.ts` are allowed inside " +
                "`src/hooks/queries/@shared/`. Move this file elsewhere or remove it.",
            missingQueryKeysConstant:
                "This query hook file must export a keys constant named `{{ expectedName }}`. " +
                'Add: `export const {{ expectedName }} = { all: () => ["{{ folder }}", "..."] as const }`.',
            queryKeysConstantNotExported:
                "The query keys constant `{{ name }}` must be exported. " +
                "Add the `export` keyword: `export const {{ name }} = { ... }`.",
            queryKeysMissingAllProperty:
                "The query keys constant `{{ name }}` must include an `all` property. " +
                'Add: `all: () => ["{{ folder }}", "{{ entity }}"] as const`.',
            invalidTopLevelFunction:
                "Only hook functions are allowed at the top level of query hook files. " +
                "Function `{{ name }}` must start with `use` and end with one of: " +
                "Query, Mutation, FetchQuery, PrefetchAdjacentPages, InfiniteQuery, Stream. " +
                "Rename or extract it to a separate utils file.",
            hookMissingUseQueryCall:
                "Hook `{{ name }}` ends with `Query` but does not call `useQuery()`. " +
                "Add a `return useQuery({ ... })` call.",
            hookMissingUseMutationCall:
                "Hook `{{ name }}` ends with `Mutation` but does not call `useMutation()`. " +
                "Add a `return useMutation({ ... })` call.",
            hookMissingUseInfiniteQueryCall:
                "Hook `{{ name }}` ends with `InfiniteQuery` but does not call `useInfiniteQuery()`. " +
                "Add a `return useInfiniteQuery({ ... })` call.",
            hookMissingFetchQueryReturn:
                "Hook `{{ name }}` ends with `FetchQuery` but does not return `{ fetchQuery }`. " +
                "Return an object with a `fetchQuery` key that wraps `queryClient.fetchQuery`.",
            hookMissingUsePrefetchAdjacentPagesCall:
                "Hook `{{ name }}` ends with `PrefetchAdjacentPages` but does not call " +
                "`usePrefetchAdjacentPages()`. Add a `usePrefetchAdjacentPages({ ... })` call.",
            forbiddenUseMutationInQueryHook:
                "Hook `{{ name }}` ends with `Query` but calls `useMutation()`. " +
                "`useMutation` is forbidden inside query hooks. Use `useQuery` instead.",
            forbiddenUseQueryInMutationHook:
                "Hook `{{ name }}` ends with `Mutation` but calls `useQuery()`. " +
                "`useQuery` is forbidden inside mutation hooks. Use `useMutation` instead."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        const filename = normalize(context.filename)

        if (isTestFile(filename)) return {}

        // --- Files OUTSIDE src/hooks/queries/ ----------------------------------------
        // Only enforce that useQuery / useMutation are not called here.
        if (!isInQueriesFolder(filename))
            return {
                CallExpression(node: TSESTree.CallExpression) {
                    if (node.callee.type !== AST_NODE_TYPES.Identifier) return
                    if (node.callee.name === "useQuery")
                        context.report({ node, messageId: "useQueryOutsideQueriesFolder" })
                    else if (node.callee.name === "useMutation")
                        context.report({ node, messageId: "useMutationOutsideQueriesFolder" })
                }
            }

        // --- Files INSIDE src/hooks/queries/@shared/ ----------------------------------
        if (isInSharedFolder(filename)) {
            const base = basename(filename)
            if (base === "queries.ts" || base === "mutations.ts") return {}
            return {
                Program(node: TSESTree.Program) {
                    context.report({ node, messageId: "invalidSharedFile" })
                }
            }
        }

        // --- Files INSIDE src/hooks/queries/ -----------------------------------------
        const subfolder = getQueriesSubfolder(filename)

        // Must be in private/ or public/
        if (!subfolder)
            return {
                Program(node: TSESTree.Program) {
                    context.report({ node, messageId: "fileNotInPrivateOrPublic" })
                }
            }

        // Resolve folder-based hook structure (e.g. usePrivateCrosstabsQuery/index.ts)
        const resolution = resolveHookFile(filename, subfolder)
        if (resolution.kind === "supportingFile") return {}

        // --- Keys file inside folder-based hook (e.g. constants/privateCrosstabsQueryKeys.ts) ---
        if (resolution.kind === "keysFile") {
            const keysName = resolution.expectedKeysName
            let foundNode: TSESTree.Identifier | null = null
            let isExported = false
            let hasAll = false

            return {
                VariableDeclaration(node: TSESTree.VariableDeclaration) {
                    if (node.kind !== "const") return
                    const isTopLevel =
                        node.parent.type === AST_NODE_TYPES.Program ||
                        (node.parent.type === AST_NODE_TYPES.ExportNamedDeclaration &&
                            node.parent.parent.type === AST_NODE_TYPES.Program)
                    if (!isTopLevel) return

                    for (const declarator of node.declarations) {
                        if (declarator.id.type !== AST_NODE_TYPES.Identifier) continue
                        if (declarator.id.name !== keysName) continue
                        if (!declarator.init || declarator.init.type !== AST_NODE_TYPES.ObjectExpression) continue

                        foundNode = declarator.id
                        isExported = node.parent.type === AST_NODE_TYPES.ExportNamedDeclaration
                        hasAll = declarator.init.properties.some(
                            prop =>
                                prop.type === AST_NODE_TYPES.Property &&
                                prop.key.type === AST_NODE_TYPES.Identifier &&
                                prop.key.name === "all"
                        )
                    }
                },
                "Program:exit"(programNode: TSESTree.Program) {
                    if (!foundNode) {
                        context.report({
                            node: programNode,
                            messageId: "missingQueryKeysConstant",
                            data: { expectedName: keysName, folder: subfolder }
                        })
                        return
                    }
                    if (!isExported) {
                        context.report({
                            node: foundNode,
                            messageId: "queryKeysConstantNotExported",
                            data: { name: keysName }
                        })
                        return
                    }
                    if (!hasAll) {
                        const entity = keysName
                            .replace(subfolder, "")
                            .replace(/QueryKeys$/, "")
                            .toLowerCase()
                        context.report({
                            node: foundNode,
                            messageId: "queryKeysMissingAllProperty",
                            data: { name: keysName, folder: subfolder, entity }
                        })
                    }
                }
            }
        }

        // --- Hook file (flat or folder-based index.ts) ---------------------------------
        const { baseName, isFolderBased } = resolution
        const filePattern = subfolder === "private" ? /^usePrivate\w+Query$/ : /^usePublic\w+Query$/
        const isValidFile = filePattern.test(baseName)

        // Derive expected keys constant name (only possible when file name is valid)
        const expectedKeysName = isValidFile ? deriveExpectedKeysName(subfolder, baseName) : null

        let foundKeysConstantNode: TSESTree.Identifier | null = null
        let foundKeysConstantHasAllKey = false
        let foundKeysConstantIsExported = false
        let foundKeysReexported = false

        return {
            Program(node: TSESTree.Program) {
                if (!isValidFile)
                    context.report({
                        node,
                        messageId: "invalidFileName",
                        data: {
                            folder: subfolder,
                            Folder: subfolder === "private" ? "Private" : "Public"
                        }
                    })
            },

            ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
                if (!isFolderBased || !expectedKeysName) return
                if (node.declaration) return
                if (node.parent.type !== AST_NODE_TYPES.Program) return

                for (const specifier of node.specifiers) {
                    if (specifier.type !== AST_NODE_TYPES.ExportSpecifier) continue
                    const exportedName =
                        specifier.exported.type === AST_NODE_TYPES.Identifier
                            ? specifier.exported.name
                            : String(specifier.exported.value)
                    if (exportedName === expectedKeysName) foundKeysReexported = true
                }
            },

            VariableDeclaration(node: TSESTree.VariableDeclaration) {
                if (node.kind !== "const") return
                if (!expectedKeysName) return

                const isTopLevel =
                    node.parent.type === AST_NODE_TYPES.Program ||
                    (node.parent.type === AST_NODE_TYPES.ExportNamedDeclaration &&
                        node.parent.parent.type === AST_NODE_TYPES.Program)
                if (!isTopLevel) return

                for (const declarator of node.declarations) {
                    if (declarator.id.type !== AST_NODE_TYPES.Identifier) continue
                    if (declarator.id.name !== expectedKeysName) continue
                    if (!declarator.init || declarator.init.type !== AST_NODE_TYPES.ObjectExpression) continue

                    foundKeysConstantNode = declarator.id
                    foundKeysConstantIsExported = node.parent.type === AST_NODE_TYPES.ExportNamedDeclaration
                    foundKeysConstantHasAllKey = declarator.init.properties.some(
                        prop =>
                            prop.type === AST_NODE_TYPES.Property &&
                            prop.key.type === AST_NODE_TYPES.Identifier &&
                            prop.key.name === "all"
                    )
                }
            },

            FunctionDeclaration(node: TSESTree.FunctionDeclaration) {
                if (!isTopLevelFunctionDeclaration(node)) return

                const name = node.id?.name
                if (!name) return

                if (!isValidHookName(name)) {
                    context.report({
                        node: node.id ?? node,
                        messageId: "invalidTopLevelFunction",
                        data: { name }
                    })
                    return
                }

                validateHookBody(node.id ?? node, name, node.body, context)
            },

            VariableDeclarator(node: TSESTree.VariableDeclarator) {
                if (!isTopLevelArrowOrFunctionExpressionDeclarator(node)) return
                if (!node.init) return
                if (
                    node.init.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
                    node.init.type !== AST_NODE_TYPES.FunctionExpression
                )
                    return
                if (node.id.type !== AST_NODE_TYPES.Identifier) return

                const name = node.id.name

                if (!isValidHookName(name)) {
                    context.report({
                        node: node.id,
                        messageId: "invalidTopLevelFunction",
                        data: { name }
                    })
                    return
                }

                validateHookBody(node.id, name, node.init.body, context)
            },

            "Program:exit"(programNode: TSESTree.Program) {
                if (!isValidFile || !expectedKeysName) return

                if (!foundKeysConstantNode && !foundKeysReexported) {
                    context.report({
                        node: programNode,
                        messageId: "missingQueryKeysConstant",
                        data: { expectedName: expectedKeysName, folder: subfolder }
                    })
                    return
                }

                // Re-exported keys are validated in the constants keys file
                if (foundKeysReexported) return

                if (!foundKeysConstantIsExported) {
                    context.report({
                        node: foundKeysConstantNode!,
                        messageId: "queryKeysConstantNotExported",
                        data: { name: expectedKeysName }
                    })
                    return
                }

                if (!foundKeysConstantHasAllKey) {
                    const entity = baseName
                        .replace(subfolder === "private" ? "usePrivate" : "usePublic", "")
                        .replace(/Query$/, "")
                        .toLowerCase()
                    context.report({
                        node: foundKeysConstantNode!,
                        messageId: "queryKeysMissingAllProperty",
                        data: {
                            name: expectedKeysName,
                            folder: subfolder,
                            entity
                        }
                    })
                }
            }
        }
    }
}

export default rule
export {
    deriveExpectedKeysName,
    getHookSuffix,
    getQueriesSubfolder,
    hasCallInNode,
    hasFetchQueryReturn,
    hasReturnWithFetchQueryKey,
    isInQueriesFolder,
    isInSharedFolder,
    isTestFile,
    isTopLevelArrowOrFunctionExpressionDeclarator,
    isTopLevelFunctionDeclaration,
    isValidHookName,
    normalize,
    resolveHookFile,
    validateHookBody
}
