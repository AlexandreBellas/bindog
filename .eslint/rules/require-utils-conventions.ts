import { parse as parseTS, simpleTraverse } from "@typescript-eslint/typescript-estree"
import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"
import { existsSync, readFileSync } from "node:fs"
import { basename, dirname, extname, join } from "node:path"

type IMessageIds = "missingJsdoc" | "missingJsdocAnonymous" | "missingTestFile" | "missingDescribe" | "emptyDescribe"

type IRuleOptions = [{ minLines?: number }?]

const DEFAULT_MIN_LINES = 10

/**
 * Returns the node whose leading comments should be inspected for a JSDoc.
 *
 * ESLint's `getCommentsBefore` returns comments immediately preceding the
 * first token of the given node.  For exported declarations, that first token
 * belongs to the export wrapper, so we must climb to it:
 *
 * - `export default function() {}` / `export default () => {}`
 *   → anchor is the `ExportDefaultDeclaration`
 * - `export function foo() {}` / `export const foo = () => {}`
 *   → anchor is the `ExportNamedDeclaration`
 * - bare `function foo() {}` / `const foo = () => {}`
 *   → anchor is the `FunctionDeclaration` / `VariableDeclaration` itself
 */
function commentAnchorFor(
    fnNode: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression
): TSESTree.Node {
    const parent = fnNode.parent

    if (parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) return parent

    if (parent.type === AST_NODE_TYPES.ExportNamedDeclaration) return parent

    if (parent.type === AST_NODE_TYPES.VariableDeclarator) {
        const varDecl = parent.parent
        if (varDecl.type === AST_NODE_TYPES.VariableDeclaration) {
            const varDeclParent = varDecl.parent
            if (varDeclParent.type === AST_NODE_TYPES.ExportNamedDeclaration) return varDeclParent
            return varDecl
        }
    }

    return fnNode
}

function hasJsdocComment(
    fnNode: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
    sourceCode: TSESLint.SourceCode
): boolean {
    const anchor = commentAnchorFor(fnNode)
    const comments = sourceCode.getCommentsBefore(anchor)

    if (comments.length === 0) return false

    const last = comments[comments.length - 1]
    return last.type === "Block" && last.value.startsWith("*")
}

function isAnonymousInlineCallback(fnNode: TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression): boolean {
    const parent = fnNode.parent
    return parent.type !== AST_NODE_TYPES.VariableDeclarator && parent.type !== AST_NODE_TYPES.ExportDefaultDeclaration
}

interface IFunctionEntry {
    name: string
    node: TSESTree.Node
}

/**
 * Counts the non-blank lines in a function's source text.
 * Only the function node itself is counted (excludes surrounding
 * `export` keywords, JSDoc comments, and variable declaration wrappers).
 */
function countLogicalLines(
    node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
    sourceCode: TSESLint.SourceCode
): number {
    const text = sourceCode.getText(node)
    return text.split("\n").filter(line => line.trim().length > 0).length
}

/** Returns true only for top-level `export function foo() {}` declarations. */
function isNamedExportFunctionDeclaration(node: TSESTree.FunctionDeclaration): boolean {
    const parent = node.parent
    if (parent.type !== AST_NODE_TYPES.ExportNamedDeclaration) return false
    return parent.parent.type === AST_NODE_TYPES.Program
}

/** Returns true only for top-level `export const foo = () => {}` declarators. */
function isNamedExportVariableDeclarator(node: TSESTree.VariableDeclarator): boolean {
    const varDecl = node.parent
    if (varDecl.type !== AST_NODE_TYPES.VariableDeclaration) return false
    if (varDecl.parent.type !== AST_NODE_TYPES.ExportNamedDeclaration) return false
    return varDecl.parent.parent.type === AST_NODE_TYPES.Program
}

function getTestFilePath(sourceFilePath: string): string {
    const dir = dirname(sourceFilePath)
    const ext = extname(sourceFilePath)
    const base = basename(sourceFilePath, ext)
    return join(dir, `${base}.test${ext}`)
}

