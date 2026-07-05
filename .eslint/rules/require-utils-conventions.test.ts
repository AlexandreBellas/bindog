import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it, vi } from "vitest"

vi.mock("node:fs", () => {
    const testFiles = new Map<string, string>()

    const describeWithTest = (name: string) =>
        [`describe("${name}", () => {`, '    it("works", () => { expect(true).toBe(true) })', "})"].join("\n")

    const emptyDescribe = (name: string) => [`describe("${name}", () => {`, "})"].join("\n")

    // Comprehensive mock for math.ts
    testFiles.set(
        "src/utils/math.test.ts",
        [describeWithTest("add"), describeWithTest("subtract"), describeWithTest("double")].join("\n\n")
    )

    // Test file with only describe("add") — missing "subtract"
    testFiles.set("src/utils/missing-describe.test.ts", describeWithTest("add"))

    // Test file where "add" describe has no test calls
    testFiles.set("src/utils/empty-describe.test.ts", [emptyDescribe("add"), describeWithTest("subtract")].join("\n\n"))

    // Test file where the only "it" uses it.todo (1 arg → not implemented)
    testFiles.set(
        "src/utils/todo-only.test.ts",
        ['describe("format", () => {', '    it.todo("should format")', "})"].join("\n")
    )

    // Test file with nested describes — tests inside nested describe count
    testFiles.set(
        "src/utils/nested.test.ts",
        [
            'describe("transform", () => {',
            '    describe("when given a number", () => {',
            '        it("should transform", () => { expect(true).toBe(true) })',
            "    })",
            "})"
        ].join("\n")
    )

    // Test file using test() instead of it()
    testFiles.set(
        "src/utils/alt-syntax.test.ts",
        ['describe("parse", () => {', '    test("should parse", () => { expect(true).toBe(true) })', "})"].join("\n")
    )

    // Test file using describe.skip and it.skip — still counts
    testFiles.set(
        "src/utils/skipped.test.ts",
        [
            'describe.skip("compute", () => {',
            '    it.skip("should compute", () => { expect(true).toBe(true) })',
            "})"
        ].join("\n")
    )

    // Test file with multiple tests per describe
    testFiles.set(
        "src/utils/multi-test.test.ts",
        [
            'describe("validate", () => {',
            '    it("should accept valid input", () => { expect(true).toBe(true) })',
            '    it("should reject invalid input", () => { expect(false).toBe(false) })',
            "})"
        ].join("\n")
    )

    // Syntactically broken test file (will fail to parse)
    testFiles.set("src/utils/broken.test.ts", "describe(broken {{{")

    // Test file with both matching and empty describes
    testFiles.set("src/utils/mixed-empty.test.ts", [describeWithTest("foo"), emptyDescribe("bar")].join("\n\n"))

    // describe.skip at top level (member expression callee)
    testFiles.set(
        "src/utils/describe-skip.test.ts",
        ['describe.skip("helper", () => {', '    it("should help", () => { expect(true).toBe(true) })', "})"].join("\n")
    )

    // Test file using it.each — array-call form
    testFiles.set(
        "src/utils/each-syntax.test.ts",
        [
            'describe("compute", () => {',
            '    it.each([[1, 2], [3, 4]])("adds %i and %i", (a, b) => { expect(a + b).toBeDefined() })',
            "})"
        ].join("\n")
    )

    // Test file using it.each — tagged-template form
    testFiles.set(
        "src/utils/each-template.test.ts",
        [
            'describe("format", () => {',
            "    it.each`",
            "        input | expected",
            '        ${1}  | ${"1"}',
            '    `("formats $input as $expected", ({ input, expected }) => { expect(String(input)).toBe(expected) })',
            "})"
        ].join("\n")
    )

    // Test file using test.each — array-call form
    testFiles.set(
        "src/utils/test-each.test.ts",
        [
            'describe("parse", () => {',
            '    test.each([[1], [2]])("parses %i", (n) => { expect(n).toBeDefined() })',
            "})"
        ].join("\n")
    )

    // Realistic test file with import statements at the top — ensures module syntax is parsed correctly
    testFiles.set(
        "src/utils/with-imports.test.ts",
        [
            'import { describe, it, expect } from "vitest"',
            'import { normalize } from "./with-imports"',
            "",
            'describe("normalize", () => {',
            '    it("returns normalized value", () => { expect(normalize(1)).toBeDefined() })',
            "})"
        ].join("\n")
    )

    const mock = {
        existsSync: vi.fn((p: string) => testFiles.has(p)),
        readFileSync: vi.fn((p: string) => {
            if (testFiles.has(p)) return testFiles.get(p)!
            throw new Error(`ENOENT: no such file or directory: ${p}`)
        })
    }
    return { default: mock, ...mock }
})

