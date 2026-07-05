import { describe, expect, it } from "vitest"
import { mergeUseTranslations } from "./merger.mjs"

describe("mergeUseTranslations - basic two-namespace merge", () => {
    it("merges two useTranslation calls into one array call", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tCommon } = useTranslation("common")',
            '    const { t: tProject } = useTranslation("project")',
            '    return tCommon("key1") + tProject("key2")',
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["common", "project"])')
        expect(result).not.toMatch(/\btCommon\b/)
        expect(result).not.toMatch(/\btProject\b/)
        expect(result).toContain('t("common:key1")')
        expect(result).toContain('t("project:key2")')
    })

    it("merges two calls where the first t var is already named 't'", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t } = useTranslation("common")',
            '    const { t: tReport } = useTranslation("report")',
            '    return t("base-key") + tReport("report-key")',
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["common", "report"])')
        expect(result).not.toMatch(/\btReport\b/)
        expect(result).toContain('t("common:base-key")')
        expect(result).toContain('t("report:report-key")')
    })

    it("preserves already-prefixed keys (does not double-prefix)", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            '    return tA("a:already-prefixed") + tB("b:already-too")',
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["a", "b"])')
        expect(result).toContain('t("a:already-prefixed")')
        expect(result).toContain('t("b:already-too")')
    })

    it("uses single quotes for keys when original used single quotes", () => {
        const input = [
            "import { useTranslation } from 'react-i18next'",
            "",
            "function MyComponent() {",
            "    const { t: tA } = useTranslation('ns1')",
            "    const { t: tB } = useTranslation('ns2')",
            "    return tA('key-a') + tB('key-b')",
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["ns1", "ns2"])')
        expect(result).toContain("t('ns1:key-a')")
        expect(result).toContain("t('ns2:key-b')")
    })
})

describe("mergeUseTranslations - JSX component", () => {
    it("merges calls in a JSX component and rewrites t() calls inside JSX", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tCommon } = useTranslation("common")',
            '    const { t: tProject } = useTranslation("project")',
            "    return (",
            "        <div>",
            '            <p>{tCommon("translation-key-common")}</p>',
            '            <p>{tProject("translation-key-project")}</p>',
            "        </div>",
            "    )",
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["common", "project"])')
        expect(result).not.toMatch(/\btCommon\b/)
        expect(result).not.toMatch(/\btProject\b/)
        expect(result).toContain('t("common:translation-key-common")')
        expect(result).toContain('t("project:translation-key-project")')
    })

    it("merges calls in a hook (use* prefix)", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function useMyHook() {",
            '    const { t } = useTranslation("common")',
            '    const { t: tReport } = useTranslation("report")',
            '    const label = t("label") + tReport("title")',
            "    return { label }",
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["common", "report"])')
        expect(result).not.toMatch(/\btReport\b/)
        expect(result).toContain('t("common:label")')
        expect(result).toContain('t("report:title")')
    })
})

describe("mergeUseTranslations - t() calls in nested arrow functions", () => {
    it("rewrites t() calls inside nested arrow function callbacks", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            "    const handleClick = () => {",
            '        return tA("click-label") + tB("btn-label")',
            "    }",
            "    return handleClick()",
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["a", "b"])')
        expect(result).toContain('t("a:click-label")')
        expect(result).toContain('t("b:btn-label")')
    })
})

describe("mergeUseTranslations - three namespace merge", () => {
    it("merges three useTranslation calls into a single array call", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            '    const { t: tC } = useTranslation("c")',
            '    return tA("x") + tB("y") + tC("z")',
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["a", "b", "c"])')
        expect(result).toContain('t("a:x")')
        expect(result).toContain('t("b:y")')
        expect(result).toContain('t("c:z")')
    })
})