function isDescribeCallee(callee: TSESTree.CallExpression["callee"]): boolean {
    if (callee.type === AST_NODE_TYPES.Identifier) return callee.name === "describe"
    if (callee.type === AST_NODE_TYPES.MemberExpression)
        return callee.object.type === AST_NODE_TYPES.Identifier && callee.object.name === "describe"
    return false
}

function isItOrTest(name: string): boolean {
    return name === "it" || name === "test"
}

function isImplementedTestCall(node: TSESTree.Node): boolean {
    if (node.type !== AST_NODE_TYPES.CallExpression) return false
    const { callee, arguments: args } = node
    if (args.length < 2) return false

    // it("name", cb) / test("name", cb)
    if (callee.type === AST_NODE_TYPES.Identifier) return isItOrTest(callee.name)

    // it.skip("name", cb) / it.todo("name") — MemberExpression where object is "it"/"test"
    if (callee.type === AST_NODE_TYPES.MemberExpression)
        return callee.object.type === AST_NODE_TYPES.Identifier && isItOrTest(callee.object.name)

    // it.each([...])("name", cb) / test.each([...])("name", cb)
    // callee is CallExpression(it.each([...]))
    if (callee.type === AST_NODE_TYPES.CallExpression) {
        const innerCallee = callee.callee
        if (innerCallee.type !== AST_NODE_TYPES.MemberExpression) return false
        return innerCallee.object.type === AST_NODE_TYPES.Identifier && isItOrTest(innerCallee.object.name)
    }

    // it.each`...`("name", cb) / test.each`...`("name", cb)
    // callee is TaggedTemplateExpression whose tag is it.each / test.each
    if (callee.type === AST_NODE_TYPES.TaggedTemplateExpression) {
        const { tag } = callee
        if (tag.type !== AST_NODE_TYPES.MemberExpression) return false
        return tag.object.type === AST_NODE_TYPES.Identifier && isItOrTest(tag.object.name)
    }

    return false
}

function countTestCalls(node: TSESTree.Node): number {
    let count = 0
    simpleTraverse(node, {
        enter: n => {
            if (isImplementedTestCall(n)) count++
        }
    })
    return count
}

/**
 * Parses a test file and returns a map of top-level describe names to the
 * number of implemented test calls (`it`/`test` with ≥2 arguments) inside.
 */
function extractDescribeInfo(testContent: string): Map<string, number> {
    const ast = parseTS(testContent, { jsx: false, range: false, loc: false, comment: false, tokens: false })
    const result = new Map<string, number>()

    for (const stmt of ast.body) {
        if (stmt.type !== "ExpressionStatement") continue
        const expr = stmt.expression
        if (expr.type !== AST_NODE_TYPES.CallExpression) continue
        const { callee, arguments: args } = expr
        if (!isDescribeCallee(callee)) continue
        if (args.length < 2) continue
        const nameArg = args[0]
        if (nameArg.type !== AST_NODE_TYPES.Literal || typeof nameArg.value !== "string") continue
        const callback = args[1]
        result.set(nameArg.value, countTestCalls(callback))
    }

    return result
}

/**
 * Module-level cache for parsed test files.
 * Maps absolute test file paths to the describe-block info extracted from them.
 * Avoids re-parsing the same test file when multiple source files share the
 * same test companion (unusual but possible in monorepo setups).
 */
const testFileCache = new Map<string, Map<string, number>>()

const TEST_FILE_RE = /\.test\.[jt]sx?$/

