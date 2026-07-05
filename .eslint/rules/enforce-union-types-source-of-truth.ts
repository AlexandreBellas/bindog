import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"

type IMessageIds =
    | "missingIPrefix"
    | "notUsingTypeofIndexedAccess"
    | "missingConstArrayAbove"
    | "missingConstSetAbove"
    | "constArrayNameMismatch"
    | "constArrayNameConventionViolation"
    | "constArrayNotAsConst"
    | "constArrayNotStringLiteralArray"
    | "constSetNotAsConst"
    | "constSetNotStringLiteralArray"
    | "missingPascalCaseConstBelow"
    | "pascalCaseConstNotObjectLiteral"
    | "pascalCaseConstMissingAsConstSatisfies"
    | "pascalCaseConstInvalidEntries"

const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/

function isPascalCase(name: string): boolean {
    return PASCAL_CASE_RE.test(name)
}

/**
 * Converts a delimited string into `PascalCase`. Mirrors the runtime behaviour
 * expected from the `IKeyable<T>` utility type used at the type level.
 * Splits on `_` (snake_case) and `-` (kebab-case).
 *
 * Examples:
 *   valueToPascalCaseKey("bar_chart")      -> "BarChart"
 *   valueToPascalCaseKey("stacked_bar")    -> "StackedBar"
 *   valueToPascalCaseKey("pre-generation") -> "PreGeneration"
 *   valueToPascalCaseKey("crosstab")       -> "Crosstab"
 */
