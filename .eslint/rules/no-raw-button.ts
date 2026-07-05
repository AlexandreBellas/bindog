import type { TSESLint, TSESTree } from "@typescript-eslint/utils"

type IMessageIds = "noRawButton"

/**
 * Disallows the use of raw `<button>` HTML elements in JSX/TSX files.
 * Use the shadcn Button component from `src/components/ui/button` instead,
 * which applies the project's design system tokens and accessibility standards.
 */
const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "disallow raw `<button>` HTML elements — " +
                "use the shadcn Button component from `src/components/ui/button` instead"
        },
        messages: {
            noRawButton:
                "Avoid using raw `<button>` HTML elements. " +
                "Use the shadcn Button component from `src/components/ui/button` instead."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        return {
            JSXOpeningElement(node: TSESTree.JSXOpeningElement) {
                if (node.name.type === "JSXIdentifier" && node.name.name === "button")
                    context.report({ node, messageId: "noRawButton" })
            }
        }
    }
}

export default rule