const rule: TSESLint.RuleModule<IMessageIds, IRuleOptions> = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "require JSDoc comments for all functions and a corresponding test file " +
                "with describe blocks for each named-exported function (≥ minLines logical lines) in utils files"
        },
        messages: {
            missingJsdoc:
                'Function "{{ name }}" is missing a JSDoc comment (`/** … */`). ' +
                "Every function in a utils file must be documented.",
            missingJsdocAnonymous:
                "This function is missing a JSDoc comment (`/** … */`). " +
                "Every function in a utils file must be documented.",
            missingTestFile:
                'Utils file is missing a test file. Create "{{ expected }}" with a ' +
                "`describe` block for each named-exported function (≥ {{ minLines }} lines).",
            missingDescribe:
                'Function "{{ name }}" is missing a `describe("{{ name }}", ...)` block ' + 'in "{{ testFile }}".',
            emptyDescribe:
                'The `describe("{{ name }}", ...)` block in "{{ testFile }}" has no tests. ' +
                "Add at least one `it(...)` or `test(...)` call."
        },
        schema: [
            {
                type: "object",
                properties: {
                    minLines: {
                        type: "integer",
                        minimum: 1,
                        default: DEFAULT_MIN_LINES
                    }
                },
                additionalProperties: false
            }
        ]
    },
    defaultOptions: [{}],
    create(context) {
        if (TEST_FILE_RE.test(context.filename)) return {}

        const minLinesForTest = context.options[0]?.minLines ?? DEFAULT_MIN_LINES
        const sourceCode = context.sourceCode
        const topLevelFunctions: IFunctionEntry[] = []

        return {
            FunctionDeclaration(node: TSESTree.FunctionDeclaration) {
                if (node.id?.name.endsWith("Reducer")) return

                if (
                    node.id &&
                    isNamedExportFunctionDeclaration(node) &&
                    countLogicalLines(node, sourceCode) >= minLinesForTest
                )
                    topLevelFunctions.push({ name: node.id.name, node: node.id })

                if (hasJsdocComment(node, sourceCode)) return

                if (node.id)
                    context.report({
                        node: node.id,
                        messageId: "missingJsdoc",
                        data: { name: node.id.name }
                    })
                else context.report({ node, messageId: "missingJsdocAnonymous" })
            },

            VariableDeclarator(node: TSESTree.VariableDeclarator) {
                if (node.id.type !== AST_NODE_TYPES.Identifier) return
                if (node.id.name.endsWith("Reducer")) return
                if (!node.init) return

                if (
                    node.init.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
                    node.init.type !== AST_NODE_TYPES.FunctionExpression
                )
                    return

                if (
                    isNamedExportVariableDeclarator(node) &&
                    countLogicalLines(node.init, sourceCode) >= minLinesForTest
                )
                    topLevelFunctions.push({ name: node.id.name, node: node.id })

                if (hasJsdocComment(node.init, sourceCode)) return

                context.report({
                    node: node.id,
                    messageId: "missingJsdoc",
                    data: { name: node.id.name }
                })
            },

            ArrowFunctionExpression(node: TSESTree.ArrowFunctionExpression) {
                if (isAnonymousInlineCallback(node)) return

                if (node.parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
                    if (hasJsdocComment(node, sourceCode)) return
                    context.report({ node, messageId: "missingJsdocAnonymous" })
                }
            },

            FunctionExpression(node: TSESTree.FunctionExpression) {
                if (isAnonymousInlineCallback(node)) return

                if (node.parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
                    if (hasJsdocComment(node, sourceCode)) return
                    context.report({ node, messageId: "missingJsdocAnonymous" })
                }
            },

            "Program:exit"() {
                if (topLevelFunctions.length === 0) return

                const testFilePath = getTestFilePath(context.filename)

                if (!existsSync(testFilePath)) {
                    context.report({
                        node: topLevelFunctions[0].node,
                        messageId: "missingTestFile",
                        data: { expected: basename(testFilePath), minLines: minLinesForTest }
                    })
                    return
                }

                let describes = testFileCache.get(testFilePath)
                if (!describes)
                    try {
                        const testContent = readFileSync(testFilePath, "utf-8")
                        describes = extractDescribeInfo(testContent)
                        testFileCache.set(testFilePath, describes)
                    } catch {
                        // Unreadable or unparseable test file — skip content validation
                        return
                    }

                for (const fn of topLevelFunctions)
                    if (!describes.has(fn.name))
                        context.report({
                            node: fn.node,
                            messageId: "missingDescribe",
                            data: { name: fn.name, testFile: basename(testFilePath) }
                        })
                    else if (describes.get(fn.name)! === 0)
                        context.report({
                            node: fn.node,
                            messageId: "emptyDescribe",
                            data: { name: fn.name, testFile: basename(testFilePath) }
                        })
            }
        }
    }
}

export default rule
