import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"

type IMessageIds =
    | "invalidPropsTypeName"
    | "missingReadonlyWrapper"
    | "paramsInsteadOfProps"
    | "propsInterfaceNotColocated"
type IRuleContext = Readonly<TSESLint.RuleContext<IMessageIds, []>>

const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/
/** Matches React hook naming (`useFoo`, `useURLSearch`). */
const HOOK_NAME_RE = /^use[A-Z][a-zA-Z0-9]*$/

// Matches ESLint glob src/**/hooks/use*.ts — hook module directly under a hooks folder.
const HOOK_USE_TS_PATH_RE = /^src\/(?:[^/]+\/)*hooks\/use[^/]+\.ts$/
// Matches ESLint glob src/**/use*/index.ts — hook barrel (folder name starts with use).
const USE_INDEX_TS_PATH_RE = /^src\/(?:[^/]+\/)*use[^/]*\/index\.ts$/

function isPascalCase(name: string): boolean {
    return PASCAL_CASE_RE.test(name)
}

function isHookIdentifier(name: string): boolean {
    return HOOK_NAME_RE.test(name)
}

/**
 * Normalizes a filename to a forward-slash path starting at `src/`.
 *
 * ESLint passes absolute paths to `context.filename` when run from the CLI or
 * IDE integration. The path regexes in this rule are anchored at `^src/`, so
 * we strip any leading absolute portion by slicing from the last `/src/`
 * segment. Relative paths that already start with `src/` are left untouched.
 * Windows backslashes are converted first so both separators are handled.
 */
function normalizePath(filename: string): string {
    const forwardSlashed = filename.replace(/\\/g, "/")
    const srcIndex = forwardSlashed.lastIndexOf("/src/")
    return srcIndex !== -1 ? forwardSlashed.slice(srcIndex + 1) : forwardSlashed
}

function isTsxFile(filename: string): boolean {
    return normalizePath(filename).endsWith(".tsx")
}

function isHookPropsRuleFile(filename: string): boolean {
    const p = normalizePath(filename)
    return HOOK_USE_TS_PATH_RE.test(p) || USE_INDEX_TS_PATH_RE.test(p)
}

function isExcludedFile(filename: string): boolean {
    return /\.(test|spec|stories)\.[jt]sx?$/.test(normalizePath(filename))
}

/**
 * Inner props interface name: components use `IMyComponentProps`; hooks use
 * `useMyHook` → `IUseMyHookProps`.
 */
function getExpectedInnerPropsTypeName(identifier: string, isHookFile: boolean): string {
    if (!isHookFile) return `I${identifier}Props`

    return `I${identifier.charAt(0).toUpperCase()}${identifier.slice(1)}Props`
}

function shouldProcessBinding(filename: string, name: string): boolean {
    if (isTsxFile(filename)) return isPascalCase(name)
    if (isHookPropsRuleFile(filename)) return isHookIdentifier(name)

    return false
}

function isFunction(node: TSESTree.Node): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression {
    return node.type === AST_NODE_TYPES.ArrowFunctionExpression || node.type === AST_NODE_TYPES.FunctionExpression
}

function matchCall(node: TSESTree.Node, name: string): TSESTree.CallExpression | null {
    if (node.type !== AST_NODE_TYPES.CallExpression) return null

    if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === name) return node

    if (
        node.callee.type === AST_NODE_TYPES.MemberExpression &&
        node.callee.object.type === AST_NODE_TYPES.Identifier &&
        node.callee.object.name === "React" &&
        node.callee.property.type === AST_NODE_TYPES.Identifier &&
        node.callee.property.name === name
    )
        return node

    return null
}

function isReactFCType(node: TSESTree.TSTypeReference): boolean {
    if (node.typeName.type === AST_NODE_TYPES.TSQualifiedName) {
        const { left, right } = node.typeName
        return (
            left.type === AST_NODE_TYPES.Identifier &&
            left.name === "React" &&
            (right.name === "FC" || right.name === "FunctionComponent")
        )
    }
    if (node.typeName.type === AST_NODE_TYPES.Identifier)
        return node.typeName.name === "FC" || node.typeName.name === "FunctionComponent"

    return false
}

function unwrapReadonly(
    node: TSESTree.TypeNode
): { isReadonly: true; inner: TSESTree.TypeNode } | { isReadonly: false; inner: null } {
    if (
        node.type === AST_NODE_TYPES.TSTypeReference &&
        node.typeName.type === AST_NODE_TYPES.Identifier &&
        node.typeName.name === "Readonly" &&
        node.typeArguments?.params.length === 1
    )
        return { isReadonly: true, inner: node.typeArguments.params[0] }

    return { isReadonly: false, inner: null }
}

function extractTypeName(node: TSESTree.TypeNode): string | null {
    if (node.type !== AST_NODE_TYPES.TSTypeReference) return null
    if (node.typeName.type === AST_NODE_TYPES.Identifier) return node.typeName.name
    return null
}

/**
 * Returns true for `React.PropsWithChildren` and bare `PropsWithChildren`.
 * These are acceptable standalone props types for layout/wrapper components
 * that have no custom props interface, and should not trigger `invalidPropsTypeName`.
 */
