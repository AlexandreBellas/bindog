import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./require-regions"

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

function buildComponentLines(
    openLine: string,
    closeLine: string,
    totalLines: number,
    options?: { regions?: boolean }
): string {
    const lines: string[] = [openLine]

    if (options?.regions) lines.push("    // #region States", "    const state = useState(0)", "    // #endregion", "")

    const fixedLines = options?.regions ? 7 : 3
    const paddingCount = totalLines - fixedLines
    for (let i = 0; i < Math.max(0, paddingCount); i++) lines.push(`    const x${i} = ${i}`)

    lines.push("    return null", closeLine)
    return lines.join("\n")
}

function makeComponent(name: string, totalLines: number, options?: { regions?: boolean }): string {
    return buildComponentLines(`const ${name} = () => {`, "}", totalLines, options)
}

function makeForwardRefComponent(name: string, totalLines: number, options?: { regions?: boolean }): string {
    return buildComponentLines(`const ${name} = forwardRef((props, ref) => {`, "})", totalLines, options)
}

function makeFunctionComponent(name: string, totalLines: number, options?: { regions?: boolean }): string {
    return buildComponentLines(`function ${name}() {`, "}", totalLines, options)
}

function makeArrowHook(name: string, totalLines: number, options?: { regions?: boolean }): string {
    return buildComponentLines(`const ${name} = () => {`, "}", totalLines, options)
}

function makeFunctionHook(name: string, totalLines: number, options?: { regions?: boolean }): string {
    return buildComponentLines(`function ${name}() {`, "}", totalLines, options)
}

