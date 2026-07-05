import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"

type IMessageIds = "noUseContext"

/**
 * Normalises a filesystem path to use forward slashes so comparisons
 * work consistently on every OS.
 */
function normalize(filename: string): string {
    return filename.replace(/\\/g, "/")
}

/**
 * Returns true when the file is an allowed location for useContext.
 *
 * Allowed patterns:
 *   src/ ** /contexts/ ** /index.tsx          — context folder entry point
 *   src/ ** /contexts/ ** /hooks/use*.ts      — dedicated hook file inside a context folder
 *   src/ ** /contexts/ ** Provider.tsx        — flat provider file inside a contexts folder
 */
function isAllowedFile(filename: string): boolean {
    const normalized = normalize(filename)

    // src/**/contexts/**/index.tsx
    if (/\/contexts\/.+\/index\.tsx$/.test(normalized)) return true

    // src/**/contexts/**/hooks/use*.ts
    if (/\/contexts\/.+\/hooks\/use[^/]*\.ts$/.test(normalized)) return true

    // src/**/contexts/**Provider.tsx
    if (/\/contexts\/.*Provider\.tsx$/.test(normalized)) return true

    return false
}

/**
 * Returns true when the call expression is a `useContext(...)` call,
 * covering both `useContext(...)` and `React.useContext(...)`.
 */
function isUseContextCall(node: TSESTree.CallExpression): boolean {
    const { callee } = node

    // useContext(...)
    if (
        callee.type === AST_NODE_TYPES.Identifier &&
        callee.name === "useContext"
    )
        return true

    // React.useContext(...)
    if (
        callee.type === AST_NODE_TYPES.MemberExpression &&
        callee.object.type === AST_NODE_TYPES.Identifier &&
        callee.property.type === AST_NODE_TYPES.Identifier &&
        callee.property.name === "useContext"
    )
        return true

    return false
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "disallow `useContext` calls outside of dedicated context provider files and hooks. " +
                "Allowed locations: `src/**/contexts/*/index.tsx`, " +
                "`src/**/contexts/*/hooks/use*.ts`, and `src/**/contexts/*Provider.tsx`."
        },
        messages: {
            noUseContext:
                "Do not call `useContext` here. " +
                "`useContext` is only allowed inside context provider files " +
                "(`contexts/<Name>/index.tsx`, `contexts/<Name>/hooks/use*.ts`, " +
                "or `contexts/<Name>Provider.tsx`). " +
                "Expose the context value through a custom hook defined in one of those files."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        if (isAllowedFile(context.filename)) return {}

        return {
            CallExpression(node: TSESTree.CallExpression) {
                if (!isUseContextCall(node)) return
                context.report({ node, messageId: "noUseContext" })
            }
        }
    }
}

export default rule