function isReactPropsWithChildren(node: TSESTree.TypeNode): boolean {
    if (node.type !== AST_NODE_TYPES.TSTypeReference) return false

    if (
        node.typeName.type === AST_NODE_TYPES.TSQualifiedName &&
        node.typeName.left.type === AST_NODE_TYPES.Identifier &&
        node.typeName.left.name === "React" &&
        node.typeName.right.name === "PropsWithChildren"
    )
        return true

    return node.typeName.type === AST_NODE_TYPES.Identifier && node.typeName.name === "PropsWithChildren"
}

/**
 * Reports the appropriate name error for a type that does not match the expected
 * props type name. When the type name ends with "Params", a dedicated
 * `paramsInsteadOfProps` error is reported to guide renaming; otherwise the
 * generic `invalidPropsTypeName` error is reported.
 */
function reportNameError(
    context: IRuleContext,
    symbolName: string,
    expectedInnerPropsType: string,
    typeName: string | null,
    reportNode: TSESTree.Node
): void {
    if (typeName !== null && typeName.endsWith("Params")) {
        context.report({
            node: reportNode,
            messageId: "paramsInsteadOfProps",
            data: { symbolName, expectedInner: expectedInnerPropsType, actual: typeName }
        })
        return
    }

    context.report({
        node: reportNode,
        messageId: "invalidPropsTypeName",
        data: { symbolName, expectedInner: expectedInnerPropsType, actual: typeName ?? "(inline type)" }
    })
}

/**
 * Validates that the props type is `Readonly<{expectedInnerPropsType}>`.
 *
 * When the type is NOT wrapped in `Readonly<>`, two separate errors may fire:
 *  1. `missingReadonlyWrapper` — always reported when Readonly is absent.
 *  2. `invalidPropsTypeName` or `paramsInsteadOfProps` — reported additionally
 *     only when the raw type name also differs from the expected name. If the
 *     raw name IS already correct (e.g. `IMyComponentProps` without Readonly),
 *     we skip the second error to avoid confusing the developer with two
 *     overlapping fixes for the same annotation.
 */
function validatePropsType(
    context: IRuleContext,
    symbolName: string,
    expectedInnerPropsType: string,
    typeNode: TSESTree.TypeNode,
    reportNode: TSESTree.Node,
    allowPropsWithChildren: boolean
): void {
    const { isReadonly, inner } = unwrapReadonly(typeNode)

    if (!isReadonly) {
        // Allow PropsWithChildren without Readonly — it's a known built-in that is
        // acceptable as a standalone props type for layout/wrapper components.
        if (allowPropsWithChildren && isReactPropsWithChildren(typeNode)) return

        context.report({
            node: reportNode,
            messageId: "missingReadonlyWrapper",
            data: { symbolName, expectedInner: expectedInnerPropsType }
        })
        const typeName = extractTypeName(typeNode)
        if (typeName !== expectedInnerPropsType)
            reportNameError(context, symbolName, expectedInnerPropsType, typeName, reportNode)

        return
    }

    // Allow Readonly<PropsWithChildren> — valid for layout/wrapper components.
    if (allowPropsWithChildren && isReactPropsWithChildren(inner)) return

    const typeName = extractTypeName(inner)
    if (typeName !== expectedInnerPropsType)
        reportNameError(context, symbolName, expectedInnerPropsType, typeName, reportNode)
}

function getParamTypeAnnotation(param: TSESTree.Parameter): TSESTree.TSTypeAnnotation | undefined {
    if (param.type === AST_NODE_TYPES.AssignmentPattern) {
        const { left } = param
        if (left.type === AST_NODE_TYPES.ObjectPattern || left.type === AST_NODE_TYPES.Identifier)
            return left.typeAnnotation

        return undefined
    }

    if (param.type === AST_NODE_TYPES.ObjectPattern || param.type === AST_NODE_TYPES.Identifier)
        return param.typeAnnotation

    return undefined
}

function checkFunctionParams(
    context: IRuleContext,
    symbolName: string,
    expectedInnerPropsType: string,
    params: TSESTree.Parameter[],
    reportNode: TSESTree.Node,
    allowPropsWithChildren: boolean
): void {
    if (params.length === 0) return

    const typeAnnotation = getParamTypeAnnotation(params[0])
    if (!typeAnnotation) return

    validatePropsType(
        context,
        symbolName,
        expectedInnerPropsType,
        typeAnnotation.typeAnnotation,
        reportNode,
        allowPropsWithChildren
    )
}