import rule from "./require-utils-conventions"

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

// Filename where NO mock test file exists
const NO_TEST = "src/utils/no-test.ts"
const MATH = "src/utils/math.ts"

/**
 * Generates an exported function declaration with the given number of
 * logical (non-blank) lines inside the FunctionDeclaration node itself.
 * The JSDoc comment and `export` keyword are outside the node's range.
 */
function longFn(name: string, lines: number, opts?: { jsdoc?: boolean; exported?: boolean }): string {
    const { jsdoc = true, exported = true } = opts ?? {}
    const bodyCount = lines - 2
    const body: string[] = []
    for (let i = 0; i < bodyCount - 1; i++) body.push(`  const v${i} = ${i}`)
    body.push("  return v0")
    const prefix = exported ? "export " : ""
    const doc = jsdoc ? `/** ${name} util. */\n` : ""
    return `${doc}${prefix}function ${name}(x: number): number {\n${body.join("\n")}\n}`
}

/**
 * Same as longFn but produces an arrow function expression (`export const name = ...`).
 * The logical lines counted are only those in the ArrowFunctionExpression node.
 */
function longArrow(name: string, lines: number, opts?: { jsdoc?: boolean; exported?: boolean }): string {
    const { jsdoc = true, exported = true } = opts ?? {}
    const bodyCount = lines - 2
    const body: string[] = []
    for (let i = 0; i < bodyCount - 1; i++) body.push(`  const v${i} = ${i}`)
    body.push("  return v0")
    const prefix = exported ? "export " : ""
    const doc = jsdoc ? `/** ${name} util. */\n` : ""
    return `${doc}${prefix}const ${name} = (x: number): number => {\n${body.join("\n")}\n}`
}

// Short functions (< 10 lines) don't trigger test validation,
// so these tests only concern JSDoc checking.

