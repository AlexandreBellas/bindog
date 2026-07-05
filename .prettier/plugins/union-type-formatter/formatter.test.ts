import { describe, expect, it } from "vitest"
import { formatUnionTypes } from "./formatter.mjs"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Trims leading/trailing blank lines and normalises indentation of a
 * multi-line template-literal test string for easy comparison.
 */
function dedent(str: string): string {
    const lines = str.split("\n")
    while (lines.length > 0 && lines[0].trim() === "") lines.shift()
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop()
    const minIndent = lines
        .filter(l => l.trim() !== "")
        .reduce((acc, l) => Math.min(acc, /^(\s*)/.exec(l)![1].length), Infinity)
    return lines.map(l => l.slice(minIndent)).join("\n")
}

/**
 * Normalises whitespace for structural comparison (collapses runs of
 * whitespace into a single space, trims ends).
 */
function normalize(str: string): string {
    return str.replace(/\s+/g, " ").trim()
}

/**
 * When the expected output references `IKeyable` but does not already import
 * it, automatically inject `import { IKeyable } from "@utils/types/keyable"`
 * after the last existing import (or at the top when there are no imports).
 * This mirrors what `formatUnionTypes` does for real files, so individual
 * test cases don't need to repeat the boilerplate import line.
 */
const IKEYABLE_IMPORT_LINE = 'import { IKeyable } from "@utils/types/keyable"'

function injectIKeyableImport(expected: string): string {
    if (!expected.includes("IKeyable")) return expected
    if (expected.includes("@utils/types/keyable")) return expected

    const lines = expected.split("\n")
    let lastImportIdx = -1
    for (let i = 0; i < lines.length; i++) if (/^\s*import\s/.test(lines[i])) lastImportIdx = i

    if (lastImportIdx === -1) return IKEYABLE_IMPORT_LINE + "\n" + expected

    const result = [...lines]
    result.splice(lastImportIdx + 1, 0, IKEYABLE_IMPORT_LINE)
    return result.join("\n")
}

function expectFormatted(input: string, expected: string): void {
    const result = formatUnionTypes(dedent(input))
    const fullExpected = injectIKeyableImport(dedent(expected))
    expect(normalize(result)).toBe(normalize(fullExpected))
}

/**
 * Like `expectFormatted` but does NOT inject the IKeyable import into the
 * expected output. Use when the formatter should NOT add the import (e.g.
 * when the input already contains IKeyable references and the formatter's
 * own edits do not introduce any new ones).
 */
function expectFormattedRaw(input: string, expected: string): void {
    const result = formatUnionTypes(dedent(input))
    expect(normalize(result)).toBe(normalize(dedent(expected)))
}

function expectUnchanged(input: string): void {
    const dedented = dedent(input)
    expect(normalize(formatUnionTypes(dedented))).toBe(normalize(dedented))
}

// ---------------------------------------------------------------------------
// Case A: const string array alone → generates derived type + pascal const
// ---------------------------------------------------------------------------