function valueToPascalCaseKey(value: string): string {
    return value
        .split(/[-_]/)
        .map(part => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
        .join("")
}

/**
 * Returns the statement node that should be considered the "outer" sibling for
 * adjacency checks. An `export` keyword wraps the underlying declaration in an
 * `ExportNamedDeclaration`; in that case we treat the export node as the
 * sibling so that adjacency is computed against the body of the program.
 */
function getOuterStatement(node: TSESTree.TSTypeAliasDeclaration | TSESTree.VariableDeclaration): TSESTree.Node {
    if (node.parent && node.parent.type === AST_NODE_TYPES.ExportNamedDeclaration) return node.parent
    return node
}

/**
 * Unwraps a sibling statement to a `VariableDeclaration`, if it represents a
 * variable declaration possibly wrapped in `export`. Returns null otherwise.
 */
function unwrapVariableDeclaration(node: TSESTree.Node | undefined): TSESTree.VariableDeclaration | null {
    if (!node) return null
    if (node.type === AST_NODE_TYPES.VariableDeclaration) return node
    if (
        node.type === AST_NODE_TYPES.ExportNamedDeclaration &&
        node.declaration &&
        node.declaration.type === AST_NODE_TYPES.VariableDeclaration
    )
        return node.declaration

    return null
}

/**
 * Returns the array of sibling statements that contains the given node when
 * treating it as a top-level (or namespace-level) statement. Supports
 * `Program` and `TSModuleBlock` (the body of `namespace { ... }` / `module
 * "..." { ... }`). Returns null when the node is nested deeper (e.g. inside a
 * function body), in which case the rule does not apply.
 */
function getSiblingStatements(node: TSESTree.Node): readonly TSESTree.Node[] | null {
    const parent = node.parent
    if (!parent) return null
    if (parent.type === AST_NODE_TYPES.Program) return parent.body
    if (parent.type === AST_NODE_TYPES.TSModuleBlock) return parent.body
    return null
}

/**
 * Returns true when the given type node is `(typeof Identifier)[number]`.
 */
function getTypeofIndexedAccessTarget(typeNode: TSESTree.TypeNode): string | null {
    if (typeNode.type !== AST_NODE_TYPES.TSIndexedAccessType) return null

    const { objectType, indexType } = typeNode

    if (objectType.type !== AST_NODE_TYPES.TSTypeQuery) return null
    if (objectType.exprName.type !== AST_NODE_TYPES.Identifier) return null

    if (indexType.type !== AST_NODE_TYPES.TSNumberKeyword) return null

    return objectType.exprName.name
}

/**
 * Returns true when the given type node is a union of two or more string
 * literal types (and ONLY string literal types). Mixed unions or unions of
 * other kinds return false.
 */
function isStringLiteralUnion(typeNode: TSESTree.TypeNode): boolean {
    if (typeNode.type !== AST_NODE_TYPES.TSUnionType) return false
    if (typeNode.types.length < 2) return false

    return typeNode.types.every(
        member =>
            member.type === AST_NODE_TYPES.TSLiteralType &&
            member.literal.type === AST_NODE_TYPES.Literal &&
            typeof member.literal.value === "string"
    )
}

/**
 * Returns the identifier name when the type node is `ISetValues<typeof Identifier>`,
 * or null otherwise.
 */
function getISetValuesTarget(typeNode: TSESTree.TypeNode): string | null {
    if (typeNode.type !== AST_NODE_TYPES.TSTypeReference) return null
    if (typeNode.typeName.type !== AST_NODE_TYPES.Identifier) return null
    if (typeNode.typeName.name !== "ISetValues") return null
    if (!typeNode.typeArguments || typeNode.typeArguments.params.length !== 1) return null

    const arg = typeNode.typeArguments.params[0]
    if (arg.type !== AST_NODE_TYPES.TSTypeQuery) return null
    if (arg.exprName.type !== AST_NODE_TYPES.Identifier) return null

    return arg.exprName.name
}

/**
 * Detects whether a `TSTypeAliasDeclaration` is one we must validate. Returns
 * the kind of the declared type, or null if the alias is unrelated.
 */
function getCandidateKind(
    typeNode: TSESTree.TypeNode
):
    | { kind: "indexed-access"; targetName: string }
    | { kind: "set-values"; targetName: string }
    | { kind: "raw-union" }
    | null {
    const indexedTarget = getTypeofIndexedAccessTarget(typeNode)
    if (indexedTarget !== null) return { kind: "indexed-access", targetName: indexedTarget }

    const setTarget = getISetValuesTarget(typeNode)
    if (setTarget !== null) return { kind: "set-values", targetName: setTarget }

    if (isStringLiteralUnion(typeNode)) return { kind: "raw-union" }
    return null
}

/**
 * Given the variable declaration that should hold the source-of-truth array
 * for a string union, returns the declarator with name `expectedName`, or null
 * if not present.
 */
function findDeclaratorByName(
    decl: TSESTree.VariableDeclaration,
    expectedName: string
): TSESTree.VariableDeclarator | null {
    for (const declarator of decl.declarations) {
        if (declarator.id.type !== AST_NODE_TYPES.Identifier) continue
        if (declarator.id.name === expectedName) return declarator
    }
    return null
}

function unwrapAsConst(node: TSESTree.Expression): { expression: TSESTree.Expression; hasAsConst: boolean } {
    let inner: TSESTree.Expression = node

    if (inner.type === AST_NODE_TYPES.TSSatisfiesExpression) inner = inner.expression

    if (inner.type === AST_NODE_TYPES.TSAsExpression) {
        const typeAnn = inner.typeAnnotation
        if (
            typeAnn.type === AST_NODE_TYPES.TSTypeReference &&
            typeAnn.typeName.type === AST_NODE_TYPES.Identifier &&
            typeAnn.typeName.name === "const"
        )
            return { expression: inner.expression, hasAsConst: true }
    }
    return { expression: inner, hasAsConst: false }
}

/**
 * Returns true when the expression is a valid source-of-truth array. Every
 * element must be one of:
 *   - a string literal  (`"foo"`)
 *   - a spread of a plain identifier (`...otherConst`)
 *
 * This covers pure-literal arrays, pure-spread compositions, and the
 * partially-composed pattern where own literals are mixed with spreads of
 * previously-declared constants.
 */
function isValidSourceOfTruthArray(node: TSESTree.Expression): boolean {
    if (node.type !== AST_NODE_TYPES.ArrayExpression) return false
    if (node.elements.length === 0) return false

    return node.elements.every(element => {
        if (!element) return false
        if (element.type === AST_NODE_TYPES.Literal && typeof element.value === "string") return true
        if (element.type === AST_NODE_TYPES.SpreadElement && element.argument.type === AST_NODE_TYPES.Identifier)
            return true
        return false
    })
}

/**
 * Returns true when every element in the array is a spread of a plain
 * identifier (i.e. no own string literals). In this case the Set is composed
 * purely from other const arrays, so an `as const` assertion is not needed
 * because literal types are already carried by the spread sources.
 */
function isPureSpreadArray(node: TSESTree.Expression): boolean {
    if (node.type !== AST_NODE_TYPES.ArrayExpression) return false
    if (node.elements.length === 0) return false

    return node.elements.every(
        el => el !== null && el.type === AST_NODE_TYPES.SpreadElement && el.argument.type === AST_NODE_TYPES.Identifier
    )
}

/**
 * Returns structural information about a `new Set(...)` expression used as a
 * source-of-truth for a string union.
 *
 * - `valid` — callee is `Set`, single argument, inner array contains only
 *   string literals and/or identifier spreads.
 * - `hasAsConst` — the inner array argument carries an `as const` assertion.
 * - `isPureSpread` — every element of the inner array is a spread of an
 *   identifier (no own string literals). When true, `as const` is optional
 *   because literal types flow in from the spread sources.
 */
function inspectSourceOfTruthSet(node: TSESTree.Expression): {
    valid: boolean
    hasAsConst: boolean
    isPureSpread: boolean
} {
    const fallback = { valid: false, hasAsConst: false, isPureSpread: false }
    if (node.type !== AST_NODE_TYPES.NewExpression) return fallback
    if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== "Set") return fallback
    if (node.arguments.length !== 1) return fallback

    const arg = node.arguments[0]
    if (!arg) return fallback
    if (arg.type === AST_NODE_TYPES.SpreadElement) return fallback

    const { expression, hasAsConst } = unwrapAsConst(arg)
    return { valid: isValidSourceOfTruthArray(expression), hasAsConst, isPureSpread: isPureSpreadArray(expression) }
}

