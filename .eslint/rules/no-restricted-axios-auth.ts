import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"

type IMessageIds = "noImportAxiosAuth" | "noCallAxiosAuth"

const AXIOS_AUTH_HOOK_NAME = "useAxiosAuth"

/**
 * Normalises a filesystem path to use forward slashes so comparisons
 * work consistently on every OS.
 */
function normalize(filename: string): string {
    return filename.replace(/\\/g, "/")
}

/**
 * Canonical paths (from `src/`) that are allowed to import/use `useAxiosAuth`.
 *
 * - The hook definition itself (so it can export the function).
 * - The PrivateServicesProvider entry point, the only legitimate consumer of
 *   an authenticated Axios instance.
 *
 * Using the full path from `src/` prevents adversarially-named duplicates
 * (e.g. `src/evil/PrivateServicesProvider/index.tsx`) from being silently
 * allowed by a bare `endsWith` check.
 *
 * Test / spec files are already globally ignored by the plugin's recommended
 * config, so they do not need to be handled here.
 */
const ALLOWED_FILES = [
    "src/contexts/services/PrivateServicesProvider/hooks/useAxiosAuth.ts",
    "src/contexts/services/PrivateServicesProvider/index.tsx"
] as const

function isAllowedFile(filename: string): boolean {
    const normalized = normalize(filename)
    return ALLOWED_FILES.some(allowed => normalized.endsWith(allowed))
}

/**
 * Returns true when an import declaration is importing `useAxiosAuth`
 * (regardless of the module specifier used – alias or relative path).
 */
function importsAxiosAuth(node: TSESTree.ImportDeclaration): boolean {
    const source = node.source.value

    const isAxiosAuthSource =
        source === "@hooks/useAxiosAuth" ||
        source.endsWith("/useAxiosAuth") ||
        source.endsWith("/hooks/useAxiosAuth")

    if (!isAxiosAuthSource) return false

    return node.specifiers.some(
        specifier =>
            specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier ||
            (specifier.type === AST_NODE_TYPES.ImportSpecifier &&
                specifier.imported.type === AST_NODE_TYPES.Identifier &&
                specifier.imported.name === AXIOS_AUTH_HOOK_NAME)
    )
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "disallow importing or calling `useAxiosAuth` outside of " +
                "`PrivateServicesProvider/hooks/useAxiosAuth.ts` and " +
                "`PrivateServicesProvider/index.tsx`"
        },
        messages: {
            noImportAxiosAuth:
                "Do not import `useAxiosAuth` here. " +
                "Its usage is reserved for `PrivateServicesProvider/hooks/useAxiosAuth.ts` " +
                "and `PrivateServicesProvider/index.tsx`. " +
                "Use TanStack Query hooks (from `src/hooks/queries/`) or mutations to " +
                "interact with external services instead.",
            noCallAxiosAuth:
                "Do not call `useAxiosAuth()` here. " +
                "Its usage is reserved for `PrivateServicesProvider/hooks/useAxiosAuth.ts` " +
                "and `PrivateServicesProvider/index.tsx`. " +
                "Use TanStack Query hooks (from `src/hooks/queries/`) or mutations to " +
                "interact with external services instead."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        if (isAllowedFile(context.filename)) return {}

        const importedLocalNames = new Set<string>()

        return {
            ImportDeclaration(node: TSESTree.ImportDeclaration) {
                if (!importsAxiosAuth(node)) return

                context.report({ node, messageId: "noImportAxiosAuth" })

                node.specifiers.forEach(specifier => {
                    const isDefault = specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier
                    const isNamedAxiosAuth =
                        specifier.type === AST_NODE_TYPES.ImportSpecifier &&
                        specifier.imported.type === AST_NODE_TYPES.Identifier &&
                        specifier.imported.name === AXIOS_AUTH_HOOK_NAME

                    if (isDefault || isNamedAxiosAuth) importedLocalNames.add(specifier.local.name)
                })
            },

            CallExpression(node: TSESTree.CallExpression) {
                if (node.callee.type !== AST_NODE_TYPES.Identifier) return
                if (node.callee.name !== AXIOS_AUTH_HOOK_NAME) return
                if (importedLocalNames.has(node.callee.name)) return

                context.report({ node, messageId: "noCallAxiosAuth" })
            }
        }
    }
}

export default rule
