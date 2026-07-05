import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./no-non-null-assertion"

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

const TS = "src/utils/helper.ts"
const TSX = "src/components/MyComponent/index.tsx"

ruleTester.run("no-non-null-assertion", rule, {
    valid: [
        // Optional chaining — preferred alternative
        {
            code: "const value = obj?.property",
            filename: TS
        },

        // Nullish coalescing — preferred alternative
        {
            code: "const value = maybeNull ?? 'default'",
            filename: TS
        },

        // Type guard — preferred alternative
        {
            code: "if (value !== null && value !== undefined) { const x = value.name }",
            filename: TS
        },

        // Optional chaining with method call — preferred alternative
        {
            code: "const result = obj?.method()",
            filename: TS
        },

        // Optional chaining with array indexing — preferred alternative
        {
            code: "const item = arr?.[0]",
            filename: TS
        },

        // Regular property access on non-nullable value
        {
            code: "const value = obj.property",
            filename: TS
        },

        // Regular method call on non-nullable value
        {
            code: "const result = obj.method()",
            filename: TS
        },

        // Logical AND guard
        {
            code: "const name = user && user.name",
            filename: TS
        },

        // Type assertion is a different node (TSAsExpression), not a non-null
        {
            code: "const el = document.getElementById('root') as HTMLElement",
            filename: TS
        },

        // Optional chaining in a TSX component
        {
            code: "const MyComponent = () => <div>{value?.label}</div>",
            filename: TSX
        },

        // Nullish coalescing in TSX
        {
            code: "const MyComponent = () => <div>{value ?? 'fallback'}</div>",
            filename: TSX
        },

        // Arithmetic negation (unary minus) — not a non-null assertion
        {
            code: "const neg = -value",
            filename: TS
        },

        // Logical NOT — not a non-null assertion
        {
            code: "const inverted = !flag",
            filename: TS
        },

        // Double logical NOT — not a non-null assertion
        {
            code: "const bool = !!value",
            filename: TS
        }
    ],
    invalid: [
        // Simple non-null on identifier
        {
            code: "const value = maybeNull!",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null on property access
        {
            code: "const name = user!.name",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null on function call return value
        {
            code: "const el = document.getElementById('root')!",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null on array index access
        {
            code: "const first = arr![0]",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null followed by method call
        {
            code: "const result = maybeObj!.method()",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Chained non-null assertions
        {
            code: "const value = a!!",
            filename: TS,
            errors: [
                { messageId: "noNonNullAssertion" },
                { messageId: "noNonNullAssertion" }
            ]
        },

        // Non-null inside a function argument
        {
            code: "doSomething(value!)",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null on the result of another expression
        {
            code: "const node = (parent.children[0])!",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null in variable declaration with type annotation
        {
            code: "const el: HTMLElement = document.getElementById('id')!",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null in a TSX file on a prop value
        {
            code: "const MyComponent = () => <input value={text!} />",
            filename: TSX,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null in a TSX file on JSX expression container
        {
            code: "const MyComponent = () => <div>{value!.label}</div>",
            filename: TSX,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null inside an arrow function body
        {
            code: "const getName = (user: IUser | null) => user!.name",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null as part of assignment
        {
            code: "this.service = injected!",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null on optional chaining — mixing both operators
        {
            code: "const value = obj?.child!.name",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null in return statement
        {
            code: "function getValue() { return maybeNull! }",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        },

        // Non-null on array element access
        {
            code: "const item = items[0]!",
            filename: TS,
            errors: [{ messageId: "noNonNullAssertion" }]
        }
    ]
})
