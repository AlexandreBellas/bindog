import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./enforce-union-types-source-of-truth"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaFeatures: { jsx: false }
        }
    }
})

const VALID_PAIR = [
    'export const artefactTypes = ["text", "slides", "table"] as const',
    "export type IArtefactType = (typeof artefactTypes)[number]",
    "export const ArtefactType = {",
    '    Text: "text",',
    '    Slides: "slides",',
    '    Table: "table"',
    "} as const satisfies Record<IKeyable<IArtefactType>, IArtefactType>"
].join("\n")

ruleTester.run("enforce-union-types-source-of-truth", rule, {
    valid: [
        // --- The canonical valid shape (exported, from artefacts.ts) ---
        {
            name: "canonical exported pattern with three string members",
            code: VALID_PAIR
        },

        // --- Non-exported variant of the canonical shape ---
        {
            name: "non-exported variant of the canonical shape",
            code: [
                'const colors = ["red", "green", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Green: "green",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n")
        },

        // --- Mixed export/non-export adjacency works ---
        {
            name: "exported array, non-exported type and pascal const",
            code: [
                'export const sizes = ["small", "large"] as const',
                "type ISize = (typeof sizes)[number]",
                "const Size = {",
                '    Small: "small",',
                '    Large: "large"',
                "} as const satisfies Record<IKeyable<ISize>, ISize>"
            ].join("\n")
        },

        // --- Multi-character first letter values stay PascalCase via IKeyable ---
        {
            name: "values starting with multiple letters",
            code: [
                'export const layouts = ["row", "column", "grid"] as const',
                "export type ILayout = (typeof layouts)[number]",
                "export const Layout = {",
                '    Row: "row",',
                '    Column: "column",',
                '    Grid: "grid"',
                "} as const satisfies Record<IKeyable<ILayout>, ILayout>"
            ].join("\n")
        },

        // --- snake_case values get converted to PascalCase keys ---
        {
            name: "snake_case values map to PascalCase keys (single underscore)",
            code: [
                'export const chartDisplayValues = ["bar_chart", "stacked_bar", "crosstab"] as const',
                "export type IChartDisplay = (typeof chartDisplayValues)[number]",
                "export const ChartDisplay = {",
                '    BarChart: "bar_chart",',
                '    StackedBar: "stacked_bar",',
                '    Crosstab: "crosstab"',
                "} as const satisfies Record<IKeyable<IChartDisplay>, IChartDisplay>"
            ].join("\n")
        },
        {
            name: "snake_case values with multiple underscores collapse into PascalCase",
            code: [
                'const compoundKinds = ["a_b_c", "simple"] as const',
                "type ICompoundKind = (typeof compoundKinds)[number]",
                "const CompoundKind = {",
                '    ABC: "a_b_c",',
                '    Simple: "simple"',
                "} as const satisfies Record<IKeyable<ICompoundKind>, ICompoundKind>"
            ].join("\n")
        },
        {
            name: "snake_case and non-snake values mixed in the same union",
            code: [
                'const eventKinds = ["click", "double_click", "long_press"] as const',
                "type IEventKind = (typeof eventKinds)[number]",
                "const EventKind = {",
                '    Click: "click",',
                '    DoubleClick: "double_click",',
                '    LongPress: "long_press"',
                "} as const satisfies Record<IKeyable<IEventKind>, IEventKind>"
            ].join("\n")
        },

        // --- kebab-case values get converted to PascalCase keys ---
        {
            name: "kebab-case values map to PascalCase keys",
            code: [
                'export const errorModes = ["pre-generation", "mid-generation"] as const',
                "export type IErrorMode = (typeof errorModes)[number]",
                "export const ErrorMode = {",
                '    PreGeneration: "pre-generation",',
                '    MidGeneration: "mid-generation"',
                "} as const satisfies Record<IKeyable<IErrorMode>, IErrorMode>"
            ].join("\n")
        },
        {
            name: "kebab-case and snake_case values mixed in the same union",
            code: [
                'const mixedModes = ["pre-generation", "mid_generation"] as const',
                "type IMixedMode = (typeof mixedModes)[number]",
                "const MixedMode = {",
                '    PreGeneration: "pre-generation",',
                '    MidGeneration: "mid_generation"',
                "} as const satisfies Record<IKeyable<IMixedMode>, IMixedMode>"
            ].join("\n")
        },

        // --- Source array with `as const satisfies Type[]` ---
        {
            name: "source array using `as const satisfies SomeType[]` is accepted",
            code: [
                'export const colors = ["red", "green", "blue"] as const satisfies string[]',
                "export type IColor = (typeof colors)[number]",
                "export const Color = {",
                '    Red: "red",',
                '    Green: "green",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n")
        },
        {
            name: "source array using `as const satisfies` with a custom type is accepted",
            code: [
                'export const modes = ["fast", "slow"] as const satisfies ReadonlyArray<string>',
                "export type IMode = (typeof modes)[number]",
                "export const Mode = {",
                '    Fast: "fast",',
                '    Slow: "slow"',
                "} as const satisfies Record<IKeyable<IMode>, IMode>"
            ].join("\n")
        },

        // --- Non-string-union type aliases must be ignored ---
        {
            name: "type alias whose RHS is a number union is ignored",
            code: "type INumber = 1 | 2 | 3"
        },
        {
            name: "type alias whose RHS is a single string literal is ignored",
            code: 'type ISingle = "only"'
        },
        {
            name: "type alias mixing string and number literals is ignored",
            code: 'type IMixed = "a" | 1'
        },
        {
            name: "type alias referencing an interface is ignored",
            code: ["interface IFoo { x: number }", "type IFooAlias = IFoo"].join("\n")
        },
        {
            name: "indexed access without typeof is ignored",
            code: ["interface IBag { a: string; b: number }", "type IBagValue = IBag[keyof IBag]"].join("\n")
        },
        {
            name: "typeof indexed access targeting a non-Identifier (qualified name) is ignored",
            code: [
                "namespace ns { export const arr = ['a', 'b'] as const }",
                "type INs = (typeof ns.arr)[number]"
            ].join("\n")
        },
        {
            name: "typeof indexed access whose index is not number is ignored",
            code: ['const arr = ["a", "b"] as const', 'type IArr = (typeof arr)["length"]'].join("\n")
        },

        // --- Surrounding unrelated declarations elsewhere in the file are fine ---
        {
            name: "additional unrelated declarations elsewhere in the file",
            code: [
                "const helper = () => 1",
                "",
                'export const flags = ["on", "off"] as const',
                "export type IFlag = (typeof flags)[number]",
                "export const Flag = {",
                '    On: "on",',
                '    Off: "off"',
                "} as const satisfies Record<IKeyable<IFlag>, IFlag>",
                "",
                "function unrelated() { return 1 }"
            ].join("\n")
        },

        // --- Inside a namespace block (TSModuleBlock) ---
        {
            name: "valid pattern inside a namespace block",
            code: [
                "namespace inner {",
                '    export const sides = ["a", "b"] as const',
                "    export type ISide = (typeof sides)[number]",
                "    export const Side = {",
                '        A: "a",',
                '        B: "b"',
                "    } as const satisfies Record<IKeyable<ISide>, ISide>",
                "}"
            ].join("\n")
        },

        // --- Type alias nested inside a function body is ignored ---
        {
            name: "type alias declared inside a function body is not validated",
            code: ["function makeStuff() {", '    type IInner = "x" | "y"', "    return null", "}"].join("\n")
        },

        // --- Composed from other constants (spread-only array and object) ---
        {
            name: "array composed from other const arrays and object composed from other PascalCase consts",
            code: [
                'const fooItems = ["a", "b"] as const',
                "type IFoo = (typeof fooItems)[number]",
                "const Foo = {",
                '    A: "a",',
                '    B: "b"',
                "} as const satisfies Record<IKeyable<IFoo>, IFoo>",
                "",
                'const barItems = ["c", "d"] as const',
                "type IBar = (typeof barItems)[number]",
                "const Bar = {",
                '    C: "c",',
                '    D: "d"',
                "} as const satisfies Record<IKeyable<IBar>, IBar>",
                "",
                "const allItems = [...fooItems, ...barItems] as const",
                "type IAll = (typeof allItems)[number]",
                "const All = {",
                "    ...Foo,",
                "    ...Bar",
                "} as const satisfies Record<IKeyable<IAll>, IAll>"
            ].join("\n")
        },
        {
            name: "exported composed constants pattern",
            code: [
                'export const primaryColors = ["red", "blue"] as const',
                "export type IPrimaryColor = (typeof primaryColors)[number]",
                "export const PrimaryColor = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IPrimaryColor>, IPrimaryColor>",
                "",
                'export const secondaryColors = ["green", "yellow"] as const',
                "export type ISecondaryColor = (typeof secondaryColors)[number]",
                "export const SecondaryColor = {",
                '    Green: "green",',
                '    Yellow: "yellow"',
                "} as const satisfies Record<IKeyable<ISecondaryColor>, ISecondaryColor>",
                "",
                "export const allColors = [...primaryColors, ...secondaryColors] as const",
                "export type IAllColor = (typeof allColors)[number]",
                "export const AllColor = {",
                "    ...PrimaryColor,",
                "    ...SecondaryColor",
                "} as const satisfies Record<IKeyable<IAllColor>, IAllColor>"
            ].join("\n")
        },
        {
            name: "composed from a single spread still valid",
            code: [
                'const baseItems = ["x", "y"] as const',
                "type IBase = (typeof baseItems)[number]",
                "const Base = {",
                '    X: "x",',
                '    Y: "y"',
                "} as const satisfies Record<IKeyable<IBase>, IBase>",
                "",
                "const wrappedItems = [...baseItems] as const",
                "type IWrapped = (typeof wrappedItems)[number]",
                "const Wrapped = {",
                "    ...Base",
                "} as const satisfies Record<IKeyable<IWrapped>, IWrapped>"
            ].join("\n")
        },

        // --- Partially composed: own literals mixed with spreads of other constants ---
        {
            name: "array with string literals and spread, object with entries and spread",
            code: [
                'const allItems = [...fooItems, "c"] as const',
                "type IAll = (typeof allItems)[number]",
                "const All = {",
                "    ...Foo,",
                '    C: "c"',
                "} as const satisfies Record<IKeyable<IAll>, IAll>"
            ].join("\n")
        },
        {
            name: "partially composed pattern mirroring real usage (base + own tools)",
            code: [
                'export const baseToolNames = ["unknown_tool"] as const',
                "export type IBaseToolName = (typeof baseToolNames)[number]",
                "export const BaseToolName = {",
                '    UnknownTool: "unknown_tool"',
                "} as const satisfies Record<IKeyable<IBaseToolName>, IBaseToolName>",
                "",
                'export const agentToolNames = ["get_results", "get_slice", ...baseToolNames] as const',
                "export type IAgentToolName = (typeof agentToolNames)[number]",
                "export const AgentToolName = {",
                '    GetResults: "get_results",',
                '    GetSlice: "get_slice",',
                "    ...BaseToolName",
                "} as const satisfies Record<IKeyable<IAgentToolName>, IAgentToolName>"
            ].join("\n")
        },
        {
            name: "spread at the end of array and object (partial composition)",
            code: [
                'const extras = ["e", "f"] as const',
                "type IExtra = (typeof extras)[number]",
                "const Extra = {",
                '    E: "e",',
                '    F: "f"',
                "} as const satisfies Record<IKeyable<IExtra>, IExtra>",
                "",
                'const combined = ["a", "b", ...extras] as const',
                "type ICombined = (typeof combined)[number]",
                "const Combined = {",
                '    A: "a",',
                '    B: "b",',
                "    ...Extra",
                "} as const satisfies Record<IKeyable<ICombined>, ICombined>"
            ].join("\n")
        },
        {
            name: "object with only spread is still valid (pure composition, no own entries)",
            code: [
                "const allItems = [...fooItems] as const",
                "type IAll = (typeof allItems)[number]",
                "const All = {",
                "    ...Foo",
                "} as const satisfies Record<IKeyable<IAll>, IAll>"
            ].join("\n")
        },

        // --- Set source-of-truth pattern ---
        {
            name: "canonical Set pattern with three string members (exported)",
            code: [
                'export const artefactTypes = new Set(["text", "slides", "table"] as const)',
                "export type IArtefactType = ISetValues<typeof artefactTypes>",
                "export const ArtefactType = {",
                '    Text: "text",',
                '    Slides: "slides",',
                '    Table: "table"',
                "} as const satisfies Record<IKeyable<IArtefactType>, IArtefactType>"
            ].join("\n")
        },
        {
            name: "canonical Set pattern (non-exported)",
            code: [
                'const colors = new Set(["red", "green", "blue"] as const)',
                "type IColor = ISetValues<typeof colors>",
                "const Color = {",
                '    Red: "red",',
                '    Green: "green",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n")
        },
        {
            name: "Set with snake_case values maps to PascalCase keys",
            code: [
                'const chartDisplayValues = new Set(["bar_chart", "stacked_bar", "crosstab"] as const)',
                "type IChartDisplay = ISetValues<typeof chartDisplayValues>",
                "const ChartDisplay = {",
                '    BarChart: "bar_chart",',
                '    StackedBar: "stacked_bar",',
                '    Crosstab: "crosstab"',
                "} as const satisfies Record<IKeyable<IChartDisplay>, IChartDisplay>"
            ].join("\n")
        },
        {
            name: "Set pattern with single member",
            code: [
                'export const unknownToolNames = new Set(["unknown_tool"] as const)',
                "export type IUnknownToolName = ISetValues<typeof unknownToolNames>",
                "export const UnknownToolName = {",
                '    UnknownTool: "unknown_tool"',
                "} as const satisfies Record<IKeyable<IUnknownToolName>, IUnknownToolName>"
            ].join("\n")
        },
        {
            name: "Set composed purely from other const arrays does not require as const",
            code: [
                'const fooNames = ["foo_a", "foo_b"] as const',
                "type IFooName = (typeof fooNames)[number]",
                "const FooName = {",
                '    FooA: "foo_a",',
                '    FooB: "foo_b"',
                "} as const satisfies Record<IKeyable<IFooName>, IFooName>",
                "",
                'const barNames = ["bar_a"] as const',
                "type IBarName = (typeof barNames)[number]",
                "const BarName = {",
                '    BarA: "bar_a"',
                "} as const satisfies Record<IKeyable<IBarName>, IBarName>",
                "",
                "const allNames = new Set([...fooNames, ...barNames])",
                "type IAllName = ISetValues<typeof allNames>",
                "const AllName = {",
                "    ...FooName,",
                "    ...BarName",
                "} as const satisfies Record<IKeyable<IAllName>, IAllName>"
            ].join("\n")
        },
        {
            name: "Set composed purely from other const arrays also accepts optional as const",
            code: [
                'const fooNames = ["foo_a"] as const',
                "type IFooName = (typeof fooNames)[number]",
                "const FooName = {",
                '    FooA: "foo_a"',
                "} as const satisfies Record<IKeyable<IFooName>, IFooName>",
                "",
                "const allNames = new Set([...fooNames] as const)",
                "type IAllName = ISetValues<typeof allNames>",
                "const AllName = {",
                "    ...FooName",
                "} as const satisfies Record<IKeyable<IAllName>, IAllName>"
            ].join("\n")
        }
    ],
    invalid: [
        // --- Missing I prefix ---
        {
            name: "missing I prefix on a typeof-derived alias",
            code: [
                'export const colors = ["red", "blue"] as const',
                "export type Color = (typeof colors)[number]",
                "export const ColorMap = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<Color>, Color>"
            ].join("\n"),
            errors: [{ messageId: "missingIPrefix", data: { name: "Color" } }]
        },
        {
            name: "missing I prefix on a raw string union",
            code: 'type Color = "red" | "blue"',
            errors: [{ messageId: "missingIPrefix", data: { name: "Color" } }]
        },
        {
            name: "lowercase first character after I prefix is rejected",
            code: 'type Icolor = "red" | "blue"',
            errors: [{ messageId: "missingIPrefix", data: { name: "Icolor" } }]
        },
        {
            name: "type name is exactly 'I' is rejected",
            code: 'type I = "a" | "b"',
            errors: [{ messageId: "missingIPrefix", data: { name: "I" } }]
        },
        {
            name: "type name with non-PascalCase suffix is rejected",
            code: 'type IFoo_Bar = "a" | "b"',
            errors: [{ messageId: "missingIPrefix", data: { name: "IFoo_Bar" } }]
        },

        // --- Raw union (not using typeof) ---
        {
            name: "raw string union without const array source of truth",
            code: 'export type IColor = "red" | "blue"',
            errors: [{ messageId: "notUsingTypeofIndexedAccess", data: { name: "IColor" } }]
        },
        {
            name: "raw string union with three members",
            code: 'type IDir = "north" | "south" | "east"',
            errors: [{ messageId: "notUsingTypeofIndexedAccess", data: { name: "IDir" } }]
        },

        // --- Missing const array above ---
        {
            name: "no preceding statement at all",
            code: [
                "export type IColor = (typeof colors)[number]",
                "export const Color = {",
                '    Red: "red"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [{ messageId: "missingConstArrayAbove", data: { name: "IColor", expected: "colors" } }]
        },
        {
            name: "preceding statement is unrelated function declaration",
            code: [
                "function unrelated() { return 1 }",
                "export type IColor = (typeof colors)[number]",
                "export const Color = {",
                '    Red: "red"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [{ messageId: "missingConstArrayAbove", data: { name: "IColor", expected: "colors" } }]
        },
        {
            name: "preceding statement is a let declaration (wrong kind)",
            code: [
                'let colors = ["red", "blue"]',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [{ messageId: "missingConstArrayAbove", data: { name: "IColor", expected: "colors" } }]
        },
        {
            name: "preceding statement declares two consts at once",
            code: [
                'const colors = ["red", "blue"] as const, other = 1',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [{ messageId: "missingConstArrayAbove", data: { name: "IColor", expected: "colors" } }]
        },

        // --- Const array name mismatch ---
        {
            name: "preceding const has different name from typeof reference",
            code: [
                'const allColors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "constArrayNameMismatch",
                    data: { name: "IColor", referenced: "colors", actual: "allColors" }
                }
            ]
        },

        // --- Const array naming convention violation ---
        {
            name: "array name does not start with camelCase of PascalCase suffix",
            code: [
                'const otherNames = ["a"] as const',
                "type IBaseToolName = (typeof otherNames)[number]",
                "const BaseToolName = {",
                '    A: "a"',
                "} as const satisfies Record<IKeyable<IBaseToolName>, IBaseToolName>"
            ].join("\n"),
            errors: [
                {
                    messageId: "constArrayNameConventionViolation",
                    data: {
                        typeName: "IBaseToolName",
                        actual: "otherNames",
                        expectedPrefix: "baseToolName",
                        pascalName: "BaseToolName"
                    }
                }
            ]
        },
        {
            name: "array name completely unrelated to the type name",
            code: [
                'const items = ["x", "y"] as const',
                "type IColor = (typeof items)[number]",
                "const Color = {",
                '    X: "x",',
                '    Y: "y"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "constArrayNameConventionViolation",
                    data: {
                        typeName: "IColor",
                        actual: "items",
                        expectedPrefix: "color",
                        pascalName: "Color"
                    }
                }
            ]
        },

        // --- Const array missing as const ---
        {
            name: "preceding const array is missing as const",
            code: [
                'const colors = ["red", "blue"]',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "constArrayNotAsConst",
                    data: { name: "colors", typeName: "IColor" }
                }
            ]
        },
        {
            name: "preceding const uses a different `as` assertion (not const)",
            code: [
                'const colors = ["red", "blue"] as ReadonlyArray<string>',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                { messageId: "constArrayNotAsConst", data: { name: "colors", typeName: "IColor" } },
                {
                    messageId: "constArrayNotStringLiteralArray",
                    data: { name: "colors", typeName: "IColor" }
                }
            ]
        },

        // --- Const array with satisfies but missing as const ---
        {
            name: "source array with `satisfies` but no `as const` is rejected",
            code: [
                'const colors = ["red", "blue"] satisfies string[]',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "constArrayNotAsConst",
                    data: { name: "colors", typeName: "IColor" }
                }
            ]
        },

        // --- Const array is not a string literal array ---
        {
            name: "preceding const value is not an array literal",
            code: [
                'const colors = "red" as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "constArrayNotStringLiteralArray",
                    data: { name: "colors", typeName: "IColor" }
                }
            ]
        },
        {
            name: "preceding const array contains a non-string element",
            code: [
                'const colors = ["red", 1] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "constArrayNotStringLiteralArray",
                    data: { name: "colors", typeName: "IColor" }
                }
            ]
        },
        {
            name: "preceding const array contains a sparse hole",
            code: [
                'const colors = ["red", , "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "constArrayNotStringLiteralArray",
                    data: { name: "colors", typeName: "IColor" }
                }
            ]
        },

        // --- Missing pascal const below ---
        {
            name: "no following statement at all",
            code: ['const colors = ["red", "blue"] as const', "type IColor = (typeof colors)[number]"].join("\n"),
            errors: [{ messageId: "missingPascalCaseConstBelow", data: { name: "IColor", expected: "Color" } }]
        },
        {
            name: "following statement is unrelated",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "function noop() {}"
            ].join("\n"),
            errors: [{ messageId: "missingPascalCaseConstBelow", data: { name: "IColor", expected: "Color" } }]
        },
        {
            name: "following const has wrong name",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const ColorMap = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [{ messageId: "missingPascalCaseConstBelow", data: { name: "IColor", expected: "Color" } }]
        },
        {
            name: "following const is a let declaration",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "let Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "}"
            ].join("\n"),
            errors: [{ messageId: "missingPascalCaseConstBelow", data: { name: "IColor", expected: "Color" } }]
        },

        // --- Pascal const not an object literal ---
        {
            name: "following pascal const is not an object literal",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                'const Color = "red" as const satisfies Record<IKeyable<IColor>, IColor>'
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstNotObjectLiteral",
                    data: { name: "Color", typeName: "IColor" }
                }
            ]
        },

        // --- Pascal const missing as const satisfies ---
        {
            name: "pascal const missing satisfies clause",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstMissingAsConstSatisfies",
                    data: { name: "Color", typeName: "IColor" }
                }
            ]
        },
        {
            name: "pascal const missing as const (only satisfies)",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstMissingAsConstSatisfies",
                    data: { name: "Color", typeName: "IColor" }
                }
            ]
        },
        {
            name: "pascal const satisfies the wrong type name",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<ISomething>, ISomething>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstMissingAsConstSatisfies",
                    data: { name: "Color", typeName: "IColor" }
                }
            ]
        },
        {
            name: "pascal const satisfies a Record without IKeyable wrapper",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IColor, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstMissingAsConstSatisfies",
                    data: { name: "Color", typeName: "IColor" }
                }
            ]
        },
        {
            name: "pascal const satisfies the legacy Capitalize<T> wrapper instead of IKeyable<T>",
            code: [
                'const charts = ["bar_chart", "line_chart"] as const',
                "type IChart = (typeof charts)[number]",
                "const Chart = {",
                '    BarChart: "bar_chart",',
                '    LineChart: "line_chart"',
                "} as const satisfies Record<Capitalize<IChart>, IChart>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstMissingAsConstSatisfies",
                    data: { name: "Chart", typeName: "IChart" }
                }
            ]
        },

        // --- Pascal const invalid entries ---
        {
            name: "pascal const has a key that is not IKeyable<value>",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Reddish: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstInvalidEntries",
                    data: { name: "Color", typeName: "IColor" }
                }
            ]
        },
        {
            name: "pascal const preserves the underscore in the key (legacy Capitalize shape)",
            code: [
                'const charts = ["bar_chart", "line_chart"] as const',
                "type IChart = (typeof charts)[number]",
                "const Chart = {",
                '    Bar_chart: "bar_chart",',
                '    Line_chart: "line_chart"',
                "} as const satisfies Record<IKeyable<IChart>, IChart>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstInvalidEntries",
                    data: { name: "Chart", typeName: "IChart" }
                }
            ]
        },
        {
            name: "pascal const leaves a snake_case value unconverted (wrong key for one entry)",
            code: [
                'const charts = ["bar_chart", "crosstab"] as const',
                "type IChart = (typeof charts)[number]",
                "const Chart = {",
                '    BarChart: "bar_chart",',
                '    Cross_tab: "crosstab"',
                "} as const satisfies Record<IKeyable<IChart>, IChart>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstInvalidEntries",
                    data: { name: "Chart", typeName: "IChart" }
                }
            ]
        },
        {
            name: "pascal const preserves the hyphen in the key for a kebab-case value",
            code: [
                'const errorModes = ["pre-generation", "mid-generation"] as const',
                "type IErrorMode = (typeof errorModes)[number]",
                "const ErrorMode = {",
                '    "Pre-generation": "pre-generation",',
                '    MidGeneration: "mid-generation"',
                "} as const satisfies Record<IKeyable<IErrorMode>, IErrorMode>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstInvalidEntries",
                    data: { name: "ErrorMode", typeName: "IErrorMode" }
                }
            ]
        },
        {
            name: "pascal const has lowercase keys",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    red: "red",',
                '    blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstInvalidEntries",
                    data: { name: "Color", typeName: "IColor" }
                }
            ]
        },
        {
            name: "pascal const has duplicated keys",
            code: [
                'const colors = ["red"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Red: "red"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstInvalidEntries",
                    data: { name: "Color", typeName: "IColor" }
                }
            ]
        },
        {
            name: "pascal const has a spread element",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const base = { Red: 'red' }",
                "const Color = {",
                "    ...base,",
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "missingPascalCaseConstBelow",
                    data: { name: "IColor", expected: "Color" }
                }
            ]
        },
        {
            name: "pascal const has a computed key",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const key = 'Red'",
                "const Color = {",
                '    [key]: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "missingPascalCaseConstBelow",
                    data: { name: "IColor", expected: "Color" }
                }
            ]
        },
        {
            name: "pascal const has a non-string-literal value",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                "    Red: 1,",
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstInvalidEntries",
                    data: { name: "Color", typeName: "IColor" }
                }
            ]
        },

        // --- Partially composed with invalid explicit entries ---
        {
            name: "partially composed object with bad PascalCase key in own entries is rejected",
            code: [
                'const allItems = [...fooItems, "c"] as const',
                "type IAll = (typeof allItems)[number]",
                "const All = {",
                "    ...Foo,",
                '    wrong: "c"',
                "} as const satisfies Record<IKeyable<IAll>, IAll>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstInvalidEntries",
                    data: { name: "All", typeName: "IAll" }
                }
            ]
        },
        {
            name: "partially composed object with mismatched key/value in own entries is rejected",
            code: [
                'const allItems = [...fooItems, "c"] as const',
                "type IAll = (typeof allItems)[number]",
                "const All = {",
                "    ...Foo,",
                '    Wrong: "c"',
                "} as const satisfies Record<IKeyable<IAll>, IAll>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstInvalidEntries",
                    data: { name: "All", typeName: "IAll" }
                }
            ]
        },
        {
            name: "partially composed array with non-string element is rejected",
            code: [
                "const allItems = [...fooItems, 1] as const",
                "type IAll = (typeof allItems)[number]",
                "const All = {",
                "    ...Foo",
                "} as const satisfies Record<IKeyable<IAll>, IAll>"
            ].join("\n"),
            errors: [
                {
                    messageId: "constArrayNotStringLiteralArray",
                    data: { name: "allItems", typeName: "IAll" }
                }
            ]
        },
        {
            name: "partially composed object with non-identifier spread is rejected",
            code: [
                'const allItems = ["a", ...fooItems] as const',
                "type IAll = (typeof allItems)[number]",
                "const All = {",
                '    A: "a",',
                "    ...getObj()",
                "} as const satisfies Record<IKeyable<IAll>, IAll>"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstInvalidEntries",
                    data: { name: "All", typeName: "IAll" }
                }
            ]
        },
        {
            name: "composed object missing as const satisfies is still rejected",
            code: [
                "const allItems = [...fooItems, ...barItems] as const",
                "type IAll = (typeof allItems)[number]",
                "const All = {",
                "    ...Foo,",
                "    ...Bar",
                "} as const"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstMissingAsConstSatisfies",
                    data: { name: "All", typeName: "IAll" }
                }
            ]
        },
        {
            name: "composed array missing as const is rejected",
            code: [
                "const allItems = [...fooItems, ...barItems]",
                "type IAll = (typeof allItems)[number]",
                "const All = {",
                "    ...Foo,",
                "    ...Bar",
                "} as const satisfies Record<IKeyable<IAll>, IAll>"
            ].join("\n"),
            errors: [
                {
                    messageId: "constArrayNotAsConst",
                    data: { name: "allItems", typeName: "IAll" }
                }
            ]
        },

        // --- Set source-of-truth errors ---
        {
            name: "Set missing as const on inner array",
            code: [
                'const colors = new Set(["red", "blue"])',
                "type IColor = ISetValues<typeof colors>",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [{ messageId: "constSetNotAsConst", data: { name: "colors", typeName: "IColor" } }]
        },
        {
            name: "Set wrapping non-string elements",
            code: [
                "const codes = new Set([1, 2] as const)",
                "type ICode = ISetValues<typeof codes>",
                "const Code = {",
                '    One: "1"',
                "} as const satisfies Record<IKeyable<ICode>, ICode>"
            ].join("\n"),
            errors: [
                { messageId: "constSetNotStringLiteralArray", data: { name: "codes", typeName: "ICode" } },
                { messageId: "pascalCaseConstInvalidEntries", data: { name: "Code", typeName: "ICode" } }
            ]
        },
        {
            name: "ISetValues used but preceding const is a plain array (not a Set)",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = ISetValues<typeof colors>",
                "const Color = {",
                '    Red: "red",',
                '    Blue: "blue"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [
                { messageId: "constSetNotAsConst", data: { name: "colors", typeName: "IColor" } },
                { messageId: "constSetNotStringLiteralArray", data: { name: "colors", typeName: "IColor" } }
            ]
        },
        {
            name: "ISetValues with no preceding declaration",
            code: [
                "type IColor = ISetValues<typeof colors>",
                "const Color = {",
                '    Red: "red"',
                "} as const satisfies Record<IKeyable<IColor>, IColor>"
            ].join("\n"),
            errors: [{ messageId: "missingConstSetAbove", data: { name: "IColor", expected: "colors" } }]
        },
        {
            name: "Set with own string literals mixed with spreads requires as const",
            code: [
                'const extraNames = new Set(["extra_a", ...fooNames])',
                "type IExtraName = ISetValues<typeof extraNames>",
                "const ExtraName = {",
                '    ExtraA: "extra_a",',
                "    ...FooName",
                "} as const satisfies Record<IKeyable<IExtraName>, IExtraName>"
            ].join("\n"),
            errors: [{ messageId: "constSetNotAsConst", data: { name: "extraNames", typeName: "IExtraName" } }]
        },
        {
            name: "ISetValues naming convention violation",
            code: [
                'const otherNames = new Set(["a"] as const)',
                "type IBaseToolName = ISetValues<typeof otherNames>",
                "const BaseToolName = {",
                '    A: "a"',
                "} as const satisfies Record<IKeyable<IBaseToolName>, IBaseToolName>"
            ].join("\n"),
            errors: [
                {
                    messageId: "constArrayNameConventionViolation",
                    data: {
                        typeName: "IBaseToolName",
                        actual: "otherNames",
                        expectedPrefix: "baseToolName",
                        pascalName: "BaseToolName"
                    }
                }
            ]
        },

        // --- Combined: missing both above and below ---
        {
            name: "lonely typeof-derived alias missing both array above and pascal const below",
            code: "type IColor = (typeof colors)[number]",
            errors: [
                { messageId: "missingConstArrayAbove", data: { name: "IColor", expected: "colors" } },
                { messageId: "missingPascalCaseConstBelow", data: { name: "IColor", expected: "Color" } }
            ]
        },

        // --- Combined: array correct but pascal const has wrong shape ---
        {
            name: "pascal const has wrong satisfies and wrong entries",
            code: [
                'const colors = ["red", "blue"] as const',
                "type IColor = (typeof colors)[number]",
                "const Color = {",
                '    Red: "red",',
                '    Bluish: "blue"',
                "} as const"
            ].join("\n"),
            errors: [
                {
                    messageId: "pascalCaseConstMissingAsConstSatisfies",
                    data: { name: "Color", typeName: "IColor" }
                },
                {
                    messageId: "pascalCaseConstInvalidEntries",
                    data: { name: "Color", typeName: "IColor" }
                }
            ]
        }
    ]
})