ruleTester.run("require-regions", rule, {
    valid: [
        {
            name: "short arrow component (< 100 lines) without regions",
            code: makeComponent("ShortComponent", 50),
            filename: "src/components/ShortComponent/index.tsx"
        },
        {
            name: "short arrow component at exactly 99 lines without regions",
            code: makeComponent("AlmostLong", 99),
            filename: "src/components/AlmostLong/index.tsx"
        },
        {
            name: "long arrow component (≥ 100 lines) with regions",
            code: makeComponent("LongComponent", 120, { regions: true }),
            filename: "src/components/LongComponent/index.tsx"
        },
        {
            name: "long arrow component at exactly 100 lines with regions",
            code: makeComponent("ExactlyHundred", 100, { regions: true }),
            filename: "src/components/ExactlyHundred/index.tsx"
        },
        {
            name: "short function declaration component without regions",
            code: makeFunctionComponent("ShortFunc", 50),
            filename: "src/components/ShortFunc/index.tsx"
        },
        {
            name: "long function declaration component with regions",
            code: makeFunctionComponent("LongFunc", 120, { regions: true }),
            filename: "src/components/LongFunc/index.tsx"
        },
        {
            name: "long forwardRef component with regions",
            code: makeForwardRefComponent("RefComponent", 120, { regions: true }),
            filename: "src/components/RefComponent/index.tsx"
        },
        {
            name: "short forwardRef component without regions",
            code: makeForwardRefComponent("ShortRef", 50),
            filename: "src/components/ShortRef/index.tsx"
        },
        {
            name: "test file is excluded even if long without regions",
            code: makeComponent("TestComponent", 150),
            filename: "src/components/TestComponent/index.test.tsx"
        },
        {
            name: "spec file is excluded even if long without regions",
            code: makeComponent("SpecComponent", 150),
            filename: "src/components/SpecComponent/index.spec.tsx"
        },
        {
            name: "stories file is excluded even if long without regions",
            code: makeComponent("StoryComponent", 150),
            filename: "src/components/StoryComponent/index.stories.tsx"
        },
        {
            name: "non-component camelCase function is not checked",
            code: buildComponentLines("const formatData = () => {", "}", 120),
            filename: "src/utils/formatData.ts"
        },
        {
            name: "short component with regions (regions are optional but allowed)",
            code: makeComponent("SmallButOrganized", 30, { regions: true }),
            filename: "src/components/SmallButOrganized/index.tsx"
        },
        {
            name: "arrow function returning JSX directly (no block body) is not checked",
            code: [
                "const Icon = () => (",
                "    <svg>",
                ...Array.from({ length: 100 }, () => "        <path />"),
                "    </svg>",
                ")"
            ].join("\n"),
            filename: "src/components/Icon/index.tsx"
        },
        {
            name: "long memo-wrapped component with regions",
            code: buildComponentLines("const MemoComp = React.memo(() => {", "})", 120, { regions: true }),
            filename: "src/components/MemoComp/index.tsx"
        },

        // Hook files — short hooks do not need regions
        {
            name: "short arrow hook (< 100 lines) without regions",
            code: makeArrowHook("useShortHook", 50),
            filename: "src/hooks/queries/useShortHook.ts"
        },
        {
            name: "short function hook without regions",
            code: makeFunctionHook("useShortData", 50),
            filename: "src/hooks/useShortData.ts"
        },

        // Hook files — long hooks with regions are valid
        {
            name: "long arrow hook with regions",
            code: makeArrowHook("useLongHook", 120, { regions: true }),
            filename: "src/hooks/queries/useLongHook.ts"
        },
        {
            name: "long function hook with regions",
            code: makeFunctionHook("useLongData", 120, { regions: true }),
            filename: "src/hooks/useLongData.ts"
        },

        // Hook test files are excluded even if long without regions
        {
            name: "hook test file is excluded even if long without regions",
            code: makeArrowHook("useLongHook", 150),
            filename: "src/hooks/queries/useLongHook.test.ts"
        }
    ],
    invalid: [
        {
            name: "long arrow component (100 lines) without regions",
            code: makeComponent("LongComponent", 100),
            filename: "src/components/LongComponent/index.tsx",
            errors: [{ messageId: "missingRegions" }]
        },
        {
            name: "very long arrow component without regions",
            code: makeComponent("VeryLong", 200),
            filename: "src/components/VeryLong/index.tsx",
            errors: [{ messageId: "missingRegions" }]
        },
        {
            name: "long function declaration component without regions",
            code: makeFunctionComponent("LongFunc", 120),
            filename: "src/components/LongFunc/index.tsx",
            errors: [{ messageId: "missingRegions" }]
        },
        {
            name: "long forwardRef component without regions",
            code: makeForwardRefComponent("LongRef", 120),
            filename: "src/components/LongRef/index.tsx",
            errors: [{ messageId: "missingRegions" }]
        },
        {
            name: "long memo-wrapped component without regions",
            code: buildComponentLines("const MemoComp = React.memo(() => {", "})", 120),
            filename: "src/components/MemoComp/index.tsx",
            errors: [{ messageId: "missingRegions" }]
        },
        {
            name: "multiple long components without regions",
            code: [makeComponent("FirstLong", 110), "", makeComponent("SecondLong", 110)].join("\n"),
            filename: "src/components/MultiComponent/index.tsx",
            errors: [{ messageId: "missingRegions" }, { messageId: "missingRegions" }]
        },
        {
            name: "nested React.memo(forwardRef(...)) without regions",
            code: buildComponentLines("const Nested = React.memo(forwardRef((props, ref) => {", "}))", 120),
            filename: "src/components/Nested/index.tsx",
            errors: [{ messageId: "missingRegions" }]
        },

        // Hook files — long hooks without regions are invalid
        {
            name: "long arrow hook without regions",
            code: makeArrowHook("useLongHook", 120),
            filename: "src/hooks/queries/useLongHook.ts",
            errors: [{ messageId: "missingRegions" }]
        },
        {
            name: "long function hook without regions",
            code: makeFunctionHook("useLongData", 100),
            filename: "src/hooks/useLongData.ts",
            errors: [{ messageId: "missingRegions" }]
        },
        {
            name: "very long hook without regions",
            code: makeArrowHook("useComplexQuery", 200),
            filename: "src/hooks/queries/useComplexQuery.ts",
            errors: [{ messageId: "missingRegions" }]
        }
    ]
})