interface IPascalCaseConstShape {
    isObjectLiteral: boolean
    hasAsConstSatisfies: boolean
    entries: { key: string; value: string }[] | null
    isComposedFromConstants: boolean
}

/**
 * Inspects the right-hand side expression of the PascalCase const declarator
 * and reports its structural properties. The expected shape is:
 *
 *   { Key1: "value1", Key2: "value2" } as const
 *       satisfies Record<IKeyable<T>, T>
 *
 * - `isObjectLiteral` is true when the inner value (after unwrapping
 *   `as const satisfies ...`) is an object literal.
 * - `hasAsConstSatisfies` is true when both `as const` and `satisfies
 *   Record<IKeyable<T>, T>` are present (and `T` matches the type
 *   alias name).
 * - `entries` is the list of object-literal entries when their keys are plain
 *   identifiers (or string literals) and values are plain string literals.
 *   Null when any entry is malformed (computed key, spread, method, etc.).
 */
function inspectPascalCaseConstShape(expression: TSESTree.Expression, typeAliasName: string): IPascalCaseConstShape {
    const result: IPascalCaseConstShape = {
        isObjectLiteral: false,
        hasAsConstSatisfies: false,
        entries: null,
        isComposedFromConstants: false
    }

    let inner = expression
    let foundAsConst = false
    let foundSatisfies = false

    if (inner.type === AST_NODE_TYPES.TSSatisfiesExpression) {
        if (isExpectedSatisfiesAnnotation(inner.typeAnnotation, typeAliasName)) foundSatisfies = true
        inner = inner.expression
    }

    if (inner.type === AST_NODE_TYPES.TSAsExpression) {
        const typeAnn = inner.typeAnnotation
        if (
            typeAnn.type === AST_NODE_TYPES.TSTypeReference &&
            typeAnn.typeName.type === AST_NODE_TYPES.Identifier &&
            typeAnn.typeName.name === "const"
        )
            foundAsConst = true
        inner = inner.expression
    }

    result.hasAsConstSatisfies = foundAsConst && foundSatisfies

    if (inner.type !== AST_NODE_TYPES.ObjectExpression) return result

    result.isObjectLiteral = true

    const entries: { key: string; value: string }[] = []
    for (const property of inner.properties) {
        if (property.type === AST_NODE_TYPES.SpreadElement) {
            if (property.argument.type !== AST_NODE_TYPES.Identifier) return result
            result.isComposedFromConstants = true
            continue
        }

        if (property.type !== AST_NODE_TYPES.Property) return result
        if (property.computed) return result
        if (property.method) return result
        if (property.shorthand) return result

        let keyName: string | null = null
        if (property.key.type === AST_NODE_TYPES.Identifier) keyName = property.key.name
        else if (property.key.type === AST_NODE_TYPES.Literal && typeof property.key.value === "string")
            keyName = property.key.value

        if (keyName === null) return result

        if (property.value.type !== AST_NODE_TYPES.Literal) return result
        if (typeof property.value.value !== "string") return result

        entries.push({ key: keyName, value: property.value.value })
    }
    result.entries = entries

    return result
}