ruleTester.run("require-utils-conventions (missingJsdoc)", rule, {
    valid: [
        {
            name: "bare function declaration with JSDoc",
            code: ["/** Formats a number. */", "function format(x: number): string {", "  return String(x)", "}"].join(
                "\n"
            ),
            filename: NO_TEST
        },
        {
            name: "exported function declaration with JSDoc",
            code: [
                "/** Returns the sum. */",
                "export function add(a: number, b: number): number {",
                "  return a + b",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },
        {
            name: "export default function (named) with JSDoc",
            code: ["/** Default helper. */", "export default function helper() {", "  return 1", "}"].join("\n"),
            filename: NO_TEST
        },
        {
            name: "export default function (anonymous) with JSDoc",
            code: ["/** Default anonymous helper. */", "export default function() {", "  return 1", "}"].join("\n"),
            filename: NO_TEST
        },

        {
            name: "const arrow with JSDoc",
            code: ["/** Doubles the value. */", "const double = (x: number): number => x * 2"].join("\n"),
            filename: NO_TEST
        },
        {
            name: "export const arrow with JSDoc",
            code: ["/** Doubles the value. */", "export const double = (x: number): number => x * 2"].join("\n"),
            filename: NO_TEST
        },
        {
            name: "const function expression with JSDoc",
            code: [
                "/** Formats a date. */",
                "const format = function(d: Date): string {",
                "  return d.toISOString()",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },
        {
            name: "export const function expression with JSDoc",
            code: [
                "/** Formats a date. */",
                "export const format = function(d: Date): string {",
                "  return d.toISOString()",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },

        {
            name: "export default arrow with JSDoc",
            code: ["/** Default transformer. */", "export default (x: number) => x * 2"].join("\n"),
            filename: NO_TEST
        },
        {
            name: "export default function expression with JSDoc",
            code: [
                "/** Default formatter. */",
                "export default function(x: number): string {",
                "  return String(x)",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },

        {
            name: "nested function declarations both documented",
            code: [
                "/** Outer function. */",
                "function outer() {",
                "  /** Inner helper. */",
                "  function inner() { return 1 }",
                "  return inner()",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },
        {
            name: "nested arrow documented",
            code: [
                "/** Outer function. */",
                "function outer() {",
                "  /** Inner helper. */",
                "  const inner = () => 1",
                "  return inner()",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },

        {
            name: "arrow in .map callback",
            code: [
                "/** Maps values. */",
                "function mapValues(arr: number[]): number[] {",
                "  return arr.map(x => x * 2)",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },
        {
            name: "arrow in .filter callback",
            code: [
                "/** Filters truthy values. */",
                "export function filterTruthy<T>(arr: (T | null)[]): T[] {",
                "  return arr.filter((x): x is T => x !== null)",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },
        {
            name: "anonymous function passed as argument",
            code: [
                "/** Registers handler. */",
                "export function register(bus: EventBus): void {",
                "  bus.on('event', function(e) { console.log(e) })",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },
        {
            name: "arrow inside object literal (not a function declarator)",
            code: [
                "/** Config object. */",
                "export const config = {",
                "  transform: (x: number) => x * 2,",
                "  validate: function(x: number): boolean { return x > 0 }",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },

        {
            name: "multi-line JSDoc is valid",
            code: [
                "/**",
                " * Converts a value to a string.",
                " * @param x - the value",
                " */",
                "export function toString(x: unknown): string {",
                "  return String(x)",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },
        {
            name: "multiple documented functions in one file",
            code: [
                "/** Adds two numbers. */",
                "export function add(a: number, b: number): number { return a + b }",
                "",
                "/** Subtracts two numbers. */",
                "export function subtract(a: number, b: number): number { return a - b }"
            ].join("\n"),
            filename: NO_TEST
        },

        {
            name: "test file is not linted by this rule",
            code: "function noJsdoc() { return 1 }",
            filename: "src/utils/math.test.ts"
        },
        {
            name: "test file with .test.tsx extension is skipped",
            code: "function noJsdoc() { return 1 }",
            filename: "src/utils/foo.test.tsx"
        }
    ],

    invalid: [
        {
            name: "bare function declaration — no JSDoc",
            code: "function format(x: number): string { return String(x) }",
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "format" } }]
        },
        {
            name: "exported function declaration — no JSDoc",
            code: "export function add(a: number, b: number): number { return a + b }",
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "add" } }]
        },
        {
            name: "export default function (named) — no JSDoc",
            code: "export default function helper() { return 1 }",
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "helper" } }]
        },
        {
            name: "export default function (anonymous) — no JSDoc",
            code: "export default function() { return 1 }",
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdocAnonymous" }]
        },

        {
            name: "const arrow — no JSDoc",
            code: "const double = (x: number): number => x * 2",
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "double" } }]
        },
        {
            name: "export const arrow — no JSDoc",
            code: "export const double = (x: number): number => x * 2",
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "double" } }]
        },
        {
            name: "const function expression — no JSDoc",
            code: ["const format = function(d: Date): string {", "  return d.toISOString()", "}"].join("\n"),
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "format" } }]
        },
        {
            name: "export const function expression — no JSDoc",
            code: ["export const format = function(d: Date): string {", "  return d.toISOString()", "}"].join("\n"),
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "format" } }]
        },

        {
            name: "export default arrow — no JSDoc",
            code: "export default (x: number) => x * 2",
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdocAnonymous" }]
        },
        {
            name: "export default function expression — no JSDoc",
            code: ["export default function(x: number): string {", "  return String(x)", "}"].join("\n"),
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdocAnonymous" }]
        },

        {
            name: "single-line comment is not JSDoc",
            code: ["// Formats a number", "function format(x: number): string { return String(x) }"].join("\n"),
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "format" } }]
        },
        {
            name: "block comment not starting with * is not JSDoc",
            code: ["/* Formats a number */", "function format(x: number): string { return String(x) }"].join("\n"),
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "format" } }]
        },
        {
            name: "single-line comment before const arrow is not JSDoc",
            code: ["// Doubles the value", "const double = (x: number) => x * 2"].join("\n"),
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "double" } }]
        },

        {
            name: "outer has JSDoc, inner function declaration does not",
            code: [
                "/** Outer function. */",
                "function outer() {",
                "  function inner() { return 1 }",
                "  return inner()",
                "}"
            ].join("\n"),
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "inner" } }]
        },
        {
            name: "outer has JSDoc, inner const arrow does not",
            code: [
                "/** Outer function. */",
                "function outer() {",
                "  const inner = () => 1",
                "  return inner()",
                "}"
            ].join("\n"),
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "inner" } }]
        },

        {
            name: "two undocumented functions in one file",
            code: [
                "function add(a: number, b: number): number { return a + b }",
                "",
                "export const subtract = (a: number, b: number): number => a - b"
            ].join("\n"),
            filename: NO_TEST,
            errors: [
                { messageId: "missingJsdoc", data: { name: "add" } },
                { messageId: "missingJsdoc", data: { name: "subtract" } }
            ]
        },
        {
            name: "one documented, one not — only undocumented is flagged",
            code: [
                "/** Adds two numbers. */",
                "export function add(a: number, b: number): number { return a + b }",
                "",
                "export function subtract(a: number, b: number): number { return a - b }"
            ].join("\n"),
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "subtract" } }]
        }
    ]
})