function getInnerFunction(
    call: TSESTree.CallExpression
): TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | null {
    if (call.arguments.length === 0) return null
    const arg = call.arguments[0]
    return isFunction(arg) ? arg : null
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "enforce Readonly<I{Name}Props> for TSX component props and hook option/object params in hook files"
        },
        messages: {
            invalidPropsTypeName:
                '"{{ symbolName }}" props must be typed as Readonly<{{ expectedInner }}> but found "{{ actual }}".',
            missingReadonlyWrapper: '"{{ symbolName }}" props must be wrapped in Readonly<{{ expectedInner }}>.',
            paramsInsteadOfProps:
                '"{{ symbolName }}" props use "{{ actual }}" which ends with "Params" — rename to "{{ expectedInner }}".',
            propsInterfaceNotColocated:
                '"{{ name }}" ends with "Props" and must be defined in the same file as the component or hook ' +
                'that uses it, not in a separate file or "@types" folder.'
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        const { filename } = context

        // Always skip test/spec/stories files for all checks.
        if (isExcludedFile(filename)) return {}

        const isHookFile = isHookPropsRuleFile(filename)
        const isComponentFile = isTsxFile(filename)
        const allowPropsWithChildren = !isHookFile

        const listeners: TSESLint.RuleListener = {}

        // Annotation checks — only for component (.tsx) and hook (.ts) files.
        if (isComponentFile || isHookFile) {
            listeners.FunctionDeclaration = (node: TSESTree.FunctionDeclaration) => {
                if (!node.id || !shouldProcessBinding(filename, node.id.name)) return

                const symbolName = node.id.name
                const expectedInner = getExpectedInnerPropsTypeName(symbolName, isHookFile)
                checkFunctionParams(context, symbolName, expectedInner, node.params, node.id, allowPropsWithChildren)
            }

            listeners.VariableDeclarator = (node: TSESTree.VariableDeclarator) => {
                if (node.id.type !== AST_NODE_TYPES.Identifier) return
                if (!shouldProcessBinding(filename, node.id.name)) return

                const symbolName = node.id.name
                const expectedInner = getExpectedInnerPropsTypeName(symbolName, isHookFile)

                if (node.id.typeAnnotation) {
                    const typeAnn = node.id.typeAnnotation.typeAnnotation
                    if (typeAnn.type === AST_NODE_TYPES.TSTypeReference && isReactFCType(typeAnn)) {
                        if (!typeAnn.typeArguments || typeAnn.typeArguments.params.length === 0) return

                        validatePropsType(
                            context,
                            symbolName,
                            expectedInner,
                            typeAnn.typeArguments.params[0],
                            node.id,
                            allowPropsWithChildren
                        )
                        return
                    }
                    // Non-FC type annotations (e.g. custom types) fall through to
                    // inspect the initializer expression (forwardRef / memo / arrow fn).
                }

                if (!node.init) return

                const forwardRefCall = matchCall(node.init, "forwardRef")
                if (forwardRefCall) {
                    if (forwardRefCall.typeArguments && forwardRefCall.typeArguments.params.length >= 2) {
                        validatePropsType(
                            context,
                            symbolName,
                            expectedInner,
                            forwardRefCall.typeArguments.params[1],
                            node.id,
                            allowPropsWithChildren
                        )
                        return
                    }
                    const inner = getInnerFunction(forwardRefCall)
                    if (inner)
                        checkFunctionParams(
                            context,
                            symbolName,
                            expectedInner,
                            inner.params,
                            node.id,
                            allowPropsWithChildren
                        )

                    return
                }

                const memoCall = matchCall(node.init, "memo")
                if (memoCall) {
                    if (memoCall.arguments.length === 0) return

                    const firstArg = memoCall.arguments[0]
                    const innerFrCall = matchCall(firstArg, "forwardRef")

                    if (innerFrCall) {
                        if (innerFrCall.typeArguments && innerFrCall.typeArguments.params.length >= 2) {
                            validatePropsType(
                                context,
                                symbolName,
                                expectedInner,
                                innerFrCall.typeArguments.params[1],
                                node.id,
                                allowPropsWithChildren
                            )
                            return
                        }
                        const inner = getInnerFunction(innerFrCall)
                        if (inner)
                            checkFunctionParams(
                                context,
                                symbolName,
                                expectedInner,
                                inner.params,
                                node.id,
                                allowPropsWithChildren
                            )

                        return
                    }

                    if (isFunction(firstArg))
                        checkFunctionParams(
                            context,
                            symbolName,
                            expectedInner,
                            firstArg.params,
                            node.id,
                            allowPropsWithChildren
                        )

                    return
                }

                if (isFunction(node.init))
                    checkFunctionParams(
                        context,
                        symbolName,
                        expectedInner,
                        node.init.params,
                        node.id,
                        allowPropsWithChildren
                    )
            }
        }

        // Props colocation check — runs on all non-component, non-hook files.
        // Any interface or type alias ending with "Props" must live in the same
        // component or hook file that uses it, not in "@types" or utility files.
        if (!isComponentFile && !isHookFile) {
            const checkPropsDeclaration = (name: string, node: TSESTree.Node): void => {
                if (!name.endsWith("Props")) return

                context.report({
                    node,
                    messageId: "propsInterfaceNotColocated",
                    data: { name }
                })
            }

            listeners.TSInterfaceDeclaration = (node: TSESTree.TSInterfaceDeclaration) => {
                checkPropsDeclaration(node.id.name, node.id)
            }

            listeners.TSTypeAliasDeclaration = (node: TSESTree.TSTypeAliasDeclaration) => {
                checkPropsDeclaration(node.id.name, node.id)
            }
        }

        return listeners
    }
}

export default rule
