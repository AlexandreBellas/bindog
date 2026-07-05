import type { TSESLint, TSESTree } from "@typescript-eslint/utils"

type IMessageIds = "interfaceInConstantsFile" | "typeInConstantsFile"

function isConstantsFile(filename: string): boolean {
    return filename.replace(/\\/g, "/").includes("/constants/")
}

function isExcludedFile(filename: string): boolean {
    return /\.(test|spec|stories)\.[jt]sx?$/.test(filename.replace(/\\/g, "/"))
}

/**
 * Forbids `interface` and `type` alias declarations inside `constants/` folders.
 *
 * Constants files must only contain value-level exports (plain objects, arrays,
 * literals). Type definitions belong in the local `./@types` folder so that the
 * separation between runtime constants and compile-time types is clear.
 */
const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "forbid `interface` and `type` alias definitions in constants files — " +
                "move them to the local `./@types` folder instead"
        },
        messages: {
            interfaceInConstantsFile:
                'Interface "{{ name }}" must not be defined in a constants file. ' +
                "Move it to the local `./@types` folder instead.",
            typeInConstantsFile:
                'Type alias "{{ name }}" must not be defined in a constants file. ' +
                "Move it to the local `./@types` folder instead."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        if (!isConstantsFile(context.filename)) return {}
        if (isExcludedFile(context.filename)) return {}

        return {
            TSInterfaceDeclaration(node: TSESTree.TSInterfaceDeclaration) {
                context.report({
                    node: node.id,
                    messageId: "interfaceInConstantsFile",
                    data: { name: node.id.name }
                })
            },
            TSTypeAliasDeclaration(node: TSESTree.TSTypeAliasDeclaration) {
                context.report({
                    node: node.id,
                    messageId: "typeInConstantsFile",
                    data: { name: node.id.name }
                })
            }
        }
    }
}

export default rule