/**
 * Returns true when the given type annotation is exactly
 * `Record<IKeyable<T>, T>` where `T` matches `expectedTypeName`.
 */
function isExpectedSatisfiesAnnotation(typeNode: TSESTree.TypeNode, expectedTypeName: string): boolean {
    if (typeNode.type !== AST_NODE_TYPES.TSTypeReference) return false
    if (typeNode.typeName.type !== AST_NODE_TYPES.Identifier) return false
    if (typeNode.typeName.name !== "Record") return false
    if (!typeNode.typeArguments || typeNode.typeArguments.params.length !== 2) return false

    const [keyArg, valueArg] = typeNode.typeArguments.params

    if (keyArg.type !== AST_NODE_TYPES.TSTypeReference) return false
    if (keyArg.typeName.type !== AST_NODE_TYPES.Identifier) return false
    if (keyArg.typeName.name !== "IKeyable") return false
    if (!keyArg.typeArguments || keyArg.typeArguments.params.length !== 1) return false

    const innerKey = keyArg.typeArguments.params[0]
    if (innerKey.type !== AST_NODE_TYPES.TSTypeReference) return false
    if (innerKey.typeName.type !== AST_NODE_TYPES.Identifier) return false
    if (innerKey.typeName.name !== expectedTypeName) return false

    if (valueArg.type !== AST_NODE_TYPES.TSTypeReference) return false
    if (valueArg.typeName.type !== AST_NODE_TYPES.Identifier) return false
    if (valueArg.typeName.name !== expectedTypeName) return false

    return true
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "enforce that string literal union types are derived from a " +
                "const array source of truth and paired with a PascalCase " +
                "const value mapping"
        },
        messages: {
            missingIPrefix:
                'Union type "{{ name }}" must be named with the "I" prefix ' +
                'followed by PascalCase (e.g. "I{{ name }}").',
            notUsingTypeofIndexedAccess:
                'Union type "{{ name }}" must be derived from a `const` source of truth using ' +
                "either `(typeof <arr>)[number]` (array) or `ISetValues<typeof <set>>` (Set).",
            missingConstArrayAbove:
                'Union type "{{ name }}" must be preceded immediately by a ' +
                "`const {{ expected }} = [...] as const` declaration acting " +
                "as the source of truth.",
            missingConstSetAbove:
                'Union type "{{ name }}" must be preceded immediately by a ' +
                "`const {{ expected }} = new Set([...] as const)` declaration " +
                "acting as the source of truth.",
            constArrayNameMismatch:
                'Union type "{{ name }}" references `typeof {{ referenced }}`, ' +
                "but the immediately preceding declaration is named " +
                '"{{ actual }}". The two names must match.',
            constArrayNameConventionViolation:
                'The source-of-truth array "{{ actual }}" for union type ' +
                '"{{ typeName }}" must be named starting with ' +
                '"{{ expectedPrefix }}" (the camelCase form of "{{ pascalName }}").',
            constArrayNotAsConst:
                'The source-of-truth array "{{ name }}" backing union ' +
                'type "{{ typeName }}" must use an `as const` assertion.',
            constArrayNotStringLiteralArray:
                'The source-of-truth array "{{ name }}" backing union ' +
                'type "{{ typeName }}" must be an array literal of string ' +
                "literals.",
            constSetNotAsConst:
                'The source-of-truth set "{{ name }}" backing union type ' +
                '"{{ typeName }}" must use an `as const` assertion on its inner array ' +
                'when it contains own string literals (e.g. `new Set(["a", ...rest] as const)`). ' +
                "Pure-spread compositions (`new Set([...arr1, ...arr2])`) do not require `as const`.",
            constSetNotStringLiteralArray:
                'The source-of-truth set "{{ name }}" backing union type ' +
                '"{{ typeName }}" must wrap an array literal containing only ' +
                "string literals (and optional spreads of other const identifiers).",
            missingPascalCaseConstBelow:
                'Union type "{{ name }}" must be followed immediately by a ' +
                "`const {{ expected }} = {...} as const satisfies " +
                "Record<IKeyable<{{ name }}>, {{ name }}>` declaration.",
            pascalCaseConstNotObjectLiteral:
                'PascalCase const "{{ name }}" backing union type ' +
                '"{{ typeName }}" must be an object literal mapping ' +
                "PascalCase keys (derived from each union value via `IKeyable`) " +
                "to the union string values.",
            pascalCaseConstMissingAsConstSatisfies:
                'PascalCase const "{{ name }}" backing union type ' +
                '"{{ typeName }}" must end with `as const satisfies ' +
                "Record<IKeyable<{{ typeName }}>, {{ typeName }}>`.",
            pascalCaseConstInvalidEntries:
                'PascalCase const "{{ name }}" backing union type ' +
                '"{{ typeName }}" must contain exactly one entry per ' +
                "union member, with PascalCase keys equal to " +
                "`IKeyable<value>` (e.g. `bar_chart` -> `BarChart`, " +
                "`pre-generation` -> `PreGeneration`) " +
                "and string-literal values."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        return {
            TSTypeAliasDeclaration(node: TSESTree.TSTypeAliasDeclaration) {
                const candidate = getCandidateKind(node.typeAnnotation)
                if (!candidate) return

                const outerStatement = getOuterStatement(node)
                const siblings = getSiblingStatements(outerStatement)
                if (!siblings) return

                const index = siblings.indexOf(outerStatement)
                if (index === -1) return

                const typeName = node.id.name

                if (!typeName.startsWith("I") || typeName.length < 2 || !isPascalCase(typeName.slice(1))) {
                    context.report({
                        node: node.id,
                        messageId: "missingIPrefix",
                        data: { name: typeName }
                    })
                    // Skip downstream checks: they all rely on a stable
                    // PascalCase suffix derived from the type name.
                    return
                }

                const pascalName = typeName.slice(1)

                if (candidate.kind === "raw-union") {
                    context.report({
                        node: node.typeAnnotation,
                        messageId: "notUsingTypeofIndexedAccess",
                        data: { name: typeName }
                    })
                    return
                }

                const referencedName = candidate.targetName

                const expectedPrefix = pascalName[0].toLowerCase() + pascalName.slice(1)
                if (!referencedName.startsWith(expectedPrefix))
                    context.report({
                        node: node.typeAnnotation,
                        messageId: "constArrayNameConventionViolation",
                        data: { typeName, actual: referencedName, expectedPrefix, pascalName }
                    })

                const prevSibling = index > 0 ? siblings[index - 1] : undefined
                const nextSibling = index < siblings.length - 1 ? siblings[index + 1] : undefined

                if (candidate.kind === "set-values")
                    validateConstSetAbove({
                        context,
                        typeName,
                        referencedName,
                        typeNode: node,
                        prevSibling
                    })
                else
                    validateConstArrayAbove({
                        context,
                        typeName,
                        referencedName,
                        typeNode: node,
                        prevSibling
                    })

                validatePascalCaseConstBelow({
                    context,
                    typeName,
                    pascalName,
                    typeNode: node,
                    nextSibling
                })
            }
        }
    }
}

