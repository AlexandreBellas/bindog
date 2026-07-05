import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"

type IMessageIds = "noDirectServiceCall"

const SERVICE_HOOK_RE = /^use\w+Service$/

function isAllowedFile(filename: string): boolean {
    const normalized = filename.replace(/\\/g, "/")
    if (/\.(test|spec)\.[jt]sx?$/.test(normalized)) return true
    if (normalized.includes("/hooks/queries/")) return true
    if (normalized.includes("/hooks/services/")) return true
    return false
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "disallow calling use*Service() outside " +
                "of query/mutation hooks — use TanStack Query " +
                "mutations instead of direct service calls"
        },
        messages: {
            noDirectServiceCall:
                "Do not call {{ name }}() directly in " +
                "components or hooks. Use a TanStack Query " +
                "query or mutation hook instead (from `src/hooks/queries/`)."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        if (isAllowedFile(context.filename)) return {}

        return {
            CallExpression(node: TSESTree.CallExpression) {
                if (node.callee.type !== AST_NODE_TYPES.Identifier) return
                if (!SERVICE_HOOK_RE.test(node.callee.name)) return

                context.report({
                    node,
                    messageId: "noDirectServiceCall",
                    data: { name: node.callee.name }
                })
            }
        }
    }
}

export default rule
