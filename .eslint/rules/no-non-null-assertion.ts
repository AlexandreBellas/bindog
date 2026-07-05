import type { TSESLint, TSESTree } from "@typescript-eslint/utils"

type IMessageIds = "noNonNullAssertion"

/**
 * Disallows the use of the non-null assertion operator (`!`) in TypeScript files.
 * Use proper type guards or optional chaining instead of bypassing null checks.
 */
const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "disallow the non-null assertion operator (`!`) — " +
                "use type guards or optional chaining instead"
        },
        messages: {
            noNonNullAssertion:
                "Non-null assertion operator (`!`) is not allowed. " +
                "Use a type guard, optional chaining (`?.`), or nullish coalescing (`??`) instead."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        return {
            TSNonNullExpression(node: TSESTree.TSNonNullExpression) {
                context.report({ node, messageId: "noNonNullAssertion" })
            }
        }
    }
}

export default rule
