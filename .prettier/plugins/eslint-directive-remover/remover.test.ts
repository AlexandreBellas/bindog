import { describe, expect, it } from "vitest"
import { removeEslintDirectives } from "./remover.mjs"

// #region removeEslintDirectives — line comments (own line)
describe("removeEslintDirectives — line comments on their own line", () => {
    it("removes // eslint-disable-next-line with a rule name", () => {
        const input = [
            "const x = 1",
            "// eslint-disable-next-line max-len",
            'const y = "long string"',
            ""
        ].join("\n")
        const expected = ["const x = 1", 'const y = "long string"', ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes // eslint-disable-next-line without a rule name", () => {
        const input = [
            "// eslint-disable-next-line",
            "const x = 1",
            ""
        ].join("\n")
        const expected = ["const x = 1", ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes // eslint-disable-next-line with multiple rules", () => {
        const input = [
            "// eslint-disable-next-line max-len, no-unused-vars",
            "const x = 1",
            ""
        ].join("\n")
        const expected = ["const x = 1", ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes // eslint-disable-line on its own line", () => {
        const input = [
            "// eslint-disable-line no-console",
            "console.log('hi')",
            ""
        ].join("\n")
        const expected = ["console.log('hi')", ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes indented // eslint-disable-next-line", () => {
        const input = [
            "function foo() {",
            "    // eslint-disable-next-line max-len",
            '    const y = "long"',
            "}",
            ""
        ].join("\n")
        const expected = [
            "function foo() {",
            '    const y = "long"',
            "}",
            ""
        ].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes multiple eslint-disable-next-line comments", () => {
        const input = [
            "// eslint-disable-next-line no-unused-vars",
            "const a = 1",
            "// eslint-disable-next-line max-len",
            'const b = "long"',
            ""
        ].join("\n")
        const expected = ["const a = 1", 'const b = "long"', ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes // eslint-disable on its own line", () => {
        const input = [
            "// eslint-disable no-console",
            "console.log('hi')",
            ""
        ].join("\n")
        const expected = ["console.log('hi')", ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes // eslint-enable on its own line", () => {
        const input = [
            "console.log('hi')",
            "// eslint-enable no-console",
            ""
        ].join("\n")
        const expected = ["console.log('hi')", ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })
})
// #endregion

// #region removeEslintDirectives — line comments (trailing)
describe("removeEslintDirectives — trailing line comments", () => {
    it("removes a trailing // eslint-disable-line comment", () => {
        const input = 'console.log("hi") // eslint-disable-line no-console\n'
        const expected = 'console.log("hi")\n'
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes a trailing // eslint-disable-next-line comment", () => {
        const input = "const x = 1 // eslint-disable-next-line\n"
        const expected = "const x = 1\n"
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes a trailing // eslint-disable-line with multiple rules", () => {
        const input = "const x = foo() // eslint-disable-line no-unused-vars, max-len\n"
        const expected = "const x = foo()\n"
        expect(removeEslintDirectives(input)).toBe(expected)
    })
})
// #endregion

// #region removeEslintDirectives — block comments (own line)
describe("removeEslintDirectives — block comments on their own line", () => {
    it("removes /* eslint-disable */ on its own line", () => {
        const input = [
            "/* eslint-disable */",
            "const x = 1",
            "/* eslint-enable */",
            ""
        ].join("\n")
        const expected = ["const x = 1", ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes /* eslint-disable rule-name */ on its own line", () => {
        const input = [
            "/* eslint-disable no-console */",
            "console.log('hi')",
            "/* eslint-enable no-console */",
            ""
        ].join("\n")
        const expected = ["console.log('hi')", ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes indented block comment directives", () => {
        const input = [
            "function foo() {",
            "    /* eslint-disable max-len */",
            '    const y = "long"',
            "    /* eslint-enable max-len */",
            "}",
            ""
        ].join("\n")
        const expected = [
            "function foo() {",
            '    const y = "long"',
            "}",
            ""
        ].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes /* eslint-disable-next-line rule */ on its own line", () => {
        const input = [
            "/* eslint-disable-next-line max-len */",
            'const y = "long"',
            ""
        ].join("\n")
        const expected = ['const y = "long"', ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes /* eslint-disable-line rule */ on its own line", () => {
        const input = [
            "/* eslint-disable-line no-console */",
            "console.log('hi')",
            ""
        ].join("\n")
        const expected = ["console.log('hi')", ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })
})
// #endregion

// #region removeEslintDirectives — inline block comments
describe("removeEslintDirectives — inline block comments", () => {
    it("removes an inline /* eslint-disable-next-line */ comment", () => {
        const input = [
            "<Path",
            "    /* eslint-disable-next-line max-len */",
            '    d="M7.6 3.6"',
            "/>"
        ].join("\n")
        const expected = [
            "<Path",
            '    d="M7.6 3.6"',
            "/>"
        ].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes an inline /* eslint-disable */ between tokens", () => {
        const input = "const x = /* eslint-disable */ foo() /* eslint-enable */\n"
        const expected = "const x = foo()\n"
        expect(removeEslintDirectives(input)).toBe(expected)
    })
})
// #endregion

// #region removeEslintDirectives — realistic TSX component (ReportDetailsContentTitle)
describe("removeEslintDirectives — realistic TSX component", () => {
    it("removes the eslint-disable-next-line from the example ReportDetailsContentTitle file", () => {
        const input = [
            'import { SeverityLevel } from "@/@types/base/logging"',
            'import EditableTitle from "@components/inputs/EditableTitle"',
            "",
            "export default function ReportDetailsContentTitle() {",
            "    // #region Contexts",
            "    const { report, renderAsPdf, tw, isReadOnly } = useReportDetails()",
            "    // #endregion",
            "",
            "    if (renderAsPdf)",
            "        return (",
            '            <View style={tw("flex flex-row px-[8px]")}>',
            '                <Svg width="10.18" height="10.18" viewBox="0 0 16 16" fill="none" style={tw("self-end")}>',
            "                    <Path",
            "                        // eslint-disable-next-line max-len",
            '                        d="M7.62509 3.61702"',
            '                        fill="#BCBCBC"',
            "                    />",
            "                </Svg>",
            "            </View>",
            "        )",
            "",
            "    return (",
            '        <div className="flex" id="div--report-title">',
            "            <p>{report.title}</p>",
            "        </div>",
            "    )",
            "}",
            ""
        ].join("\n")

        const expected = [
            'import { SeverityLevel } from "@/@types/base/logging"',
            'import EditableTitle from "@components/inputs/EditableTitle"',
            "",
            "export default function ReportDetailsContentTitle() {",
            "    // #region Contexts",
            "    const { report, renderAsPdf, tw, isReadOnly } = useReportDetails()",
            "    // #endregion",
            "",
            "    if (renderAsPdf)",
            "        return (",
            '            <View style={tw("flex flex-row px-[8px]")}>',
            '                <Svg width="10.18" height="10.18" viewBox="0 0 16 16" fill="none" style={tw("self-end")}>',
            "                    <Path",
            '                        d="M7.62509 3.61702"',
            '                        fill="#BCBCBC"',
            "                    />",
            "                </Svg>",
            "            </View>",
            "        )",
            "",
            "    return (",
            '        <div className="flex" id="div--report-title">',
            "            <p>{report.title}</p>",
            "        </div>",
            "    )",
            "}",
            ""
        ].join("\n")

        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes multiple different directive forms from a single file", () => {
        const input = [
            "/* eslint-disable max-len */",
            "import Something from './something'",
            "",
            "export default function Component() {",
            "    // eslint-disable-next-line no-unused-vars",
            "    const unused = 42",
            '    console.log("test") // eslint-disable-line no-console',
            "    return null",
            "}",
            "/* eslint-enable max-len */",
            ""
        ].join("\n")

        const expected = [
            "import Something from './something'",
            "",
            "export default function Component() {",
            "    const unused = 42",
            '    console.log("test")',
            "    return null",
            "}",
            ""
        ].join("\n")

        expect(removeEslintDirectives(input)).toBe(expected)
    })
})
// #endregion

// #region removeEslintDirectives — safety and idempotency
describe("removeEslintDirectives — safety", () => {
    it("returns the input unchanged when there are no eslint directives", () => {
        const input = [
            "const x = 1",
            "const y = 2",
            "export default x + y",
            ""
        ].join("\n")
        expect(removeEslintDirectives(input)).toBe(input)
    })

    it("returns empty input unchanged", () => {
        expect(removeEslintDirectives("")).toBe("")
    })

    it("is idempotent", () => {
        const input = [
            "// eslint-disable-next-line max-len",
            'const x = "long"',
            "/* eslint-disable no-console */",
            "console.log('hi')",
            "/* eslint-enable no-console */",
            ""
        ].join("\n")
        const once = removeEslintDirectives(input)
        const twice = removeEslintDirectives(once)
        expect(twice).toBe(once)
    })

    it("does not touch regular comments that mention eslint", () => {
        const input = [
            "// This comment mentions eslint but is not a directive",
            "// See: eslint-disable is used for...",
            "const x = 1",
            ""
        ].join("\n")
        expect(removeEslintDirectives(input)).toBe(input)
    })

    it("does not touch comments that contain 'eslint' in other words", () => {
        const input = [
            "// TODO: re-enable eslint rule later",
            "// the eslint config needs updating",
            "const x = 1",
            ""
        ].join("\n")
        expect(removeEslintDirectives(input)).toBe(input)
    })

    it("preserves non-eslint-directive block comments", () => {
        const input = [
            "/* This is a normal block comment */",
            "const x = 1",
            "/** JSDoc comment */",
            "function foo() {}",
            ""
        ].join("\n")
        expect(removeEslintDirectives(input)).toBe(input)
    })

    it("preserves region comments", () => {
        const input = [
            "// #region States",
            "const [x, setX] = useState(0)",
            "// #endregion",
            ""
        ].join("\n")
        expect(removeEslintDirectives(input)).toBe(input)
    })

    it("handles code that has only eslint directives", () => {
        const input = [
            "/* eslint-disable */",
            "// eslint-disable-next-line max-len",
            "/* eslint-enable */",
            ""
        ].join("\n")
        const result = removeEslintDirectives(input)
        expect(result.trim()).toBe("")
    })
})
// #endregion

// #region removeEslintDirectives — edge cases
describe("removeEslintDirectives — edge cases", () => {
    it("handles Windows-style line endings (CRLF)", () => {
        const input = "// eslint-disable-next-line max-len\r\nconst x = 1\r\n"
        const expected = "const x = 1\r\n"
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes eslint-disable with extra whitespace", () => {
        const input = "/*  eslint-disable  no-console  */\nconsole.log('hi')\n"
        const expected = "console.log('hi')\n"
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes multiple directives on consecutive lines", () => {
        const input = [
            "// eslint-disable-next-line max-len",
            "// eslint-disable-next-line no-unused-vars",
            "const x = 1",
            ""
        ].join("\n")
        const expected = ["const x = 1", ""].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("removes eslint-disable / eslint-enable wrapping entire file", () => {
        const input = [
            "/* eslint-disable */",
            "const a = 1",
            "const b = 2",
            "/* eslint-enable */",
            ""
        ].join("\n")
        const expected = [
            "const a = 1",
            "const b = 2",
            ""
        ].join("\n")
        expect(removeEslintDirectives(input)).toBe(expected)
    })

    it("handles tab-indented directives", () => {
        const input = "\t// eslint-disable-next-line max-len\n\tconst x = 1\n"
        const expected = "\tconst x = 1\n"
        expect(removeEslintDirectives(input)).toBe(expected)
    })
})
// #endregion
