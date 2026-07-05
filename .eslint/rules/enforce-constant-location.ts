import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"

type IMessageIds = "constantOutsideConstantsFolder" | "missingScreamingSnakeCase" | "missingAsConst"

const SCREAMING_SNAKE_CASE_RE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/

function isConstantsFile(filename: string): boolean {
    return filename.replace(/\\/g, "/").includes("/constants/")
}

function isModuleScopedConst(node: TSESTree.VariableDeclarator): boolean {
    const decl = node.parent
    if (decl.type !== AST_NODE_TYPES.VariableDeclaration) return false
    if (decl.kind !== "const") return false

    const parent = decl.parent
    if (parent.type === AST_NODE_TYPES.Program) return true
    if (parent.type === AST_NODE_TYPES.ExportNamedDeclaration && parent.declaration === decl) return true

    return false
}

function unwrapTSWrappers(node: TSESTree.Expression): TSESTree.Expression {
    if (
        node.type === AST_NODE_TYPES.TSAsExpression ||
        node.type === AST_NODE_TYPES.TSSatisfiesExpression ||
        node.type === AST_NODE_TYPES.TSNonNullExpression ||
        node.type === AST_NODE_TYPES.TSTypeAssertion
    )
        return unwrapTSWrappers(node.expression)

    return node
}

function hasAsConst(node: TSESTree.Expression): boolean {
    if (node.type === AST_NODE_TYPES.TSAsExpression) {
        const typeAnn = node.typeAnnotation
        if (
            typeAnn.type === AST_NODE_TYPES.TSTypeReference &&
            typeAnn.typeName.type === AST_NODE_TYPES.Identifier &&
            typeAnn.typeName.name === "const"
        )
            return true

        return hasAsConst(node.expression)
    }

    if (node.type === AST_NODE_TYPES.TSTypeAssertion) {
        const typeAnn = node.typeAnnotation
        if (
            typeAnn.type === AST_NODE_TYPES.TSTypeReference &&
            typeAnn.typeName.type === AST_NODE_TYPES.Identifier &&
            typeAnn.typeName.name === "const"
        )
            return true

        return hasAsConst(node.expression)
    }

    return false
}

function isPlainValue(node: TSESTree.Expression): boolean {
    const unwrapped = unwrapTSWrappers(node)

    // Allowlist: only flag node types that are clearly static constants.
    // Computed values (BinaryExpression, LogicalExpression, ConditionalExpression,
    // MemberExpression, etc.) depend on runtime identifiers and must not be flagged.
    switch (unwrapped.type) {
        case AST_NODE_TYPES.ObjectExpression:
        case AST_NODE_TYPES.ArrayExpression:
        case AST_NODE_TYPES.Literal:
        case AST_NODE_TYPES.TemplateLiteral:
        case AST_NODE_TYPES.UnaryExpression:
        case AST_NODE_TYPES.Identifier: // covers `undefined`
            return true
        default:
            return false
    }
}

/**
 * Returns true for primitive literal values (string, number, null, undefined,
 * negative numbers, and no-expression template literals) that must be named in
 * SCREAMING_SNAKE_CASE and annotated with `as const`.
 *
 * Intentional asymmetry with `isPlainValue`:
 * - `isPlainValue` returns true for ALL Literal nodes, including booleans and
 *   bigints, so that they are still required to live in a `./constants/` folder.
 * - `isPrimitiveValue` intentionally excludes booleans and bigints because
 *   `as const` on them provides no practical narrowing benefit (`true as const`
 *   is already type `true`), and SCREAMING_SNAKE_CASE is not conventionally
 *   applied to boolean flags (`isEnabled`, `HAS_FEATURE`, etc. are both common).
 *   This means booleans and bigints in a constants file have no additional
 *   naming or annotation requirements beyond living in `./constants/`.
 */
function isPrimitiveValue(node: TSESTree.Expression): boolean {
    const unwrapped = unwrapTSWrappers(node)

    if (unwrapped.type === AST_NODE_TYPES.Literal) {
        if (unwrapped.value === null) return true
        if (typeof unwrapped.value === "string") return true
        if (typeof unwrapped.value === "number") return true
        // booleans and bigints are excluded — see JSDoc above
        return false
    }

    if (unwrapped.type === AST_NODE_TYPES.Identifier && unwrapped.name === "undefined") return true

    if (
        unwrapped.type === AST_NODE_TYPES.UnaryExpression &&
        unwrapped.operator === "-" &&
        unwrapped.argument.type === AST_NODE_TYPES.Literal &&
        typeof unwrapped.argument.value === "number"
    )
        return true

    if (unwrapped.type === AST_NODE_TYPES.TemplateLiteral && unwrapped.expressions.length === 0) return true

    return false
}

function toScreamingSnakeCase(name: string): string {
    return name
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
        .toUpperCase()
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "enforce that module-scope plain constant values " +
                "live in `./constants` folders and that primitive " +
                "constants use SCREAMING_SNAKE_CASE with `as const`"
        },
        messages: {
            constantOutsideConstantsFolder:
                'Constant "{{ name }}" must live in a local `./constants` file. ' +
                "Move module-scope plain values out of component and hook entry files.",
            missingScreamingSnakeCase:
                'Primitive constant "{{ name }}" must use SCREAMING_SNAKE_CASE ' + "(e.g. `{{ suggested }}`).",
            missingAsConst: 'Primitive constant "{{ name }}" must use an `as const` assertion.'
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        const inConstantsFolder = isConstantsFile(context.filename)

        return {
            VariableDeclarator(node: TSESTree.VariableDeclarator) {
                if (node.id.type !== AST_NODE_TYPES.Identifier) return
                if (!node.init) return
                if (!isModuleScopedConst(node)) return
                if (!isPlainValue(node.init)) return

                const name = node.id.name

                if (!inConstantsFolder)
                    context.report({
                        node: node.id,
                        messageId: "constantOutsideConstantsFolder",
                        data: { name }
                    })

                if (isPrimitiveValue(node.init)) {
                    if (!SCREAMING_SNAKE_CASE_RE.test(name))
                        context.report({
                            node: node.id,
                            messageId: "missingScreamingSnakeCase",
                            data: { name, suggested: toScreamingSnakeCase(name) }
                        })

                    if (!hasAsConst(node.init))
                        context.report({
                            node: node.id,
                            messageId: "missingAsConst",
                            data: { name }
                        })
                }
            }
        }
    }
}

export default rule
