import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"

type IMessageIds = "multipleComponents" | "missingDefaultExport"

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

interface IComponentEntry {
    node: TSESTree.Node
    name: string | null
    isDefaultExported: boolean
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description: "enforce exactly one default-exported component definition per file"
        },
        messages: {
            multipleComponents:
                "Only one component definition per file is allowed. " +
                "Found {{ count }}; move extra components to their own files.",
            missingDefaultExport: 'Component "{{ name }}" must use `export default`.'
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
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

                if (components.length <= 1 && components[0]?.isDefaultExported) return

                if (components.length > 1) {
                    for (const comp of components)
                        context.report({
                            node: comp.node,
                            messageId: "multipleComponents",
                            data: { count: String(components.length) }
                        })

                    return
                }

                if (components.length === 1 && !components[0].isDefaultExported)
                    context.report({
                        node: components[0].node,
                        messageId: "missingDefaultExport",
                        data: { name: components[0].name ?? "(anonymous)" }
                    })
            }
        }
    }
}

export default rule