interface IValidateAboveArgs {
    context: Readonly<TSESLint.RuleContext<IMessageIds, []>>
    typeName: string
    referencedName: string
    typeNode: TSESTree.TSTypeAliasDeclaration
    prevSibling: TSESTree.Node | undefined
}

function validateConstArrayAbove(args: IValidateAboveArgs): void {
    const { context, typeName, referencedName, typeNode, prevSibling } = args

    const variableDecl = unwrapVariableDeclaration(prevSibling)
    if (!variableDecl || variableDecl.kind !== "const") {
        context.report({
            node: typeNode.id,
            messageId: "missingConstArrayAbove",
            data: { name: typeName, expected: referencedName }
        })
        return
    }

    if (variableDecl.declarations.length !== 1) {
        context.report({
            node: typeNode.id,
            messageId: "missingConstArrayAbove",
            data: { name: typeName, expected: referencedName }
        })
        return
    }

    const declarator = findDeclaratorByName(variableDecl, referencedName)
    if (!declarator || !declarator.init) {
        const firstDeclarator = variableDecl.declarations[0]
        const actualName = firstDeclarator.id.type === AST_NODE_TYPES.Identifier ? firstDeclarator.id.name : "<unknown>"

        if (actualName === referencedName)
            context.report({
                node: typeNode.id,
                messageId: "missingConstArrayAbove",
                data: { name: typeName, expected: referencedName }
            })
        else
            context.report({
                node: typeNode.id,
                messageId: "constArrayNameMismatch",
                data: { name: typeName, referenced: referencedName, actual: actualName }
            })
        return
    }

    const { expression, hasAsConst } = unwrapAsConst(declarator.init)
    if (!hasAsConst)
        context.report({
            node: declarator,
            messageId: "constArrayNotAsConst",
            data: { name: referencedName, typeName }
        })

    if (!isValidSourceOfTruthArray(expression))
        context.report({
            node: declarator,
            messageId: "constArrayNotStringLiteralArray",
            data: { name: referencedName, typeName }
        })
}

