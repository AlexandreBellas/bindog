import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"
import { visitorKeys } from "@typescript-eslint/visitor-keys"

type IMessageIds = "plainFunctionMustBeInUtils" | "plainAnonymousFunctionMustBeInUtils"

const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/
const HOOK_NAME_RE = /^use[A-Z]/

function isUtilsFile(filename: string): boolean {
    return filename.replace(/\\/g, "/").includes("/utils/")
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

function hasTypePredicateReturn(
    node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression
): boolean {
    if (!node.returnType) return false
    return node.returnType.typeAnnotation.type === AST_NODE_TYPES.TSTypePredicate
}

function unwrapReactWrapper(
    node: TSESTree.Expression
): TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | null {
    if (
        node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
        node.type === AST_NODE_TYPES.FunctionExpression
    )
        return node

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
            )
                return firstArg

            if (firstArg.type === AST_NODE_TYPES.CallExpression) return unwrapReactWrapper(firstArg)
        }
    }

    return null
}

function isFunctionNode(
    node: TSESTree.Node
): node is TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression {
    return (
        node.type === AST_NODE_TYPES.FunctionDeclaration ||
        node.type === AST_NODE_TYPES.FunctionExpression ||
        node.type === AST_NODE_TYPES.ArrowFunctionExpression
    )
}

function isAstNode(value: unknown): value is TSESTree.Node {
    return value !== null && typeof value === "object" && "type" in value
}

function hasJsxNodeAnywhere(node: TSESTree.Node): boolean {
    if (node.type === AST_NODE_TYPES.JSXElement || node.type === AST_NODE_TYPES.JSXFragment) return true

    if (
        node.type === AST_NODE_TYPES.FunctionDeclaration ||
        node.type === AST_NODE_TYPES.FunctionExpression ||
        node.type === AST_NODE_TYPES.ArrowFunctionExpression
    )
        return false

    const keys = visitorKeys[node.type]
    if (!keys) return false

    for (const key of keys) {
        const value: unknown = Reflect.get(node, key)
        if (value === null || value === undefined) continue

        if (Array.isArray(value)) {
            if (value.some(child => isAstNode(child) && hasJsxNodeAnywhere(child))) return true
        } else if (isAstNode(value)) {
            if (hasJsxNodeAnywhere(value)) return true
        }
    }

    return false
}

function containsJsxInFunctionBody(
    fnNode: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression
): boolean {
    if (fnNode.type === AST_NODE_TYPES.ArrowFunctionExpression) {
        if (fnNode.body.type === AST_NODE_TYPES.JSXElement || fnNode.body.type === AST_NODE_TYPES.JSXFragment)
            return true

        if (fnNode.body.type === AST_NODE_TYPES.BlockStatement)
            return hasJsxNodeAnywhere(fnNode.body)

        return false
    }

    if (
        fnNode.type === AST_NODE_TYPES.FunctionExpression ||
        fnNode.type === AST_NODE_TYPES.FunctionDeclaration
    ) {
        if (fnNode.body.type !== AST_NODE_TYPES.BlockStatement) return false

        return hasJsxNodeAnywhere(fnNode.body)
    }

    return false
}

function isMemoOrForwardRefCall(node: TSESTree.CallExpression): boolean {
    const callee = node.callee
    if (callee.type === AST_NODE_TYPES.Identifier)
        return callee.name === "forwardRef" || callee.name === "memo"

    if (
        callee.type === AST_NODE_TYPES.MemberExpression &&
        callee.object.type === AST_NODE_TYPES.Identifier &&
        callee.object.name === "React" &&
        callee.property.type === AST_NODE_TYPES.Identifier
    )
        return callee.property.name === "forwardRef" || callee.property.name === "memo"

    return false
}

function isRootFunctionExpressionOrArrow(
    fnNode: TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression
): boolean {
    const parent = fnNode.parent

    if (parent.type === AST_NODE_TYPES.ExportDefaultDeclaration)
        return containsJsxInFunctionBody(fnNode)

    if (parent.type === AST_NODE_TYPES.CallExpression && parent.arguments[0] === fnNode)
        if (isMemoOrForwardRefCall(parent)) return true

    if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier) {
        if (!isReactTarget(parent.id.name) || !parent.init) return false

        return unwrapReactWrapper(parent.init) === fnNode
    }

    return false
}

