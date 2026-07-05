import type { TSESLint, TSESTree } from "@typescript-eslint/utils"

type IMessageIds = "fileTooLong"

const MAX_LINES = 300

function normalizePath(filename: string): string {
    return filename.replace(/\\/g, "/")
}

function isTsxFile(filename: string): boolean {
    return normalizePath(filename).endsWith(".tsx")
}

function isExcludedFile(filename: string): boolean {
    return /\.(test|spec|stories)\.[jt]sx?$/.test(normalizePath(filename))
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "suggestion",
        docs: {
            description: "enforce a maximum line count for component files"
        },
        messages: {
            fileTooLong:
                "Component file is {{ lineCount }} lines long " +
                "(max {{ max }}). Break the component into smaller " +
                "sub-components or extract hooks into semantically " +
                "separate files to improve readability."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        if (!isTsxFile(context.filename)) return {}
        if (isExcludedFile(context.filename)) return {}

        return {
            Program(node: TSESTree.Program) {
                const lineCount = node.loc.end.line
                if (lineCount <= MAX_LINES) return

                context.report({
                    node,
                    messageId: "fileTooLong",
                    data: {
                        lineCount: String(lineCount),
                        max: String(MAX_LINES)
                    }
                })
            }
        }
    }
}

export default rule