function validateConstSetAbove(args: IValidateAboveArgs): void {
    const { context, typeName, referencedName, typeNode, prevSibling } = args

    const variableDecl = unwrapVariableDeclaration(prevSibling)
    if (!variableDecl || variableDecl.kind !== "const") {
        context.report({
            node: typeNode.id,
            messageId: "missingConstSetAbove",
            data: { name: typeName, expected: referencedName }
        })
        return
    }

    if (variableDecl.declarations.length !== 1) {
        context.report({
            node: typeNode.id,
            messageId: "missingConstSetAbove",
            data: { name: typeName, expected: referencedName }
        })
        return
    }

    const declarator = findDeclaratorByName(variableDecl, referencedName)
    if (!declarator || !declarator.init) {
        const firstDeclarator = variableDecl.declarations[0]
        const actualName = firstDeclarator.id.type === AST_NODE_TYPES.Identifier ? firstDeclarator.id.name : "<unknown>"

        if (actualName === referencedName)
            context.report({
                node: typeNode.id,
                messageId: "missingConstSetAbove",
                data: { name: typeName, expected: referencedName }
            })
        else
            context.report({
                node: typeNode.id,
                messageId: "constArrayNameMismatch",
                data: { name: typeName, referenced: referencedName, actual: actualName }
            })
        return
    }

    const { valid, hasAsConst, isPureSpread } = inspectSourceOfTruthSet(declarator.init)

    if (!hasAsConst && !isPureSpread)
        context.report({
            node: declarator,
            messageId: "constSetNotAsConst",
            data: { name: referencedName, typeName }
        })

    if (!valid)
        context.report({
            node: declarator,
            messageId: "constSetNotStringLiteralArray",
            data: { name: referencedName, typeName }
        })
}

interface IValidateBelowArgs {
    context: Readonly<TSESLint.RuleContext<IMessageIds, []>>
    typeName: string
    pascalName: string
    typeNode: TSESTree.TSTypeAliasDeclaration
    nextSibling: TSESTree.Node | undefined
}

function validatePascalCaseConstBelow(args: IValidateBelowArgs): void {
    const { context, typeName, pascalName, typeNode, nextSibling } = args

    const variableDecl = unwrapVariableDeclaration(nextSibling)
    if (!variableDecl || variableDecl.kind !== "const" || variableDecl.declarations.length !== 1) {
        context.report({
            node: typeNode.id,
            messageId: "missingPascalCaseConstBelow",
            data: { name: typeName, expected: pascalName }
        })
        return
    }

    const declarator = variableDecl.declarations[0]
    if (declarator.id.type !== AST_NODE_TYPES.Identifier || declarator.id.name !== pascalName || !declarator.init) {
        context.report({
            node: typeNode.id,
            messageId: "missingPascalCaseConstBelow",
            data: { name: typeName, expected: pascalName }
        })
        return
    }

    const shape = inspectPascalCaseConstShape(declarator.init, typeName)

    if (!shape.isObjectLiteral) {
        context.report({
            node: declarator,
            messageId: "pascalCaseConstNotObjectLiteral",
            data: { name: pascalName, typeName }
        })
        return
    }

    if (!shape.hasAsConstSatisfies)
        context.report({
            node: declarator,
            messageId: "pascalCaseConstMissingAsConstSatisfies",
            data: { name: pascalName, typeName }
        })

    if (shape.entries === null) {
        context.report({
            node: declarator,
            messageId: "pascalCaseConstInvalidEntries",
            data: { name: pascalName, typeName }
        })
        return
    }

    const seenKeys = new Set<string>()
    const seenValues = new Set<string>()
    let invalid = false
    for (const { key, value } of shape.entries) {
        if (!isPascalCase(key)) {
            invalid = true
            break
        }
        if (key !== valueToPascalCaseKey(value)) {
            invalid = true
            break
        }
        if (seenKeys.has(key) || seenValues.has(value)) {
            invalid = true
            break
        }
        seenKeys.add(key)
        seenValues.add(value)
    }

    if (invalid)
        context.report({
            node: declarator,
            messageId: "pascalCaseConstInvalidEntries",
            data: { name: pascalName, typeName }
        })
}

export default rule