function isRootReactFunction(
    fnNode: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression
): boolean {
    if (fnNode.type === AST_NODE_TYPES.FunctionDeclaration) {
        const parent = fnNode.parent
        if (parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
            if (!fnNode.id) return containsJsxInFunctionBody(fnNode)

            return isReactTarget(fnNode.id.name)
        }

        if (!fnNode.id) return false

        return isReactTarget(fnNode.id.name)
    }

    if (
        fnNode.type === AST_NODE_TYPES.ArrowFunctionExpression ||
        fnNode.type === AST_NODE_TYPES.FunctionExpression
    )
        return isRootFunctionExpressionOrArrow(fnNode)

    return false
}

function isInsideRootReactSubtree(
    fnNode: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression
): boolean {
    let current: TSESTree.Node | undefined = fnNode.parent

    while (current && current.type !== AST_NODE_TYPES.Program) {
        if (isFunctionNode(current) && isRootReactFunction(current)) return true

        current = current.parent
    }

    return false
}

function shouldReportFunction(
    fnNode: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression
): boolean {
    if (hasTypePredicateReturn(fnNode)) return false
    if (isRootReactFunction(fnNode)) return false
    if (isInsideRootReactSubtree(fnNode)) return false

    return true
}

function isModuleScopedFunctionDeclaration(node: TSESTree.FunctionDeclaration): boolean {
    const parent = node.parent
    if (parent.type === AST_NODE_TYPES.Program) return true
    if (parent.type === AST_NODE_TYPES.ExportNamedDeclaration) return true
    if (parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) return true

    return false
}

function isModuleScopedVariableDeclarator(node: TSESTree.VariableDeclarator): boolean {
    const decl = node.parent
    if (decl.type !== AST_NODE_TYPES.VariableDeclaration) return false

    const parent = decl.parent
    if (parent.type === AST_NODE_TYPES.Program) return true
    if (parent.type === AST_NODE_TYPES.ExportNamedDeclaration && parent.declaration === decl) return true

    return false
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "require plain helper functions in component and hook files " +
                "to live in local `./utils` folders instead of module scope"
        },
        messages: {
            plainFunctionMustBeInUtils:
                'Plain helper "{{ name }}" must live in a local `./utils` file. ' +
                "Extract module-scope helpers out of component and hook entry files.",
            plainAnonymousFunctionMustBeInUtils:
                "This plain helper function must live in a local `./utils` file. " +
                "Extract module-scope helpers out of component and hook entry files."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        if (isUtilsFile(context.filename)) return {}

        return {
            ExportDefaultDeclaration(node: TSESTree.ExportDefaultDeclaration) {
                const decl = node.declaration
                if (!decl) return

                if (
                    decl.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
                    decl.type !== AST_NODE_TYPES.FunctionExpression
                )
                    return

                if (!shouldReportFunction(decl)) return

                context.report({ node: decl, messageId: "plainAnonymousFunctionMustBeInUtils" })
            },
            FunctionDeclaration(node: TSESTree.FunctionDeclaration) {
                if (!isModuleScopedFunctionDeclaration(node)) return
                if (!shouldReportFunction(node)) return

                if (node.id)
                    context.report({
                        node: node.id,
                        messageId: "plainFunctionMustBeInUtils",
                        data: { name: node.id.name }
                    })
                else context.report({ node, messageId: "plainAnonymousFunctionMustBeInUtils" })
            },
            VariableDeclarator(node: TSESTree.VariableDeclarator) {
                if (node.id.type !== AST_NODE_TYPES.Identifier) return
                if (!node.init) return

                if (
                    node.init.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
                    node.init.type !== AST_NODE_TYPES.FunctionExpression
                )
                    return

                if (!isModuleScopedVariableDeclarator(node)) return

                if (!shouldReportFunction(node.init)) return

                context.report({
                    node: node.id,
                    messageId: "plainFunctionMustBeInUtils",
                    data: { name: node.id.name }
                })
            }
        }
    }
}

export default rule
