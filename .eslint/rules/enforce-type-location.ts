import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { AST_NODE_TYPES } from "@typescript-eslint/utils"

type IMessageIds = "interfaceInComponent" | "interfaceInHook" | "typeGuardOutsideTypes"

function isInTypesFolder(filename: string): boolean {
    return filename.replace(/\\/g, "/").includes("/@types/")
}

function isExcludedFile(filename: string): boolean {
    return /\.(test|spec|stories)\.[jt]sx?$/.test(filename.replace(/\\/g, "/"))
}

function hasTypePredicateReturn(
    node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression
): boolean {
    if (!node.returnType) return false
    return node.returnType.typeAnnotation.type === AST_NODE_TYPES.TSTypePredicate
}

/**
 * Returns whether the given name is allowed directly in a component (`.tsx`)
 * or hook (`.ts`) file.
 *
 * Allowed suffixes:
 * - `Props`   — component props
 * - `Ref`     — imperative-handle / forwardRef shape
 * - `Result`  — the return shape of a hook (hook files only)
 *
 * Everything else (including `State` and `Action`) must live in `./@types`.
 */
function isAllowedTypeName(name: string, isTsx: boolean): boolean {
    if (name.endsWith("Props")) return true
    if (name.endsWith("Ref")) return true
    if (!isTsx && name.endsWith("Result")) return true
    return false
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "enforce that component interfaces live in @types/ " +
                "folders and type guard functions are co-located " +
                "with their interface definitions"
        },
        messages: {
            interfaceInComponent:
                'Interface "{{ name }}" must be placed in the ' +
                "local `./@types` folder. Only interfaces ending with " +
                '"Props" or "Ref" are allowed in component files.',
            interfaceInHook:
                'Interface "{{ name }}" must be placed in the ' +
                "local `./@types` folder. Only interfaces ending with " +
                '"Props" or "Result" are allowed in hook files.\n' +
                "If the hook is a plain `use(...).ts` TS file, move it " +
                "to a folder structure and rename it to `index.ts`.",
            typeGuardOutsideTypes:
                'Type guard function "{{ name }}" must be ' +
                "co-located with its interface definition " +
                "in the `@types` folder."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        if (isExcludedFile(context.filename)) return {}
        if (isInTypesFolder(context.filename)) return {}

        const listeners: TSESLint.RuleListener = {}

        const isTsx = context.filename.endsWith(".tsx")

        listeners.TSInterfaceDeclaration = (node: TSESTree.TSInterfaceDeclaration) => {
            if (isAllowedTypeName(node.id.name, isTsx)) return

            context.report({
                node: node.id,
                messageId: isTsx ? "interfaceInComponent" : "interfaceInHook",
                data: { name: node.id.name }
            })
        }

        listeners.TSTypeAliasDeclaration = (node: TSESTree.TSTypeAliasDeclaration) => {
            if (isAllowedTypeName(node.id.name, isTsx)) return

            context.report({
                node: node.id,
                messageId: isTsx ? "interfaceInComponent" : "interfaceInHook",
                data: { name: node.id.name }
            })
        }

        listeners.FunctionDeclaration = (node: TSESTree.FunctionDeclaration) => {
            if (!node.id) return
            if (!hasTypePredicateReturn(node)) return

            context.report({
                node: node.id,
                messageId: "typeGuardOutsideTypes",
                data: { name: node.id.name }
            })
        }

        listeners.VariableDeclarator = (node: TSESTree.VariableDeclarator) => {
            if (node.id.type !== AST_NODE_TYPES.Identifier) return
            if (!node.init) return

            if (
                node.init.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
                node.init.type !== AST_NODE_TYPES.FunctionExpression
            )
                return

            if (!hasTypePredicateReturn(node.init)) return

            context.report({
                node: node.id,
                messageId: "typeGuardOutsideTypes",
                data: { name: node.id.name }
            })
        }

        return listeners
    }
}

export default rule