ruleTester.run("require-utils-conventions (line threshold)", rule, {
    valid: [
        {
            name: "9-line function — below threshold, no test needed",
            code: longFn("add", 9),
            filename: NO_TEST
        },
        {
            name: "short one-liner — well below threshold",
            code: ["/** Short. */", "export function add(a: number, b: number): number { return a + b }"].join("\n"),
            filename: NO_TEST
        },
        {
            name: "9-line arrow function — below threshold",
            code: longArrow("add", 9),
            filename: NO_TEST
        },
        {
            name: "10-line function with matching test file — valid",
            code: longFn("add", 10),
            filename: MATH
        },
        {
            name: "10-line arrow function with matching test file — valid",
            code: longArrow("add", 10),
            filename: MATH
        },
        {
            name: "blank lines inside function do not count toward threshold",
            code: [
                "/** Padded. */",
                "export function add(x: number): number {",
                "  const a = x + 1",
                "",
                "  const b = a + 2",
                "",
                "  const c = b + 3",
                "",
                "  return c",
                "}"
            ].join("\n"),
            filename: NO_TEST
        },
        {
            name: "mixed file — only 10+ line functions need tests, short ones are exempt",
            code: [longFn("add", 10), "", "/** Short. */\nexport function helper(): number { return 1 }"].join("\n"),
            filename: MATH
        }
    ],
    invalid: [
        {
            name: "10-line function without test file — triggers missingTestFile",
            code: longFn("add", 10),
            filename: NO_TEST,
            errors: [{ messageId: "missingTestFile", data: { expected: "no-test.test.ts", minLines: 10 } }]
        },
        {
            name: "10-line arrow function without test file — triggers missingTestFile",
            code: longArrow("add", 10),
            filename: NO_TEST,
            errors: [{ messageId: "missingTestFile", data: { expected: "no-test.test.ts", minLines: 10 } }]
        },
        {
            name: "11-line function without test file — above threshold",
            code: longFn("add", 11),
            filename: NO_TEST,
            errors: [{ messageId: "missingTestFile", data: { expected: "no-test.test.ts", minLines: 10 } }]
        },
        {
            name: "10-line undocumented function — both JSDoc and test errors",
            code: longFn("add", 10, { jsdoc: false }),
            filename: NO_TEST,
            errors: [
                { messageId: "missingJsdoc", data: { name: "add" } },
                { messageId: "missingTestFile", data: { expected: "no-test.test.ts", minLines: 10 } }
            ]
        }
    ]
})

ruleTester.run("require-utils-conventions (missingTestFile)", rule, {
    valid: [
        {
            name: "long functions with existing test file",
            code: [longFn("add", 10), "", longFn("subtract", 10)].join("\n"),
            filename: MATH
        },
        {
            name: "file with only constants — no test needed",
            code: "export const FOO = 42",
            filename: NO_TEST
        },
        {
            name: "file with only type exports — no test needed",
            code: ["export interface IFoo { bar: string }", "export type TBaz = number"].join("\n"),
            filename: NO_TEST
        },
        {
            name: "file with only anonymous export default — no test needed",
            code: ["/** Default. */", "export default (x: number) => x * 2"].join("\n"),
            filename: NO_TEST
        },
        {
            name: "file with only short functions — no test needed",
            code: [
                "/** Foo. */",
                "export function foo() { return 1 }",
                "",
                "/** Bar. */",
                "export const bar = () => 2"
            ].join("\n"),
            filename: NO_TEST
        },
        {
            name: "non-exported long function — not tracked, no test needed",
            code: longFn("format", 10, { exported: false }),
            filename: NO_TEST
        },
        {
            name: "export default long function — not a named export, no test needed",
            code: [
                "/**",
                " * Default helper.",
                " * @param x - value",
                " * @param y - value",
                " * @param z - value",
                " */",
                "export default function helper(x: number, y: number, z: number): number {",
                "  const a = x + 1",
                "  const b = y + 2",
                "  const c = z + 3",
                "  const d = a + b",
                "  const e = b + c",
                "  const f = c + d",
                "  return f + e",
                "}"
            ].join("\n"),
            filename: NO_TEST
        }
    ],
    invalid: [
        {
            name: "single long function, no test file",
            code: longFn("format", 10),
            filename: NO_TEST,
            errors: [{ messageId: "missingTestFile", data: { expected: "no-test.test.ts", minLines: 10 } }]
        },
        {
            name: "multiple long functions, no test file",
            code: [longFn("foo", 10), "", longFn("bar", 12)].join("\n"),
            filename: NO_TEST,
            errors: [{ messageId: "missingTestFile", data: { expected: "no-test.test.ts", minLines: 10 } }]
        }
    ]
})

