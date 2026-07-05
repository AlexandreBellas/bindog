import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"

type IMessageIds = "multipleCalls" | "missingNamespacePrefix"

const I18NEXT_SOURCES = new Set(["react-i18next", "i18next"])

interface IUseTranslationCall {
    node: TSESTree.CallExpression
    tVarName: string | null
    namespaces: string[]
}

interface IScopeInfo {
    /** All useTranslation calls found at the top level of this function scope. */
    calls: IUseTranslationCall[]
    /**
     * t-variable names declared in this scope that require a namespace prefix
     * on every call (because they were bound to multiple namespaces).
     */
    ownedTVarsRequiringPrefix: Set<string>
}

/**
 * Returns the local (aliased) property value name for the `t` key extracted
 * from the ObjectPattern id of a useTranslation VariableDeclarator.
 *
 * Given `const { t: tAlias } = useTranslation(...)`, returns "tAlias".
 * Given `const { t } = useTranslation(...)`, returns "t".
 * Returns null when the pattern cannot be resolved.
 */
function extractTVarName(callNode: TSESTree.CallExpression): string | null {
    const parent = callNode.parent
    if (!parent || parent.type !== AST_NODE_TYPES.VariableDeclarator) return null

    const id = parent.id
    if (id.type !== AST_NODE_TYPES.ObjectPattern) return null

    for (const prop of id.properties) {
        if (prop.type !== AST_NODE_TYPES.Property) continue
        const key = prop.key
        if (key.type !== AST_NODE_TYPES.Identifier || key.name !== "t") continue
        const value = prop.value
        if (value.type === AST_NODE_TYPES.Identifier) return value.name
    }

    return null
}

/**
 * Extracts namespace string(s) from a useTranslation call argument.
 *
 * - `useTranslation("ns")` → `["ns"]`
 * - `useTranslation(["ns1", "ns2"])` → `["ns1", "ns2"]`
 * - `useTranslation()` → `[]`
 * - dynamic argument → `[]` (unknown, not enforced)
 */
function extractNamespaces(callNode: TSESTree.CallExpression): string[] {
    const arg = callNode.arguments[0]
    if (!arg) return []

    if (arg.type === AST_NODE_TYPES.Literal && typeof arg.value === "string") 
        return [arg.value]
    

    if (arg.type === AST_NODE_TYPES.ArrayExpression) {
        const result: string[] = []
        for (const el of arg.elements) 
            if (el && el.type === AST_NODE_TYPES.Literal && typeof el.value === "string") 
                result.push(el.value)
            
        
        return result
    }

    return []
}

/**
 * Enforces a single `useTranslation` call (from react-i18next / i18next) per
 * React component or hook and validates that, when multiple namespaces are
 * requested, every `t(…)` call includes a namespace prefix.
 *
 * @example
 * // ❌ invalid – two calls
 * const { t: tCommon } = useTranslation("common")
 * const { t: tProject } = useTranslation("project")
 *
 * // ✅ valid – single call with array
 * const { t } = useTranslation(["common", "project"])
 * t("common:key")  // namespace prefix required when > 1 namespace
 * t("project:key")
 */
const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Enforce a single `useTranslation` call from react-i18next/i18next per component or hook. " +
                "When multiple namespaces are requested, all `t(…)` calls must include a namespace prefix."
        },
        messages: {
            multipleCalls:
                "Only one `useTranslation` call is allowed per component or hook. " +
                'Use a single call with an array of namespaces: `useTranslation(["ns1", "ns2"])`.',
            missingNamespacePrefix:
                "When `useTranslation` is called with multiple namespaces, every `t(…)` call " +
                'must include a namespace prefix, e.g. `t("namespace:key")`.'
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        /** Local identifier name bound to i18next's useTranslation in this file. */
        let i18nextLocalName: string | null = null

        /** Stack of currently active function scopes (innermost last). */
        const scopeStack: IScopeInfo[] = []

        /**
         * File-level set of t-variable names that currently require a namespace
         * prefix. Entries are added when a multi-namespace useTranslation call is
         * detected and removed when their owning scope is popped.
         */
        const activeTVarsRequiringPrefix = new Set<string>()

        function currentScope(): IScopeInfo | null {
            return scopeStack.length > 0 ? scopeStack[scopeStack.length - 1] : null
        }

        function pushScope(): void {
            scopeStack.push({ calls: [], ownedTVarsRequiringPrefix: new Set() })
        }

        function popScope(): void {
            const scope = scopeStack.pop()
            if (!scope) return

            for (let i = 1; i < scope.calls.length; i++) 
                context.report({ node: scope.calls[i].node, messageId: "multipleCalls" })
            

            for (const tVar of scope.ownedTVarsRequiringPrefix) 
                activeTVarsRequiringPrefix.delete(tVar)
            
        }

        function isI18nextCall(node: TSESTree.CallExpression): boolean {
            if (!i18nextLocalName) return false
            return node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === i18nextLocalName
        }

        return {
            ImportDeclaration(node: TSESTree.ImportDeclaration) {
                if (!I18NEXT_SOURCES.has(node.source.value as string)) return
                for (const spec of node.specifiers) 
                    if (
                        spec.type === AST_NODE_TYPES.ImportSpecifier &&
                        spec.imported.type === AST_NODE_TYPES.Identifier &&
                        spec.imported.name === "useTranslation"
                    ) 
                        i18nextLocalName = spec.local.name
                    
                
            },

            FunctionDeclaration() {
                pushScope()
            },

            "FunctionDeclaration:exit"() {
                popScope()
            },

            FunctionExpression() {
                pushScope()
            },

            "FunctionExpression:exit"() {
                popScope()
            },

            ArrowFunctionExpression() {
                pushScope()
            },

            "ArrowFunctionExpression:exit"() {
                popScope()
            },

            CallExpression(node: TSESTree.CallExpression) {
                if (isI18nextCall(node)) {
                    const scope = currentScope()
                    if (!scope) return

                    const tVarName = extractTVarName(node)
                    const namespaces = extractNamespaces(node)

                    scope.calls.push({ node, tVarName, namespaces })

                    if (namespaces.length > 1 && tVarName) {
                        scope.ownedTVarsRequiringPrefix.add(tVarName)
                        activeTVarsRequiringPrefix.add(tVarName)
                    }
                    return
                }

                if (
                    node.callee.type === AST_NODE_TYPES.Identifier &&
                    activeTVarsRequiringPrefix.has(node.callee.name)
                ) {
                    const firstArg = node.arguments[0]
                    if (!firstArg) return
                    if (firstArg.type !== AST_NODE_TYPES.Literal) return
                    if (typeof firstArg.value !== "string") return
                    if (!firstArg.value.includes(":")) 
                        context.report({ node, messageId: "missingNamespacePrefix" })
                    
                }
            }
        }
    }
}

export default rule