describe("mergeUseTranslations - no-op cases", () => {
    it("returns input unchanged when there is only one useTranslation call", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t } = useTranslation("common")',
            '    return t("key")',
            "}",
            ""
        ].join("\n")

        expect(mergeUseTranslations(input)).toBe(input)
    })

    it("returns input unchanged when there is only one no-argument useTranslation call", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            "    const { t } = useTranslation()",
            '    return t("key")',
            "}",
            ""
        ].join("\n")

        expect(mergeUseTranslations(input)).toBe(input)
    })

    it("returns input unchanged when there is no useTranslation at all", () => {
        const input = ["function MyComponent() {", "    return 42", "}", ""].join("\n")

        expect(mergeUseTranslations(input)).toBe(input)
    })

    it("does not merge calls from a non-i18next source", () => {
        const input = [
            'import { useTranslation } from "../hooks/useTranslation"',
            "",
            "function MyComponent() {",
            '    const { t: t1 } = useTranslation("ns1")',
            '    const { t: t2 } = useTranslation("ns2")',
            '    return t1("k1") + t2("k2")',
            "}",
            ""
        ].join("\n")

        expect(mergeUseTranslations(input)).toBe(input)
    })

    it("returns input unchanged when namespace argument is dynamic (not a string literal)", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent({ ns }) {",
            "    const { t: tA } = useTranslation(ns)",
            '    const { t: tB } = useTranslation("common")',
            '    return tA("k1") + tB("k2")',
            "}",
            ""
        ].join("\n")

        expect(mergeUseTranslations(input)).toBe(input)
    })

    it("returns input unchanged when a t() call has a non-string-literal first arg", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent({ key }) {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            '    return tA(key) + tB("literal-key")',
            "}",
            ""
        ].join("\n")

        expect(mergeUseTranslations(input)).toBe(input)
    })

    it("merges when a t variable is passed as a function reference, replacing it with a wrapper", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            '    return helper(tA) + tB("key")',
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["a", "b"])')
        expect(result).not.toMatch(/\btA\b/)
        expect(result).not.toMatch(/\btB\b/)
        expect(result).toContain("((key, ...args) => t(`a:${key}`, ...args))")
        expect(result).toContain('t("b:key")')
    })

    it("returns input unchanged when no component/hook body is found", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "const helper = () => {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            '    return tA("k1") + tB("k2")',
            "}",
            ""
        ].join("\n")

        expect(mergeUseTranslations(input)).toBe(input)
    })

    it("returns empty input unchanged", () => {
        expect(mergeUseTranslations("")).toBe("")
    })

    it("handles parse errors gracefully - returns original text", () => {
        const broken = "const { = useTranslation("
        expect(mergeUseTranslations(broken)).toBe(broken)
    })
})

describe("mergeUseTranslations - sibling components are isolated", () => {
    it("only merges within the same component, not across siblings", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function CompA() {",
            '    const { t: tA1 } = useTranslation("a1")',
            '    const { t: tA2 } = useTranslation("a2")',
            '    return tA1("x") + tA2("y")',
            "}",
            "",
            "function CompB() {",
            '    const { t } = useTranslation("b")',
            '    return t("z")',
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        // CompA should be merged
        expect(result).toContain('const { t } = useTranslation(["a1", "a2"])')
        expect(result).toContain('t("a1:x")')
        expect(result).toContain('t("a2:y")')

        // CompB should remain unchanged
        expect(result).toContain('const { t } = useTranslation("b")')
        expect(result).toContain('t("z")')
    })
})

describe("mergeUseTranslations – forwardRef and export-default components", () => {
    it("merges calls inside a forwardRef component", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "const MyInput = forwardRef((props, ref) => {",
            '    const { t: tCommon } = useTranslation("common")',
            '    const { t: tForm } = useTranslation("form")',
            '    return tCommon("placeholder") + tForm("label")',
            "})",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["common", "form"])')
        expect(result).toContain('t("common:placeholder")')
        expect(result).toContain('t("form:label")')
    })

    it("merges calls inside an export-default function component", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "export default function MyComponent() {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            '    return tA("x") + tB("y")',
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["a", "b"])')
        expect(result).toContain('t("a:x")')
        expect(result).toContain('t("b:y")')
    })

    it("does not merge when a t-var is used as a shorthand property reference", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            "    const obj = { tA }",
            '    return tB("key")',
            "}",
            ""
        ].join("\n")

        expect(mergeUseTranslations(input)).toBe(input)
    })
})

