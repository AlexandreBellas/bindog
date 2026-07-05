import * as parser from "@typescript-eslint/parser"

/**
 * Converts a delimited string to PascalCase. Splits on `_` and `-`.
 * Examples:
 *   "bar_chart"      -> "BarChart"
 *   "pre-generation" -> "PreGeneration"
 *   "red"            -> "Red"
 *   "a_b_c"          -> "ABC"
 */
function snakeToPascalCase(value) {
    return value
        .split(/[-_]/)
        .map(part => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
        .join("")
}

/**
 * Capitalizes the first letter of a string (camelCase -> PascalCase).
 */
function toPascalCase(name) {
    if (!name || name.length === 0) return name
    return name[0].toUpperCase() + name.slice(1)
}

/**
 * Derives a type name (e.g. "IColor") from an array name (e.g. "colors").
 * Mirrors the inverse pluralisation logic in `typeNameToArrayName`:
 *   - If the name ends with "es" AND stripping "es" yields a base that itself
 *     ends with "s" (the pattern used by typeNameToArrayName for bases ending
 *     in "s"), strip "es" to recover the original base (statuses→status,
 *     addresses→address, classes→class, processes→process).
 *   - Otherwise strip a plain trailing "s" (colors→color, layouts→layout).
 *
 * Examples:
 *   "colors"           -> "IColor"
 *   "layouts"          -> "ILayout"
 *   "artefactTypes"    -> "IArtefactType"
 *   "statuses"         -> "IStatus"   (not "IStatuse")
 *   "addresses"        -> "IAddress"  (not "IAddresse")
 *   "classes"          -> "IClass"    (not "IClasse")
 */
function arrayNameToTypeName(arrayName) {
    let base = arrayName
    if (base.length > 3 && base.endsWith("es") && base.slice(0, -2).endsWith("s"))
        base = base.slice(0, -2)
    else if (base.length > 2 && base.endsWith("s"))
        base = base.slice(0, -1)
    return "I" + toPascalCase(base)
}

/**
 * Derives an array name (e.g. "colors") from a type name (e.g. "IColor").
 * Strategy: remove "I" prefix, lowercase first letter, then pluralise:
 *   - If the base already ends with "s" (status, address, class…), append "es"
 *     so the result reads naturally (statuses, addresses, classes).
 *   - Otherwise append plain "s".
 *
 * Examples:
 *   "IColor"   -> "colors"
 *   "IFoo"     -> "foos"
 *   "ILayout"  -> "layouts"
 *   "IStatus"  -> "statuses"   (not "statuss")
 *   "IAddress" -> "addresses"  (not "addresss")
 */
function typeNameToArrayName(typeName) {
    const pascal = typeName.slice(1)
    const camel = pascal[0].toLowerCase() + pascal.slice(1)
    if (camel.endsWith("s")) return camel + "es"
    return camel + "s"
}

/**
 * Unwraps an `as const` (with optional `satisfies`) wrapper.
 * Returns `{ expression, hasAsConst }` so callers can enforce the assertion.
 *
 * Examples:
 *   `["a", "b"] as const`                  -> { expression: ArrayExpression, hasAsConst: true }
 *   `["a", "b"] as const satisfies Foo[]`  -> { expression: ArrayExpression, hasAsConst: true }
 *   `["a", "b"]`                           -> { expression: ArrayExpression, hasAsConst: false }
 */
function unwrapAsConst(node) {
    let inner = node
    if (inner.type === "TSSatisfiesExpression") inner = inner.expression
    if (
        inner.type === "TSAsExpression" &&
        inner.typeAnnotation.type === "TSTypeReference" &&
        inner.typeAnnotation.typeName.type === "Identifier" &&
        inner.typeAnnotation.typeName.name === "const"
    )
        return { expression: inner.expression, hasAsConst: true }

    return { expression: inner, hasAsConst: false }
}

/**
 * Unwraps an ExportNamedDeclaration to get the inner declaration, or returns
 * the node as-is. Returns { decl, isExported }.
 */
function getInnerDeclaration(node) {
    if (node.type === "ExportNamedDeclaration" && node.declaration)
        return { decl: node.declaration, isExported: true }
    return { decl: node, isExported: false }
}

/**
 * Returns info for a const string array declaration:
 *   const foos = ["a", "b"] as const
 *
 * Only handles arrays where ALL elements are plain string literals (no spreads).
 * Returns null if not matched.
 */
function getConstStringArrayInfo(node) {
    const { decl, isExported } = getInnerDeclaration(node)
    if (!decl || decl.type !== "VariableDeclaration" || decl.kind !== "const") return null
    if (decl.declarations.length !== 1) return null

    const declarator = decl.declarations[0]
    if (!declarator || declarator.id.type !== "Identifier") return null
    if (!declarator.init) return null

    const { expression, hasAsConst } = unwrapAsConst(declarator.init)
    if (!hasAsConst) return null
    if (expression.type !== "ArrayExpression") return null
    if (expression.elements.length === 0) return null

    const values = []
    for (const el of expression.elements) {
        if (!el) return null
        if (el.type !== "Literal" || typeof el.value !== "string") return null
        values.push(el.value)
    }

    return { name: declarator.id.name, values, isExported }
}

/**
 * Returns info for a type alias of the form:
 *   type IFoo = (typeof arr)[number]
 *
 * Returns { typeName, arrayName, isExported } or null.
 */
function getDerivedTypeInfo(node) {
    const { decl, isExported } = getInnerDeclaration(node)
    if (!decl || decl.type !== "TSTypeAliasDeclaration") return null

    const typeName = decl.id.name
    const typeNode = decl.typeAnnotation

    if (typeNode.type !== "TSIndexedAccessType") return null
    if (typeNode.objectType.type !== "TSTypeQuery") return null
    if (typeNode.objectType.exprName.type !== "Identifier") return null
    if (typeNode.indexType.type !== "TSNumberKeyword") return null

    return {
        typeName,
        arrayName: typeNode.objectType.exprName.name,
        isExported
    }
}

/**
 * Returns info for a raw string literal union type:
 *   type IFoo = "a" | "b" | "c"
 *
 * Only matches when ALL union members are string literals.
 * Returns { typeName, values, isExported } or null.
 */
function getRawUnionInfo(node) {
    const { decl, isExported } = getInnerDeclaration(node)
    if (!decl || decl.type !== "TSTypeAliasDeclaration") return null

    const typeName = decl.id.name
    const typeNode = decl.typeAnnotation

    if (typeNode.type !== "TSUnionType") return null
    if (typeNode.types.length < 2) return null

    const values = []
    for (const member of typeNode.types) {
        if (member.type !== "TSLiteralType") return null
        if (!member.literal || member.literal.type !== "Literal") return null
        if (typeof member.literal.value !== "string") return null
        values.push(member.literal.value)
    }

    return { typeName, values, isExported }
}

/**
 * Returns the name if the statement is a PascalCase const for the given type,
 * i.e.: const Foo = { ... } where Foo === typeName.slice(1).
 * Returns null if not matched.
 */
function getPascalConstName(node, typeName) {
    const { decl } = getInnerDeclaration(node)
    if (!decl || decl.type !== "VariableDeclaration" || decl.kind !== "const") return null
    if (decl.declarations.length !== 1) return null

    const declarator = decl.declarations[0]
    if (!declarator || declarator.id.type !== "Identifier") return null

    const expectedName = typeName.slice(1)
    if (declarator.id.name !== expectedName) return null

    return expectedName
}

/**
 * Generates a const string array declaration.
 *   const colors = ["red", "blue"] as const
 */
function generateConstArray(arrayName, values, isExported) {
    const exportPrefix = isExported ? "export " : ""
    const valStr = values.map(v => `"${v}"`).join(", ")
    return `${exportPrefix}const ${arrayName} = [${valStr}] as const`
}

/**
 * Generates a derived type declaration.
 *   type IColor = (typeof colors)[number]
 */
function generateDerivedType(typeName, arrayName, isExported) {
    const exportPrefix = isExported ? "export " : ""
    return `${exportPrefix}type ${typeName} = (typeof ${arrayName})[number]`
}

/**
 * Generates a PascalCase const declaration with IKeyable.
 *   const Color = {
 *     Red: "red",
 *     Blue: "blue"
 *   } as const satisfies Record<IKeyable<IColor>, IColor>
 */
function generatePascalConst(typeName, values, isExported) {
    const pascalName = typeName.slice(1)
    const exportPrefix = isExported ? "export " : ""
    const entries = values.map(v => `    ${snakeToPascalCase(v)}: "${v}"`).join(",\n")
    return [
        `${exportPrefix}const ${pascalName} = {`,
        entries,
        `} as const satisfies Record<IKeyable<${typeName}>, ${typeName}>`
    ].join("\n")
}

/**
 * Collects all derived type infos from the program body, keyed by arrayName.
 * Used to detect if an array is already referenced by a type elsewhere.
 */
function buildDerivedTypeMap(statements) {
    const map = new Map()
    for (const stmt of statements) {
        const info = getDerivedTypeInfo(stmt)
        if (info) map.set(info.arrayName, info)
    }
    return map
}

/**
 * Returns true when the source text already imports IKeyable from the
 * canonical utils path, so the plugin doesn't add a duplicate import.
 */
function hasIKeyableImport(text) {
    return text.includes('"@utils/types/keyable"') || text.includes("'@utils/types/keyable'")
}

/**
 * Returns the source position (exclusive end) of the last ImportDeclaration
 * in the statement list, or -1 if there are none.
 */
function findLastImportEnd(statements) {
    let lastEnd = -1
    for (const stmt of statements)
        if (stmt.type === "ImportDeclaration") lastEnd = stmt.range[1]

    return lastEnd
}

/**
 * Main entry point: transform a TypeScript source string so that all
 * const-array / union-type / pascal-const groups are in the canonical
 * three-statement form required by the ESLint rule.
 *
 * Handles three starting states:
 *   1. Const array alone  -> adds derived type + pascal const
 *   2. Raw union type     -> adds const array before, rewrites type, adds pascal const after
 *   3. Const array + derived type (incomplete) -> adds pascal const after
 *
 * Never throws. Returns the input unchanged on parse errors.
 */
export function formatUnionTypes(text) {
    if (typeof text !== "string" || text.length === 0) return text

    let ast
    try {
        ast = parser.parse(text, {
            sourceType: "module",
            ecmaVersion: "latest",
            range: true,
            loc: false,
            comment: false,
            tokens: false,
            jsx: false
        })
    } catch {
        return text
    }

    const statements = ast.body
    if (statements.length === 0) return text

    const derivedTypeMap = buildDerivedTypeMap(statements)
    const edits = []
    const consumed = new Set()

    for (let i = 0; i < statements.length; i++) {
        if (consumed.has(i)) continue

        const stmt = statements[i]

        // --- Case A: const string array ---
        const constInfo = getConstStringArrayInfo(stmt)
        if (constInfo) {
            const nextStmt = i + 1 < statements.length ? statements[i + 1] : null
            const derivedInfo = nextStmt ? getDerivedTypeInfo(nextStmt) : null

            const isImmediatelyFollowedByType =
                derivedInfo !== null && derivedInfo.arrayName === constInfo.name

            if (isImmediatelyFollowedByType) {
                consumed.add(i)
                consumed.add(i + 1)

                const nextNextStmt = i + 2 < statements.length ? statements[i + 2] : null
                const hasPascalConst =
                    nextNextStmt !== null &&
                    getPascalConstName(nextNextStmt, derivedInfo.typeName) !== null

                if (!hasPascalConst) {
                    const isExported = constInfo.isExported || derivedInfo.isExported
                    const newPascalConst = generatePascalConst(
                        derivedInfo.typeName,
                        constInfo.values,
                        isExported
                    )
                    edits.push({
                        start: nextStmt.range[1],
                        end: nextStmt.range[1],
                        text: "\n" + newPascalConst
                    })
                } else {
                    consumed.add(i + 2)
                }
                continue
            }

            // Array is not immediately followed by a derived type referencing it.
            // Only expand if NO derived type elsewhere in the file references it —
            // otherwise the array might just be out of order (ESLint handles that).
            const referencedElsewhere = derivedTypeMap.has(constInfo.name)
            if (!referencedElsewhere) {
                consumed.add(i)
                const typeName = arrayNameToTypeName(constInfo.name)
                const isExported = constInfo.isExported
                const newTypeDecl = generateDerivedType(typeName, constInfo.name, isExported)
                const newPascalConst = generatePascalConst(typeName, constInfo.values, isExported)
                edits.push({
                    start: stmt.range[1],
                    end: stmt.range[1],
                    text: "\n" + newTypeDecl + "\n" + newPascalConst
                })
            }
            continue
        }

        // --- Case B: raw union type ---
        const rawInfo = getRawUnionInfo(stmt)
        if (rawInfo) {
            consumed.add(i)

            const { typeName, values, isExported } = rawInfo
            const arrayName = typeNameToArrayName(typeName)

            // Check if next statement is already a pascal const for this type
            const nextStmt = i + 1 < statements.length ? statements[i + 1] : null
            const hasPascalConstAfter =
                nextStmt !== null && getPascalConstName(nextStmt, typeName) !== null

            const constArrayDecl = generateConstArray(arrayName, values, isExported)
            const newTypeDecl = generateDerivedType(typeName, arrayName, isExported)

            if (hasPascalConstAfter) {
                // Replace raw union with const array + derived type, keep existing pascal const
                consumed.add(i + 1)
                edits.push({
                    start: stmt.range[0],
                    end: stmt.range[1],
                    text: constArrayDecl + "\n" + newTypeDecl
                })
            } else {
                // Replace raw union with const array + derived type + pascal const
                const newPascalConst = generatePascalConst(typeName, values, isExported)
                edits.push({
                    start: stmt.range[0],
                    end: stmt.range[1],
                    text: constArrayDecl + "\n" + newTypeDecl + "\n" + newPascalConst
                })
            }
            continue
        }
    }

    if (edits.length === 0) return text

    // Inject `import { IKeyable } from "@utils/types/keyable"` when the
    // formatter emits any IKeyable reference and the file does not already
    // import it (covers brand-new @types/ files).
    const willEmitIKeyable = edits.some(e => e.text.includes("IKeyable"))
    if (willEmitIKeyable && !hasIKeyableImport(text)) {
        const importDecl = 'import { IKeyable } from "@utils/types/keyable"'
        const lastImportEnd = findLastImportEnd(statements)
        if (lastImportEnd === -1)
            // No imports yet — prepend at the very start of the file.
            edits.push({ start: 0, end: 0, text: importDecl + "\n" })
        else
            // Insert on a new line immediately after the last import.
            edits.push({ start: lastImportEnd, end: lastImportEnd, text: "\n" + importDecl })

    }

    edits.sort((a, b) => b.start - a.start)
    let result = text
    for (const edit of edits)
        result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)

    return result
}