describe("formatUnionTypes — Case A: const array alone", () => {
    it("generates type and pascal const after a simple exported array", () => {
        expectFormatted(
            `
            export const colors = ["red", "blue"] as const
            `,
            `
            export const colors = ["red", "blue"] as const
            export type IColor = (typeof colors)[number]
            export const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            `
        )
    })

    it("generates type and pascal const after a non-exported array", () => {
        expectFormatted(
            `
            const layouts = ["grid", "list"] as const
            `,
            `
            const layouts = ["grid", "list"] as const
            type ILayout = (typeof layouts)[number]
            const Layout = {
                Grid: "grid",
                List: "list"
            } as const satisfies Record<IKeyable<ILayout>, ILayout>
            `
        )
    })

    it("handles snake_case values correctly", () => {
        expectFormatted(
            `
            const chartDisplayValues = ["bar_chart", "stacked_bar"] as const
            `,
            `
            const chartDisplayValues = ["bar_chart", "stacked_bar"] as const
            type IChartDisplayValue = (typeof chartDisplayValues)[number]
            const ChartDisplayValue = {
                BarChart: "bar_chart",
                StackedBar: "stacked_bar"
            } as const satisfies Record<IKeyable<IChartDisplayValue>, IChartDisplayValue>
            `
        )
    })

    it("handles a single-value array", () => {
        expectFormatted(
            `
            const flags = ["on"] as const
            `,
            `
            const flags = ["on"] as const
            type IFlag = (typeof flags)[number]
            const Flag = {
                On: "on"
            } as const satisfies Record<IKeyable<IFlag>, IFlag>
            `
        )
    })

    it("preserves other top-level code before and after the array", () => {
        expectFormatted(
            `
            import { foo } from "./foo"
            const colors = ["red", "blue"] as const
            export default {}
            `,
            `
            import { foo } from "./foo"
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            export default {}
            `
        )
    })

    it("handles an array with as const satisfies annotation", () => {
        expectFormatted(
            `
            const sizes = ["small", "large"] as const satisfies string[]
            `,
            `
            const sizes = ["small", "large"] as const satisfies string[]
            type ISize = (typeof sizes)[number]
            const Size = {
                Small: "small",
                Large: "large"
            } as const satisfies Record<IKeyable<ISize>, ISize>
            `
        )
    })

    it("handles multiple unrelated arrays in the same file", () => {
        expectFormatted(
            `
            const colors = ["red", "blue"] as const
            const sizes = ["sm", "lg"] as const
            `,
            `
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            const sizes = ["sm", "lg"] as const
            type ISize = (typeof sizes)[number]
            const Size = {
                Sm: "sm",
                Lg: "lg"
            } as const satisfies Record<IKeyable<ISize>, ISize>
            `
        )
    })
})

// ---------------------------------------------------------------------------
// Case B: raw string union type → generates const array + derived type + pascal const
// ---------------------------------------------------------------------------

describe("formatUnionTypes — Case B: raw union type", () => {
    it("expands an exported raw union into the full triplet", () => {
        expectFormatted(
            `
            export type IColor = "red" | "blue"
            `,
            `
            export const colors = ["red", "blue"] as const
            export type IColor = (typeof colors)[number]
            export const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            `
        )
    })

    it("expands a non-exported raw union", () => {
        expectFormatted(
            `
            type ILayout = "grid" | "list" | "detail"
            `,
            `
            const layouts = ["grid", "list", "detail"] as const
            type ILayout = (typeof layouts)[number]
            const Layout = {
                Grid: "grid",
                List: "list",
                Detail: "detail"
            } as const satisfies Record<IKeyable<ILayout>, ILayout>
            `
        )
    })

    it("handles snake_case union values", () => {
        expectFormatted(
            `
            type IChartType = "bar_chart" | "line_chart"
            `,
            `
            const chartTypes = ["bar_chart", "line_chart"] as const
            type IChartType = (typeof chartTypes)[number]
            const ChartType = {
                BarChart: "bar_chart",
                LineChart: "line_chart"
            } as const satisfies Record<IKeyable<IChartType>, IChartType>
            `
        )
    })

    it("handles a raw union with a correctly-shaped pascal const already following it", () => {
        // The formatter replaces only the raw union type (inserts const array + derived type)
        // but keeps the pre-existing pascal const unchanged. Because none of the formatter's
        // EDITS introduce IKeyable — only the pre-existing const does — it does NOT inject
        // the IKeyable import. The output is technically incomplete (IKeyable used but not
        // imported), but the formatter does not try to fix pre-existing broken state.
        expectFormattedRaw(
            `
            export type IColor = "red" | "blue"
            export const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            `,
            `
            export const colors = ["red", "blue"] as const
            export type IColor = (typeof colors)[number]
            export const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            `
        )
    })

    it("handles multiple raw unions in the same file", () => {
        expectFormatted(
            `
            type IColor = "red" | "blue"
            type ISize = "sm" | "lg"
            `,
            `
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            const sizes = ["sm", "lg"] as const
            type ISize = (typeof sizes)[number]
            const Size = {
                Sm: "sm",
                Lg: "lg"
            } as const satisfies Record<IKeyable<ISize>, ISize>
            `
        )
    })

    it("raw union with two members generates correctly", () => {
        expectFormatted(
            `
            type IDir = "north" | "south"
            `,
            `
            const dirs = ["north", "south"] as const
            type IDir = (typeof dirs)[number]
            const Dir = {
                North: "north",
                South: "south"
            } as const satisfies Record<IKeyable<IDir>, IDir>
            `
        )
    })
})