ruleTester.run("require-utils-conventions (named exports only)", rule, {
    valid: [
        {
            name: "bare (non-exported) long function declaration — no test needed",
            code: longFn("helper", 10, { exported: false }),
            filename: NO_TEST
        },
        {
            name: "bare (non-exported) long arrow function — no test needed",
            code: longArrow("helper", 10, { exported: false }),
            filename: NO_TEST
        },
        {
            name: "named export long function with test file — valid",
            code: longFn("add", 10),
            filename: MATH
        }
    ],
    invalid: [
        {
            name: "named export long function without test file — triggers missingTestFile",
            code: longFn("add", 10),
            filename: NO_TEST,
            errors: [{ messageId: "missingTestFile", data: { expected: "no-test.test.ts", minLines: 10 } }]
        },
        {
            name: "named export long arrow without test file — triggers missingTestFile",
            code: longArrow("add", 10),
            filename: NO_TEST,
            errors: [{ messageId: "missingTestFile", data: { expected: "no-test.test.ts", minLines: 10 } }]
        }
    ]
})

ruleTester.run("require-utils-conventions (configurable minLines)", rule, {
    valid: [
        {
            name: "function below custom minLines threshold — no test needed",
            code: longFn("add", 5),
            filename: NO_TEST,
            options: [{ minLines: 6 }]
        },
        {
            name: "function exactly at custom minLines threshold with test file",
            code: longFn("add", 5),
            filename: MATH,
            options: [{ minLines: 5 }]
        },
        {
            name: "function at default threshold but custom higher threshold — no test needed",
            code: longFn("add", 10),
            filename: NO_TEST,
            options: [{ minLines: 20 }]
        }
    ],
    invalid: [
        {
            name: "function at custom minLines=5 threshold without test file",
            code: longFn("add", 5),
            filename: NO_TEST,
            options: [{ minLines: 5 }],
            errors: [{ messageId: "missingTestFile", data: { expected: "no-test.test.ts", minLines: 5 } }]
        },
        {
            name: "function below default threshold but above custom minLines=3",
            code: longFn("add", 4),
            filename: NO_TEST,
            options: [{ minLines: 4 }],
            errors: [{ messageId: "missingTestFile", data: { expected: "no-test.test.ts", minLines: 4 } }]
        }
    ]
})

ruleTester.run("require-utils-conventions (missingDescribe)", rule, {
    valid: [
        {
            name: "all long functions have matching describes with tests",
            code: [longFn("add", 10), "", longFn("subtract", 10)].join("\n"),
            filename: MATH
        }
    ],
    invalid: [
        {
            name: "test file is missing describe for 'subtract'",
            code: [longFn("add", 10), "", longFn("subtract", 10)].join("\n"),
            filename: "src/utils/missing-describe.ts",
            errors: [
                {
                    messageId: "missingDescribe",
                    data: { name: "subtract", testFile: "missing-describe.test.ts" }
                }
            ]
        },
        {
            name: "test file is missing describes for all long functions",
            code: [longFn("transform", 10), "", longArrow("validate", 10)].join("\n"),
            filename: "src/utils/missing-describe.ts",
            errors: [
                {
                    messageId: "missingDescribe",
                    data: { name: "transform", testFile: "missing-describe.test.ts" }
                },
                {
                    messageId: "missingDescribe",
                    data: { name: "validate", testFile: "missing-describe.test.ts" }
                }
            ]
        },
        {
            name: "only the long function needs a describe, short one is exempt",
            code: [longFn("transform", 10), "", "/** Short. */\nexport function helper(): number { return 1 }"].join(
                "\n"
            ),
            filename: "src/utils/missing-describe.ts",
            errors: [
                {
                    messageId: "missingDescribe",
                    data: { name: "transform", testFile: "missing-describe.test.ts" }
                }
            ]
        }
    ]
})