describe("mergeUseTranslations - non-call references (function reference / instance usages)", () => {
    it("wraps a t alias passed as argument to a utility function (ProjectTableRow pattern)", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "export default function ProjectTableRow() {",
            '    const { t: tCommon } = useTranslation("common")',
            '    const { t: tWorkspace } = useTranslation("workspace")',
            '    const displayName = project.name ?? tCommon("words.untitled")',
            "    return (",
            "        <div>",
            "            <span>{displayName}</span>",
            "            <span>{getProjectTypeLabel(project.type, tWorkspace)}</span>",
            "        </div>",
            "    )",
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["common", "workspace"])')
        expect(result).not.toMatch(/\btCommon\b/)
        expect(result).not.toMatch(/\btWorkspace\b/)
        expect(result).toContain('t("common:words.untitled")')
        expect(result).toContain("((key, ...args) => t(`workspace:${key}`, ...args))")
    })

    it("handles a t alias used both as a call and as a reference in the same body", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            '    const label = tA("direct-key")',
            '    return helper(tA) + tB("key")',
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["a", "b"])')
        expect(result).toContain('t("a:direct-key")')
        expect(result).toContain("((key, ...args) => t(`a:${key}`, ...args))")
        expect(result).toContain('t("b:key")')
    })

    it("wraps multiple non-call references from different namespaces", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            "    return helperA(tA) + helperB(tB)",
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["a", "b"])')
        expect(result).toContain("((key, ...args) => t(`a:${key}`, ...args))")
        expect(result).toContain("((key, ...args) => t(`b:${key}`, ...args))")
    })

    it("still skips merge when a t-call has a non-string-literal first arg (even with refs)", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent({ dynamicKey }) {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            "    return tA(dynamicKey) + helper(tB)",
            "}",
            ""
        ].join("\n")

        expect(mergeUseTranslations(input)).toBe(input)
    })
})

describe("mergeUseTranslations – no-argument useTranslation (default namespace)", () => {
    it("merges a no-argument useTranslation() with an explicit namespace call", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "export default function ReportsTabContentItem() {",
            "    const { t } = useTranslation()",
            '    const { t: tReport } = useTranslation("report")',
            '    return t("words.untitled") + tReport("title")',
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["common", "report"])')
        expect(result).not.toContain("tReport")
        expect(result).toContain('t("common:words.untitled")')
        expect(result).toContain('t("report:title")')
    })

    it("merges two no-argument useTranslation() calls (both default to common)", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            "    const { t: tA } = useTranslation()",
            "    const { t: tB } = useTranslation()",
            '    return tA("x") + tB("y")',
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["common"])')
        expect(result).toContain('t("common:x")')
        expect(result).toContain('t("common:y")')
    })

    it("deduplicates when explicit common and no-argument calls coexist", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tCommon } = useTranslation("common")',
            "    const { t: tDefault } = useTranslation()",
            '    const { t: tReport } = useTranslation("report")',
            '    return tCommon("a") + tDefault("b") + tReport("c")',
            "}",
            ""
        ].join("\n")

        const result = mergeUseTranslations(input)

        expect(result).toContain('const { t } = useTranslation(["common", "report"])')
        expect(result).not.toContain("tCommon")
        expect(result).not.toContain("tDefault")
        expect(result).not.toContain("tReport")
        expect(result).toContain('t("common:a")')
        expect(result).toContain('t("common:b")')
        expect(result).toContain('t("report:c")')
    })

    it("is idempotent when merging no-argument useTranslation calls", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            "    const { t } = useTranslation()",
            '    const { t: tReport } = useTranslation("report")',
            '    return t("key") + tReport("title")',
            "}",
            ""
        ].join("\n")

        const once = mergeUseTranslations(input)
        const twice = mergeUseTranslations(once)
        expect(twice).toBe(once)
    })
})

describe("mergeUseTranslations – namespace sort determinism", () => {
    it("sorts namespaces alphabetically regardless of declaration order", () => {
        const inputBA = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tB } = useTranslation("b")',
            '    const { t: tA } = useTranslation("a")',
            '    return tB("y") + tA("x")',
            "}",
            ""
        ].join("\n")

        const inputAB = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            '    return tA("x") + tB("y")',
            "}",
            ""
        ].join("\n")

        const resultBA = mergeUseTranslations(inputBA)
        const resultAB = mergeUseTranslations(inputAB)

        // Both should produce the same sorted namespace array
        expect(resultBA).toContain('const { t } = useTranslation(["a", "b"])')
        expect(resultAB).toContain('const { t } = useTranslation(["a", "b"])')
    })
})

describe("mergeUseTranslations – idempotency", () => {
    it("is idempotent – running twice produces the same result", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            '    return tA("x") + tB("y")',
            "}",
            ""
        ].join("\n")

        const once = mergeUseTranslations(input)
        const twice = mergeUseTranslations(once)
        expect(twice).toBe(once)
    })

    it("is idempotent when non-call references produce wrappers", () => {
        const input = [
            'import { useTranslation } from "react-i18next"',
            "",
            "function MyComponent() {",
            '    const { t: tA } = useTranslation("a")',
            '    const { t: tB } = useTranslation("b")',
            '    return helper(tA) + tB("key")',
            "}",
            ""
        ].join("\n")

        const once = mergeUseTranslations(input)
        const twice = mergeUseTranslations(once)
        expect(twice).toBe(once)
    })
})
