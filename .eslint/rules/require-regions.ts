import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"

type IMessageIds = "missingRegions"

const REGION_OPEN_RE = /^\s*\/\/\s*#region\s+/
const MIN_LINES_FOR_REGIONS = 100
const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/
const HOOK_NAME_RE = /^use[A-Z]/

function isExcludedFile(filename: string): boolean {
    return /\.(test|spec|stories)\.[jt]sx?$/.test(filename.replace(/\\/g, "/"))
}

function isPascalCase(name: string): boolean {
    return PASCAL_CASE_RE.test(name)
}

function isHookName(name: string): boolean {
    return HOOK_NAME_RE.test(name)
}

function isReactTarget(name: string): boolean {
    return isPascalCase(name) || isHookName(name)
}

function getComponentBody(
    node: TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration | TSESTree.FunctionExpression
): TSESTree.BlockStatement | null {
    if (node.body.type === AST_NODE_TYPES.BlockStatement) return node.body
    return null
}

function getLineCount(node: TSESTree.Node): number {
    return node.loc.end.line - node.loc.start.line + 1
}

function hasRegionComments(
    comments: TSESTree.Comment[],
    bodyStart: number,
    bodyEnd: number
): boolean {
    return comments.some(comment => {
        if (comment.type !== "Line") return false

        const line = comment.loc.start.line
        if (line < bodyStart || line > bodyEnd) return false

        return REGION_OPEN_RE.test(`//${comment.value}`)
    })
}

function unwrapReactWrapper(
    node: TSESTree.Expression
): TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | null {
    if (
        node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
        node.type === AST_NODE_TYPES.FunctionExpression
    ) return node

    if (node.type === AST_NODE_TYPES.CallExpression) {
        const callee = node.callee
        const isNamedCall = callee.type === AST_NODE_TYPES.Identifier
        const isMemberCall =
            callee.type === AST_NODE_TYPES.MemberExpression &&
            callee.object.type === AST_NODE_TYPES.Identifier &&
            callee.property.type === AST_NODE_TYPES.Identifier

        if ((isNamedCall || isMemberCall) && node.arguments.length > 0) {
            const firstArg = node.arguments[0]

            if (
                firstArg.type === AST_NODE_TYPES.ArrowFunctionExpression ||
                firstArg.type === AST_NODE_TYPES.FunctionExpression
            ) return firstArg

            if (firstArg.type === AST_NODE_TYPES.CallExpression)
                return unwrapReactWrapper(firstArg)
        }
    }

    return null
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "require // #region comments in React components " +
                "that are 100 lines or longer"
        },
        messages: {
            missingRegions:
                'Component "{{ name }}" is {{ lineCount }} lines long ' +
                "(≥ {{ threshold }}). Add // #region blocks to " +
                "organize its internal structure."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        if (isExcludedFile(context.filename)) return {}

        function checkComponent(
            name: string,
            fnNode: TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration | TSESTree.FunctionExpression,
            reportNode: TSESTree.Node
        ): void {
            const body = getComponentBody(fnNode)
            if (!body) return

            const lineCount = getLineCount(fnNode)
            if (lineCount < MIN_LINES_FOR_REGIONS) return

            const comments = context.sourceCode.getAllComments()
            if (hasRegionComments(comments, body.loc.start.line, body.loc.end.line)) return

            context.report({
                node: reportNode,
                messageId: "missingRegions",
                data: {
                    name,
                    lineCount: String(lineCount),
                    threshold: String(MIN_LINES_FOR_REGIONS)
                }
            })
        }

        return {
            VariableDeclarator(node: TSESTree.VariableDeclarator) {
                if (node.id.type !== AST_NODE_TYPES.Identifier) return
                if (!isReactTarget(node.id.name)) return
                if (!node.init) return

                const fn = unwrapReactWrapper(node.init)
                if (!fn) return

                checkComponent(node.id.name, fn, node.id)
            },
            FunctionDeclaration(node: TSESTree.FunctionDeclaration) {
                if (!node.id) return
                if (!isReactTarget(node.id.name)) return

                checkComponent(node.id.name, node, node.id)
            }
        }
    }
}

export default rule
