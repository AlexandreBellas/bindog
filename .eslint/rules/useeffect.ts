import type { TSESLint, TSESTree } from "@typescript-eslint/utils"

type IMessageIds = "missingDescription" | "noReactNamespace"

const JSDOC_CONTENT_RE = /\S/

function isExcludedFile(filename: string): boolean {
    return /\.(test|spec|stories)\.[jt]sx?$/.test(filename.replace(/\\/g, "/"))
}

function hasJsDocAbove(
    sourceCode: TSESLint.SourceCode,
    node: TSESTree.Node
): boolean {
    const statement = getContainingStatement(node)
    const target = statement ?? node

    const comments = sourceCode.getCommentsBefore(target)
    if (comments.length === 0) return false

    const lastComment = comments[comments.length - 1]
    if (lastComment.type !== "Block") return false

    const value = lastComment.value
    if (!value.startsWith("*")) return false

    const content = value
        .replace(/^\*+/, "")
        .replace(/\*+$/, "")
        .replace(/^\s*\*\s?/gm, "")
        .trim()

    return JSDOC_CONTENT_RE.test(content)
}

function getContainingStatement(
    node: TSESTree.Node
): TSESTree.ExpressionStatement | null {
    let current: TSESTree.Node | undefined = node.parent
    while (current) {
        if (current.type === "ExpressionStatement") return current
        current = current.parent
    }
    return null
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "enforce useEffect best practices: require JSDoc comments and " +
                "ban the `React.useEffect` namespace form"
        },
        messages: {
            missingDescription:
                "Every `useEffect` must have a JSDoc comment (`/** ... */`) " +
                "above it describing its purpose.",
            noReactNamespace:
                "Use `useEffect` directly instead of `React.useEffect`. " +
                "Import `useEffect` from 'react'."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        if (isExcludedFile(context.filename)) return {}

        return {
            CallExpression(node) {
                if (
                    node.callee.type === "MemberExpression" &&
                    node.callee.object.type === "Identifier" &&
                    node.callee.object.name === "React" &&
                    node.callee.property.type === "Identifier" &&
                    node.callee.property.name === "useEffect"
                ) {
                    context.report({ node, messageId: "noReactNamespace" })
                    return
                }

                if (
                    node.callee.type !== "Identifier" ||
                    node.callee.name !== "useEffect"
                )
                    return

                if (!hasJsDocAbove(context.sourceCode, node))
                    context.report({ node, messageId: "missingDescription" })
            }
        }
    }
}

export default rule
