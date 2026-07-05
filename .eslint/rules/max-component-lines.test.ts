import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./max-component-lines"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaFeatures: { jsx: true }
        }
    }
})

function generateLines(count: number): string {
    const lines: string[] = ["const Component = () => {"]
    for (let i = 1; i < count - 1; i++) lines.push(`  const x${i} = ${i}`)
    lines.push("}")
    return lines.join("\n")
}

ruleTester.run("max-component-lines", rule, {
    valid: [
        // Short file — well under limit
        {
            code: [
                "const MyComponent = () => {",
                "  return <div>Hello</div>",
                "}"
            ].join("\n"),
            filename: "src/components/MyComponent/index.tsx"
        },

        // Exactly at limit (300 lines)
        {
            code: generateLines(300),
            filename: "src/components/BigComponent/index.tsx"
        },

        // Non-tsx files are ignored
        {
            code: generateLines(400),
            filename: "src/hooks/useData.ts"
        },
        {
            code: generateLines(500),
            filename: "src/utils/helpers.ts"
        },

        // Test files are excluded
        {
            code: generateLines(400),
            filename: "src/components/Foo/index.test.tsx"
        },

        // Spec files are excluded
        {
            code: generateLines(400),
            filename: "src/components/Foo/index.spec.tsx"
        },

        // Story files are excluded
        {
            code: generateLines(400),
            filename: "src/components/Foo/index.stories.tsx"
        }
    ],
    invalid: [
        // One line over limit
        {
            code: generateLines(301),
            filename: "src/components/BigComponent/index.tsx",
            errors: [
                {
                    messageId: "fileTooLong",
                    data: { lineCount: "301", max: "300" }
                }
            ]
        },

        // Well over limit
        {
            code: generateLines(500),
            filename: "src/components/HugeComponent/index.tsx",
            errors: [
                {
                    messageId: "fileTooLong",
                    data: { lineCount: "500", max: "300" }
                }
            ]
        },

        // Exported component — still enforced
        {
            code: generateLines(350),
            filename: "src/pages/Dashboard/index.tsx",
            errors: [
                {
                    messageId: "fileTooLong",
                    data: { lineCount: "350", max: "300" }
                }
            ]
        },

        // Context file — still enforced
        {
            code: generateLines(400),
            filename: "src/components/Foo/contexts/FooContext.tsx",
            errors: [
                {
                    messageId: "fileTooLong",
                    data: { lineCount: "400", max: "300" }
                }
            ]
        }
    ]
})