// ---------------------------------------------------------------------------
// Case C: const array + derived type (missing pascal const)
// ---------------------------------------------------------------------------

describe("formatUnionTypes — Case C: const array + derived type, missing pascal const", () => {
    it("adds the missing pascal const after the derived type (exported)", () => {
        expectFormatted(
            `
            export const colors = ["red", "blue"] as const
            export type IColor = (typeof colors)[number]
            `,
            `
            export const colors = ["red", "blue"] as const
            export type IColor = (typeof colors)[number]
            export const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            `
        )
    })

    it("adds the missing pascal const after the derived type (non-exported)", () => {
        expectFormatted(
            `
            const layouts = ["grid", "list"] as const
            type ILayout = (typeof layouts)[number]
            `,
            `
            const layouts = ["grid", "list"] as const
            type ILayout = (typeof layouts)[number]
            const Layout = {
                Grid: "grid",
                List: "list"
            } as const satisfies Record<IKeyable<ILayout>, ILayout>
            `
        )
    })

    it("handles snake_case values when adding missing pascal const", () => {
        expectFormatted(
            `
            const chartDisplayValues = ["bar_chart", "crosstab"] as const
            type IChartDisplay = (typeof chartDisplayValues)[number]
            `,
            `
            const chartDisplayValues = ["bar_chart", "crosstab"] as const
            type IChartDisplay = (typeof chartDisplayValues)[number]
            const ChartDisplay = {
                BarChart: "bar_chart",
                Crosstab: "crosstab"
            } as const satisfies Record<IKeyable<IChartDisplay>, IChartDisplay>
            `
        )
    })

    it("adds pascal const with correct export when array is exported but type is not", () => {
        expectFormatted(
            `
            export const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            `,
            `
            export const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            export const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            `
        )
    })

    it("handles multiple pairs in the same file", () => {
        expectFormatted(
            `
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            const sizes = ["sm", "lg"] as const
            type ISize = (typeof sizes)[number]
            `,
            `
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            const sizes = ["sm", "lg"] as const
            type ISize = (typeof sizes)[number]
            const Size = {
                Sm: "sm",
                Lg: "lg"
            } as const satisfies Record<IKeyable<ISize>, ISize>
            `
        )
    })
})

// ---------------------------------------------------------------------------
// Case D: complete triplet — idempotency (should not be modified)
// ---------------------------------------------------------------------------