ruleTester.run("require-utils-conventions (emptyDescribe)", rule, {
    valid: [
        {
            name: "describe with nested describe containing tests still counts",
            code: longFn("transform", 10),
            filename: "src/utils/nested.ts"
        },
        {
            name: "describe with test() instead of it() is valid",
            code: longFn("parse", 10),
            filename: "src/utils/alt-syntax.ts"
        },
        {
            name: "describe with multiple tests is valid",
            code: longFn("validate", 10),
            filename: "src/utils/multi-test.ts"
        },
        {
            name: "describe.skip at top level with tests inside is valid",
            code: longFn("compute", 10),
            filename: "src/utils/skipped.ts"
        },
        {
            name: "describe.skip still matches function name",
            code: longFn("helper", 10),
            filename: "src/utils/describe-skip.ts"
        },
        {
            name: "describe with it.each (array-call form) is not empty",
            code: longFn("compute", 10),
            filename: "src/utils/each-syntax.ts"
        },
        {
            name: "describe with it.each (tagged-template form) is not empty",
            code: longFn("format", 10),
            filename: "src/utils/each-template.ts"
        },
        {
            name: "describe with test.each (array-call form) is not empty",
            code: longFn("parse", 10),
            filename: "src/utils/test-each.ts"
        },
        {
            name: "test file with import statements at the top is parsed correctly",
            code: longFn("normalize", 10),
            filename: "src/utils/with-imports.ts"
        }
    ],
    invalid: [
        {
            name: "describe exists but has no test calls — emptyDescribe for 'add'",
            code: [longFn("add", 10), "", longFn("subtract", 10)].join("\n"),
            filename: "src/utils/empty-describe.ts",
            errors: [
                {
                    messageId: "emptyDescribe",
                    data: { name: "add", testFile: "empty-describe.test.ts" }
                }
            ]
        },
        {
            name: "describe with only it.todo (1 arg) is empty",
            code: longFn("format", 10),
            filename: "src/utils/todo-only.ts",
            errors: [
                {
                    messageId: "emptyDescribe",
                    data: { name: "format", testFile: "todo-only.test.ts" }
                }
            ]
        },
        {
            name: "mixed — one describe is fine, the other is empty",
            code: [longFn("foo", 10), "", longFn("bar", 10)].join("\n"),
            filename: "src/utils/mixed-empty.ts",
            errors: [
                {
                    messageId: "emptyDescribe",
                    data: { name: "bar", testFile: "mixed-empty.test.ts" }
                }
            ]
        }
    ]
})

ruleTester.run("require-utils-conventions (broken test file)", rule, {
    valid: [
        {
            name: "broken test file — content validation skipped, no errors beyond existence",
            code: longFn("format", 10),
            filename: "src/utils/broken.ts"
        }
    ],
    invalid: []
})

ruleTester.run("require-utils-conventions (Reducer suffix exemption)", rule, {
    valid: [
        {
            name: "exported function declaration ending with Reducer — no JSDoc required",
            code: "export function conversationOverlayReducer(state: unknown, action: unknown): unknown { return state }",
            filename: NO_TEST
        },
        {
            name: "exported function declaration ending with Reducer — no test file required even when long",
            code: longFn("myReducer", 10, { jsdoc: false }),
            filename: NO_TEST
        },
        {
            name: "exported arrow function ending with Reducer — no JSDoc required",
            code: "export const myReducer = (state: unknown, action: unknown): unknown => state",
            filename: NO_TEST
        },
        {
            name: "exported arrow function ending with Reducer — no test file required even when long",
            code: longArrow("myReducer", 10, { jsdoc: false }),
            filename: NO_TEST
        },
        {
            name: "non-exported function declaration ending with Reducer — no JSDoc required",
            code: "function myReducer(state: unknown, action: unknown): unknown { return state }",
            filename: NO_TEST
        },
        {
            name: "non-exported arrow function ending with Reducer — no JSDoc required",
            code: "const myReducer = (state: unknown, action: unknown): unknown => state",
            filename: NO_TEST
        }
    ],
    invalid: [
        {
            name: "function NOT ending with Reducer — still requires JSDoc",
            code: "export function myReducerHelper(state: unknown): unknown { return state }",
            filename: NO_TEST,
            errors: [{ messageId: "missingJsdoc", data: { name: "myReducerHelper" } }]
        }
    ]
})
