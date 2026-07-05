import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"
import { existsSync } from "node:fs"
import { basename, dirname, extname, join } from "node:path"

type IMessageIds = "missingStorybook" | "emptyStorybook"

const STORY_EXTENSIONS = [".stories.tsx", ".stories.ts", ".stories.jsx", ".stories.js"]
const STORIES_FILE_RE = /\.stories\.[jt]sx?$/

const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/
const HOOK_NAME_RE = /^use[A-Z]/

function isComponentName(name: string): boolean {
    return PASCAL_CASE_RE.test(name) && !HOOK_NAME_RE.test(name)
}

function isMemoOrForwardRef(node: TSESTree.Expression): boolean {
    if (node.type !== AST_NODE_TYPES.CallExpression) return false

    const callee = node.callee
    if (callee.type === AST_NODE_TYPES.Identifier) return callee.name === "forwardRef" || callee.name === "memo"

    if (
        callee.type === AST_NODE_TYPES.MemberExpression &&
        callee.object.type === AST_NODE_TYPES.Identifier &&
        callee.object.name === "React" &&
        callee.property.type === AST_NODE_TYPES.Identifier
    )
        return callee.property.name === "forwardRef" || callee.property.name === "memo"

    return false
}

function isComponentInitializer(node: TSESTree.Expression): boolean {
    if (node.type === AST_NODE_TYPES.ArrowFunctionExpression || node.type === AST_NODE_TYPES.FunctionExpression)
        return true

    return isMemoOrForwardRef(node)
}

function hasStorybookSibling(filePath: string): boolean {
    const dir = dirname(filePath)
    const ext = extname(filePath)
    const base = basename(filePath, ext)

    for (const storyExt of STORY_EXTENSIONS) if (existsSync(join(dir, base + storyExt))) return true

    return false
}

interface IComponentEntry {
    node: TSESTree.Node
    name: string | null
    isDefaultExported: boolean
}

function isStorybookFile(filename: string): boolean {
    return STORIES_FILE_RE.test(filename)
}

function isValueExport(node: TSESTree.ExportNamedDeclaration): boolean {
    if (node.exportKind === "type") return false
    if (!node.declaration) return node.specifiers.some(s => s.exportKind !== "type")
    return (
        node.declaration.type !== AST_NODE_TYPES.TSTypeAliasDeclaration &&
        node.declaration.type !== AST_NODE_TYPES.TSInterfaceDeclaration
    )
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "require a corresponding Storybook file for every component definition, " +
                "and at least one story export in every Storybook file"
        },
        messages: {
            missingStorybook:
                'Component "{{ name }}" is missing a Storybook file. ' +
                'Create "{{ expected }}" to document this component.',
            emptyStorybook:
                'Storybook file "{{ filename }}" has no story exports. ' +
                "Add at least one named export (e.g. `export const Default: Story = {}`)."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        if (isStorybookFile(context.filename)) {
            let hasStory = false
            let metaNode: TSESTree.Node | null = null

            return {
                ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
                    if (!hasStory && isValueExport(node)) hasStory = true
                },
                ExportDefaultDeclaration(node: TSESTree.ExportDefaultDeclaration) {
                    metaNode = node
                },
                "Program:exit"(node: TSESTree.Program) {
                    if (hasStory) return

                    context.report({
                        node: metaNode ?? node,
                        messageId: "emptyStorybook",
                        data: { filename: basename(context.filename) }
                    })
                }
            }
        }
        const components: IComponentEntry[] = []
        let defaultExportedName: string | null = null

        return {
            ExportDefaultDeclaration(node: TSESTree.ExportDefaultDeclaration) {
                const decl = node.declaration

                if (decl.type === AST_NODE_TYPES.Identifier) {
                    defaultExportedName = decl.name
                    return
                }

                if (decl.type === AST_NODE_TYPES.FunctionDeclaration) return

                if (decl.type === AST_NODE_TYPES.CallExpression && isMemoOrForwardRef(decl)) {
                    const firstArg = decl.arguments[0]
                    if (firstArg?.type === AST_NODE_TYPES.Identifier) {
                        defaultExportedName = firstArg.name
                        return
                    }

                    components.push({ node, name: null, isDefaultExported: true })
                    return
                }

                if (
                    decl.type === AST_NODE_TYPES.ArrowFunctionExpression ||
                    decl.type === AST_NODE_TYPES.FunctionExpression
                )
                    components.push({ node, name: null, isDefaultExported: true })
            },

            FunctionDeclaration(node: TSESTree.FunctionDeclaration) {
                const parent = node.parent
                const isExportDefault = parent.type === AST_NODE_TYPES.ExportDefaultDeclaration

                if (!node.id) {
                    if (isExportDefault) components.push({ node, name: null, isDefaultExported: true })
                    return
                }

                if (!isComponentName(node.id.name)) return

                if (
                    parent.type !== AST_NODE_TYPES.Program &&
                    parent.type !== AST_NODE_TYPES.ExportNamedDeclaration &&
                    parent.type !== AST_NODE_TYPES.ExportDefaultDeclaration
                )
                    return

                components.push({
                    node: node.id,
                    name: node.id.name,
                    isDefaultExported: isExportDefault
                })
            },

            VariableDeclarator(node: TSESTree.VariableDeclarator) {
                if (node.id.type !== AST_NODE_TYPES.Identifier) return
                if (!isComponentName(node.id.name)) return
                if (!node.init || !isComponentInitializer(node.init)) return

                const decl = node.parent
                if (decl.type !== AST_NODE_TYPES.VariableDeclaration) return

                const parent = decl.parent
                if (parent.type !== AST_NODE_TYPES.Program && parent.type !== AST_NODE_TYPES.ExportNamedDeclaration)
                    return

                components.push({
                    node: node.id,
                    name: node.id.name,
                    isDefaultExported: false
                })
            },

            "Program:exit"() {
                if (defaultExportedName)
                    for (const comp of components) if (comp.name === defaultExportedName) comp.isDefaultExported = true

                const primary =
                    components.find(c => c.isDefaultExported) ?? (components.length > 0 ? components[0] : null)

                if (!primary) return
                if (hasStorybookSibling(context.filename)) return

                const ext = extname(context.filename)
                const base = basename(context.filename, ext)

                context.report({
                    node: primary.node,
                    messageId: "missingStorybook",
                    data: {
                        name: primary.name ?? "(anonymous)",
                        expected: base + ".stories" + ext
                    }
                })
            }
        }
    }
}

export default rule
