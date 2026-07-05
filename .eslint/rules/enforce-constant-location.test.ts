import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./enforce-constant-location"

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

ruleTester.run("enforce-constant-location", rule, {
    valid: [
        // --- Constants in ./constants/ folder ---
        {
            name: "primitive constant with SCREAMING_SNAKE_CASE and as const in constants folder",
            code: "const MAX_RETRIES = 3 as const",
            filename: "src/components/Foo/constants/config.ts"
        },
        {
            name: "string constant with SCREAMING_SNAKE_CASE and as const in constants folder",
            code: 'const API_URL = "https://api.example.com" as const',
            filename: "src/components/Foo/constants/urls.ts"
        },
        {
            name: "null constant with SCREAMING_SNAKE_CASE and as const in constants folder",
            code: "const DEFAULT_VALUE = null as const",
            filename: "src/constants/defaults.ts"
        },
        {
            name: "undefined constant with SCREAMING_SNAKE_CASE and as const in constants folder",
            code: "const INITIAL_STATE = undefined as const",
            filename: "src/constants/state.ts"
        },
        {
            name: "negative number constant in constants folder",
            code: "const MIN_OFFSET = -1 as const",
            filename: "src/components/Chart/constants/layout.ts"
        },
        {
            name: "template literal without expressions in constants folder",
            code: "const GREETING = `hello` as const",
            filename: "src/constants/strings.ts"
        },
        {
            name: "non-primitive constant (object) in constants folder — no naming requirement",
            code: "const defaultConfig = { retries: 3, timeout: 1000 }",
            filename: "src/components/Foo/constants/config.ts"
        },
        {
            name: "non-primitive constant (array) in constants folder — no naming requirement",
            code: "const colors = ['red', 'green', 'blue']",
            filename: "src/components/Foo/constants/colors.ts"
        },
        {
            name: "non-primitive constant (regex) in constants folder — no naming requirement",
            code: "const pattern = /^[a-z]+$/",
            filename: "src/components/Foo/constants/validation.ts"
        },
        {
            name: "exported primitive constant properly named in constants folder",
            code: 'export const BASE_URL = "/api/v1" as const',
            filename: "src/constants/api.ts"
        },

        // --- Functions, hooks, components are NOT plain values ---
        {
            name: "arrow function at module scope (not a plain constant)",
            code: "const helper = () => 1",
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "function expression at module scope (not a plain constant)",
            code: "const helper = function() { return 1 }",
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "call expression at module scope (not a plain constant)",
            code: "const ctx = createContext(null)",
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "new expression at module scope (not a plain constant)",
            code: "const client = new QueryClient()",
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "tagged template expression (not a plain constant)",
            code: "const query = gql`query { users { id } }`",
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "React component (not a plain constant)",
            code: "const Foo = () => <div />",
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "forwardRef component (not a plain constant)",
            code: [
                "import { forwardRef } from 'react'",
                "const Foo = forwardRef((props, ref) => <div ref={ref} />)"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "hook function (not a plain constant)",
            code: "const useFoo = () => { return 1 }",
            filename: "src/hooks/useFoo.ts"
        },

        // --- Constants inside function bodies are fine ---
        {
            name: "constant inside a component body is not module-scoped",
            code: ["const Foo = () => {", "  const maxRetries = 3", "  return <div>{maxRetries}</div>", "}"].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "constant inside a hook body is not module-scoped",
            code: ["function useFoo() {", "  const defaultValue = 'hello'", "  return defaultValue", "}"].join("\n"),
            filename: "src/hooks/useFoo.ts"
        },
        {
            name: "constant inside a nested function body",
            code: [
                "const Foo = () => {",
                "  const compute = () => {",
                "    const threshold = 10",
                "    return threshold",
                "  }",
                "  return <div />",
                "}"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // --- Computed/runtime values are NOT plain values (allowlist) ---
        {
            name: "conditional expression at module scope (computed — not a plain constant)",
            code: "const x = foo ? 1 : 2",
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "binary expression at module scope (computed — not a plain constant)",
            code: "const total = a + b",
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "logical expression at module scope (computed — not a plain constant)",
            code: "const value = a || b",
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "member expression at module scope (computed — not a plain constant)",
            code: "const name = obj.prop",
            filename: "src/components/Foo/index.tsx"
        },

        // --- let/var declarations are not const ---
        {
            name: "let declaration at module scope (not const)",
            code: "let counter = 0",
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "var declaration at module scope (not const)",
            code: "var flag = true",
            filename: "src/components/Foo/index.tsx"
        },

        // --- Destructuring is skipped ---
        {
            name: "destructured const at module scope (no Identifier id)",
            code: "const { a, b } = { a: 1, b: 2 }",
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "array destructuring at module scope (no Identifier id)",
            code: "const [first, second] = [1, 2]",
            filename: "src/components/Foo/index.tsx"
        },

        // --- Boolean and bigint are plain values but NOT primitives for naming ---
        {
            name: "boolean constant in constants folder — no naming requirement",
            code: "const isEnabled = true",
            filename: "src/components/Foo/constants/flags.ts"
        },
        {
            name: "bigint constant in constants folder — no naming requirement",
            code: "const limit = 100n",
            filename: "src/components/Foo/constants/limits.ts"
        }
    ],
    invalid: [
        // --- Location: plain constant outside constants folder ---
        {
            name: "number constant at module scope in component file",
            code: "const MAX_RETRIES = 3 as const",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "constantOutsideConstantsFolder", data: { name: "MAX_RETRIES" } }]
        },
        {
            name: "string constant at module scope in hook file",
            code: 'const API_URL = "https://example.com" as const',
            filename: "src/hooks/useAuth.ts",
            errors: [{ messageId: "constantOutsideConstantsFolder", data: { name: "API_URL" } }]
        },
        {
            name: "object constant at module scope in component file",
            code: "const config = { retries: 3 }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "constantOutsideConstantsFolder", data: { name: "config" } }]
        },
        {
            name: "array constant at module scope in utils file",
            code: "const items = [1, 2, 3]",
            filename: "src/components/Foo/utils/helpers.ts",
            errors: [{ messageId: "constantOutsideConstantsFolder", data: { name: "items" } }]
        },
        {
            name: "regex constant at module scope outside constants folder",
            code: "const PATTERN = /^test$/",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "constantOutsideConstantsFolder", data: { name: "PATTERN" } }]
        },
        {
            name: "exported constant outside constants folder",
            code: "export const DEFAULT_TIMEOUT = 5000 as const",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "constantOutsideConstantsFolder", data: { name: "DEFAULT_TIMEOUT" } }]
        },
        {
            name: "boolean constant outside constants folder",
            code: "const isEnabled = true",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "constantOutsideConstantsFolder", data: { name: "isEnabled" } }]
        },

        // --- Naming: primitive without SCREAMING_SNAKE_CASE ---
        {
            name: "camelCase primitive in constants folder",
            code: 'const apiUrl = "https://example.com" as const',
            filename: "src/components/Foo/constants/urls.ts",
            errors: [
                {
                    messageId: "missingScreamingSnakeCase",
                    data: { name: "apiUrl", suggested: "API_URL" }
                }
            ]
        },
        {
            name: "PascalCase primitive in constants folder",
            code: "const MaxRetries = 3 as const",
            filename: "src/constants/config.ts",
            errors: [
                {
                    messageId: "missingScreamingSnakeCase",
                    data: { name: "MaxRetries", suggested: "MAX_RETRIES" }
                }
            ]
        },
        {
            name: "lowercase primitive in constants folder",
            code: "const timeout = 1000 as const",
            filename: "src/constants/config.ts",
            errors: [
                {
                    messageId: "missingScreamingSnakeCase",
                    data: { name: "timeout", suggested: "TIMEOUT" }
                }
            ]
        },

        // --- As const: primitive without as const ---
        {
            name: "number primitive without as const in constants folder",
            code: "const MAX_RETRIES = 3",
            filename: "src/constants/config.ts",
            errors: [{ messageId: "missingAsConst", data: { name: "MAX_RETRIES" } }]
        },
        {
            name: "string primitive without as const in constants folder",
            code: 'const BASE_URL = "/api"',
            filename: "src/constants/api.ts",
            errors: [{ messageId: "missingAsConst", data: { name: "BASE_URL" } }]
        },
        {
            name: "null primitive without as const in constants folder",
            code: "const DEFAULT_VALUE = null",
            filename: "src/constants/defaults.ts",
            errors: [{ messageId: "missingAsConst", data: { name: "DEFAULT_VALUE" } }]
        },
        {
            name: "undefined primitive without as const in constants folder",
            code: "const INITIAL_STATE = undefined",
            filename: "src/constants/state.ts",
            errors: [{ messageId: "missingAsConst", data: { name: "INITIAL_STATE" } }]
        },
        {
            name: "negative number without as const in constants folder",
            code: "const MIN_OFFSET = -1",
            filename: "src/constants/layout.ts",
            errors: [{ messageId: "missingAsConst", data: { name: "MIN_OFFSET" } }]
        },
        {
            name: "template literal without expressions and without as const",
            code: "const GREETING = `hello`",
            filename: "src/constants/strings.ts",
            errors: [{ messageId: "missingAsConst", data: { name: "GREETING" } }]
        },

        // --- Combined: location + naming + as const ---
        {
            name: "camelCase primitive without as const outside constants folder (3 errors)",
            code: 'const apiUrl = "https://example.com"',
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "constantOutsideConstantsFolder", data: { name: "apiUrl" } },
                {
                    messageId: "missingScreamingSnakeCase",
                    data: { name: "apiUrl", suggested: "API_URL" }
                },
                { messageId: "missingAsConst", data: { name: "apiUrl" } }
            ]
        },
        {
            name: "camelCase number without as const outside constants folder (3 errors)",
            code: "const maxRetries = 5",
            filename: "src/hooks/useApi.ts",
            errors: [
                { messageId: "constantOutsideConstantsFolder", data: { name: "maxRetries" } },
                {
                    messageId: "missingScreamingSnakeCase",
                    data: { name: "maxRetries", suggested: "MAX_RETRIES" }
                },
                { messageId: "missingAsConst", data: { name: "maxRetries" } }
            ]
        },
        {
            name: "SCREAMING_SNAKE_CASE primitive without as const outside constants (2 errors)",
            code: "const MAX_RETRIES = 3",
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "constantOutsideConstantsFolder", data: { name: "MAX_RETRIES" } },
                { messageId: "missingAsConst", data: { name: "MAX_RETRIES" } }
            ]
        },
        {
            name: "camelCase primitive with as const outside constants (2 errors)",
            code: 'const apiUrl = "/api" as const',
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "constantOutsideConstantsFolder", data: { name: "apiUrl" } },
                {
                    messageId: "missingScreamingSnakeCase",
                    data: { name: "apiUrl", suggested: "API_URL" }
                }
            ]
        },

        // --- Multiple constants in one file ---
        {
            name: "multiple plain constants outside constants folder",
            code: [
                "const config = { retries: 3 }",
                "const items = [1, 2, 3]",
                "const MAX_TIMEOUT = 5000 as const"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "constantOutsideConstantsFolder", data: { name: "config" } },
                { messageId: "constantOutsideConstantsFolder", data: { name: "items" } },
                { messageId: "constantOutsideConstantsFolder", data: { name: "MAX_TIMEOUT" } }
            ]
        },

        // --- Constants alongside components/hooks (only constants reported) ---
        {
            name: "plain constant alongside a component — only the constant is reported",
            code: ["const THRESHOLD = 10", "const Foo = () => <div />"].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "constantOutsideConstantsFolder", data: { name: "THRESHOLD" } },
                { messageId: "missingAsConst", data: { name: "THRESHOLD" } }
            ]
        },
        {
            name: "plain constant alongside a hook definition — only the constant is reported",
            code: ['const defaultLabel = "untitled"', "function useFoo() { return 1 }"].join("\n"),
            filename: "src/hooks/useFoo.ts",
            errors: [
                { messageId: "constantOutsideConstantsFolder", data: { name: "defaultLabel" } },
                {
                    messageId: "missingScreamingSnakeCase",
                    data: { name: "defaultLabel", suggested: "DEFAULT_LABEL" }
                },
                { messageId: "missingAsConst", data: { name: "defaultLabel" } }
            ]
        }
    ]
})