describe("formatUnionTypes — Case D: already complete triplet (idempotent)", () => {
    it("leaves a fully correct exported triplet unchanged", () => {
        expectUnchanged(`
            export const colors = ["red", "blue"] as const
            export type IColor = (typeof colors)[number]
            export const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
        `)
    })

    it("leaves a fully correct non-exported triplet unchanged", () => {
        expectUnchanged(`
            const layouts = ["grid", "list"] as const
            type ILayout = (typeof layouts)[number]
            const Layout = {
                Grid: "grid",
                List: "list"
            } as const satisfies Record<IKeyable<ILayout>, ILayout>
        `)
    })

    it("leaves multiple complete triplets unchanged", () => {
        expectUnchanged(`
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>

            const sizes = ["sm", "lg"] as const
            type ISize = (typeof sizes)[number]
            const Size = {
                Sm: "sm",
                Lg: "lg"
            } as const satisfies Record<IKeyable<ISize>, ISize>
        `)
    })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("formatUnionTypes — edge cases", () => {
    it("does not modify a const-only object (the exception case)", () => {
        expectUnchanged(`
            export const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
        `)
    })

    it("does not touch arrays containing non-string elements", () => {
        expectUnchanged(`
            const nums = [1, 2, 3] as const
        `)
    })

    it("does not expand a plain array without as const assertion", () => {
        expectUnchanged(`
            const colors = ["red", "blue"]
        `)
    })

    it("does not expand a let array even with as const assertion", () => {
        // let declarations don't match the `const` kind requirement
        expectUnchanged(`
            let colors = ["red", "blue"] as const
        `)
    })

    it("does not touch arrays with spread elements", () => {
        expectUnchanged(`
            const all = [...fooItems, ...barItems] as const
        `)
    })

    it("does not touch arrays with mixed string and spread elements", () => {
        expectUnchanged(`
            const all = ["a", ...other] as const
        `)
    })

    it("does not touch a raw union type with a non-string member", () => {
        expectUnchanged(`
            type IMixed = "a" | 1
        `)
    })

    it("does not touch a single-literal type alias", () => {
        expectUnchanged(`
            type ISingle = "only"
        `)
    })

    it("does not touch a non-union type alias", () => {
        expectUnchanged(`
            type IFoo = string
        `)
    })

    it("does not expand an array that is already referenced by a derived type elsewhere in the file", () => {
        // The array is referenced by a type, but NOT immediately followed by it.
        // The formatter should NOT generate a duplicate type; the ESLint rule handles the non-adjacency.
        expectUnchanged(`
            const colors = ["red", "blue"] as const
            const otherDecl = 1
            type IColor = (typeof colors)[number]
            const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
        `)
    })

    it("is a no-op on an empty string", () => {
        expect(formatUnionTypes("")).toBe("")
    })

    it("returns input unchanged on a parse error", () => {
        const bad = "type IFoo = {"
        expect(formatUnionTypes(bad)).toBe(bad)
    })

    it("leaves unrelated top-level declarations intact", () => {
        expectUnchanged(`
            import { something } from "./other"
            export interface IFoo { bar: string }
            export function helper() { return 1 }
        `)
    })

    it("handles a file with only imports and exports", () => {
        expectUnchanged(`
            export * from "./api/artefacts"
            export type { IArtefact } from "./db/projects/artefacts"
        `)
    })

    it("is idempotent — running twice on already-formatted output yields the same result", () => {
        const input = dedent(`
            export type IColor = "red" | "blue"
        `)
        const once = formatUnionTypes(input)
        const twice = formatUnionTypes(once)
        expect(normalize(twice)).toBe(normalize(once))
    })

    it("is idempotent — running twice on const-array input yields the same result", () => {
        const input = dedent(`
            const colors = ["red", "blue"] as const
        `)
        const once = formatUnionTypes(input)
        const twice = formatUnionTypes(once)
        expect(normalize(twice)).toBe(normalize(once))
    })

    it("handles a raw union type preceded by unrelated code", () => {
        expectFormatted(
            `
            interface IFoo { bar: string }
            type IColor = "red" | "blue"
            `,
            `
            interface IFoo { bar: string }
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            `
        )
    })
})

// ---------------------------------------------------------------------------
// Real-world-style scenarios
// ---------------------------------------------------------------------------

describe("formatUnionTypes — realistic scenarios", () => {
    it("formats a file with a mix of complete and incomplete groups", () => {
        // Input already has IKeyable (in the complete SeverityLevel group) but also
        // needs a new pascal const for IStatus. Since the formatter's edits DO introduce
        // IKeyable (for the new IStatus pascal const), the import is injected.
        expectFormattedRaw(
            `
            export const severityLevels = ["fatal", "error", "warning"] as const
            export type ISeverityLevel = (typeof severityLevels)[number]
            export const SeverityLevel = {
                Fatal: "fatal",
                Error: "error",
                Warning: "warning"
            } as const satisfies Record<IKeyable<ISeverityLevel>, ISeverityLevel>

            export type IStatus = "active" | "inactive"
            `,
            `
            import { IKeyable } from "@utils/types/keyable"
            export const severityLevels = ["fatal", "error", "warning"] as const
            export type ISeverityLevel = (typeof severityLevels)[number]
            export const SeverityLevel = {
                Fatal: "fatal",
                Error: "error",
                Warning: "warning"
            } as const satisfies Record<IKeyable<ISeverityLevel>, ISeverityLevel>

            export const statuses = ["active", "inactive"] as const
            export type IStatus = (typeof statuses)[number]
            export const Status = {
                Active: "active",
                Inactive: "inactive"
            } as const satisfies Record<IKeyable<IStatus>, IStatus>
            `
        )
    })

    it("handles const array followed by derived type but missing pascal const alongside a complete group", () => {
        // Input already has IKeyable (in the complete Size group) but the colors pair
        // is missing its pascal const. Since the formatter's edits DO introduce IKeyable
        // (for the new Color pascal const), the import is injected.
        expectFormattedRaw(
            `
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]

            const sizes = ["sm", "lg"] as const
            type ISize = (typeof sizes)[number]
            const Size = {
                Sm: "sm",
                Lg: "lg"
            } as const satisfies Record<IKeyable<ISize>, ISize>
            `,
            `
            import { IKeyable } from "@utils/types/keyable"
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>

            const sizes = ["sm", "lg"] as const
            type ISize = (typeof sizes)[number]
            const Size = {
                Sm: "sm",
                Lg: "lg"
            } as const satisfies Record<IKeyable<ISize>, ISize>
            `
        )
    })

    it("formats a canonical artefact-types example", () => {
        expectFormatted(
            `
            export const artefactTypes = ["text", "slides", "table"] as const
            `,
            `
            export const artefactTypes = ["text", "slides", "table"] as const
            export type IArtefactType = (typeof artefactTypes)[number]
            export const ArtefactType = {
                Text: "text",
                Slides: "slides",
                Table: "table"
            } as const satisfies Record<IKeyable<IArtefactType>, IArtefactType>
            `
        )
    })
})

// ---------------------------------------------------------------------------
// Pluralisation — typeNameToArrayName edge cases
// ---------------------------------------------------------------------------

describe("formatUnionTypes — pluralisation of array names from type names", () => {
    it('appends "es" when the camelCase base already ends with "s" (IStatus → statuses)', () => {
        expectFormatted(
            `
            export type IStatus = "active" | "inactive"
            `,
            `
            export const statuses = ["active", "inactive"] as const
            export type IStatus = (typeof statuses)[number]
            export const Status = {
                Active: "active",
                Inactive: "inactive"
            } as const satisfies Record<IKeyable<IStatus>, IStatus>
            `
        )
    })

    it('appends "es" for IAddress → addresses (double-s case)', () => {
        expectFormatted(
            `
            type IAddress = "home" | "work"
            `,
            `
            const addresses = ["home", "work"] as const
            type IAddress = (typeof addresses)[number]
            const Address = {
                Home: "home",
                Work: "work"
            } as const satisfies Record<IKeyable<IAddress>, IAddress>
            `
        )
    })

    it('appends "es" for IClass → classes (ends with s)', () => {
        expectFormatted(
            `
            type IClass = "primary" | "secondary"
            `,
            `
            const classes = ["primary", "secondary"] as const
            type IClass = (typeof classes)[number]
            const Class = {
                Primary: "primary",
                Secondary: "secondary"
            } as const satisfies Record<IKeyable<IClass>, IClass>
            `
        )
    })

    it('appends plain "s" when the base does not end with "s" (IColor → colors)', () => {
        expectFormatted(
            `
            type IColor = "red" | "blue"
            `,
            `
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            `
        )
    })

    it('appends "es" for IProcess → processes (base ends with s)', () => {
        expectFormatted(
            `
            type IProcess = "build" | "test"
            `,
            `
            const processes = ["build", "test"] as const
            type IProcess = (typeof processes)[number]
            const Process = {
                Build: "build",
                Test: "test"
            } as const satisfies Record<IKeyable<IProcess>, IProcess>
            `
        )
    })
})

// ---------------------------------------------------------------------------
// Roundtrip: arrayNameToTypeName ↔ typeNameToArrayName
// Tests that starting from a const array with an "es"-pluralised name derives
// the correct type name (not a truncated "IStatuse" / "IAddresse" form).
// ---------------------------------------------------------------------------

describe("formatUnionTypes — roundtrip: const array with es-plural name", () => {
    it("const statuses → derives IStatus, not IStatuse", () => {
        expectFormatted(
            `
            const statuses = ["active", "inactive"] as const
            `,
            `
            const statuses = ["active", "inactive"] as const
            type IStatus = (typeof statuses)[number]
            const Status = {
                Active: "active",
                Inactive: "inactive"
            } as const satisfies Record<IKeyable<IStatus>, IStatus>
            `
        )
    })

    it("const addresses → derives IAddress, not IAddresse", () => {
        expectFormatted(
            `
            const addresses = ["home", "work"] as const
            `,
            `
            const addresses = ["home", "work"] as const
            type IAddress = (typeof addresses)[number]
            const Address = {
                Home: "home",
                Work: "work"
            } as const satisfies Record<IKeyable<IAddress>, IAddress>
            `
        )
    })

    it("const classes → derives IClass, not IClasse", () => {
        expectFormatted(
            `
            const classes = ["primary", "secondary"] as const
            `,
            `
            const classes = ["primary", "secondary"] as const
            type IClass = (typeof classes)[number]
            const Class = {
                Primary: "primary",
                Secondary: "secondary"
            } as const satisfies Record<IKeyable<IClass>, IClass>
            `
        )
    })

    it("const processes → derives IProcess, not IProcesse", () => {
        expectFormatted(
            `
            const processes = ["build", "test"] as const
            `,
            `
            const processes = ["build", "test"] as const
            type IProcess = (typeof processes)[number]
            const Process = {
                Build: "build",
                Test: "test"
            } as const satisfies Record<IKeyable<IProcess>, IProcess>
            `
        )
    })

    it("const colors → still derives IColor (plain-s stripping unaffected)", () => {
        expectFormatted(
            `
            const colors = ["red", "blue"] as const
            `,
            `
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
            `
        )
    })
})

// ---------------------------------------------------------------------------
// IKeyable import injection
// ---------------------------------------------------------------------------

describe("formatUnionTypes — IKeyable import injection", () => {
    it("injects the IKeyable import when a raw union is expanded (no existing imports)", () => {
        const input = dedent(`
            type IColor = "red" | "blue"
        `)
        const result = formatUnionTypes(input)
        expect(result).toContain('import { IKeyable } from "@utils/types/keyable"')
    })

    it("injects the IKeyable import after the last existing import", () => {
        const input = dedent(`
            import { something } from "./other"
            type IColor = "red" | "blue"
        `)
        const result = formatUnionTypes(input)
        const lines = result.split("\n")
        const importLineIndex = lines.findIndex(l => l.includes('"@utils/types/keyable"'))
        const existingImportIndex = lines.findIndex(l => l.includes('"./other"'))
        expect(importLineIndex).toBeGreaterThan(existingImportIndex)
        expect(result).toContain('import { IKeyable } from "@utils/types/keyable"')
    })

    it("injects the IKeyable import when const array is expanded (no existing imports)", () => {
        const input = dedent(`
            const colors = ["red", "blue"] as const
        `)
        const result = formatUnionTypes(input)
        expect(result).toContain('import { IKeyable } from "@utils/types/keyable"')
    })

    it("injects the IKeyable import when pascal const is missing from a pair", () => {
        const input = dedent(`
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
        `)
        const result = formatUnionTypes(input)
        expect(result).toContain('import { IKeyable } from "@utils/types/keyable"')
    })

    it("does NOT inject a duplicate import when IKeyable is already imported", () => {
        const input = dedent(`
            import { IKeyable } from "@utils/types/keyable"
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
        `)
        const result = formatUnionTypes(input)
        const occurrences = (result.match(/@utils\/types\/keyable/g) || []).length
        expect(occurrences).toBe(1)
    })

    it("does NOT inject import when the file is already complete (no edits needed)", () => {
        const input = dedent(`
            import { IKeyable } from "@utils/types/keyable"
            const colors = ["red", "blue"] as const
            type IColor = (typeof colors)[number]
            const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
        `)
        const result = formatUnionTypes(input)
        expect(normalize(result)).toBe(normalize(input))
    })

    it("does NOT inject import when only pre-existing IKeyable is present in source and formatter makes no IKeyable edits", () => {
        // The raw union is replaced with const array + derived type (no IKeyable in those edits).
        // The pre-existing pascal const (which uses IKeyable) is kept unchanged.
        // Formatter correctly does not inject the import.
        const input = dedent(`
            export type IColor = "red" | "blue"
            export const Color = {
                Red: "red",
                Blue: "blue"
            } as const satisfies Record<IKeyable<IColor>, IColor>
        `)
        const result = formatUnionTypes(input)
        expect(result).not.toContain("@utils/types/keyable")
    })

    it("result is idempotent with import injection", () => {
        const input = dedent(`
            type IColor = "red" | "blue"
        `)
        const once = formatUnionTypes(input)
        const twice = formatUnionTypes(once)
        expect(normalize(twice)).toBe(normalize(once))
    })
})
