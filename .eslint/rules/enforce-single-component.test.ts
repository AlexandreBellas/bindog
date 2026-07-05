import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./enforce-single-component"

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

ruleTester.run("enforce-single-component", rule, {
    valid: [
        // Single default-exported function declaration
        {
            code: "export default function MyComponent() { return <div /> }",
            filename: "src/components/Foo/index.tsx"
        },

        // Single default-exported anonymous function declaration
        {
            code: "export default function() { return <div /> }",
            filename: "src/components/Foo/index.tsx"
        },

        // Single default-exported arrow function
        {
            code: "export default () => <div />",
            filename: "src/components/Foo/index.tsx"
        },

        // Arrow function with separate default export
        {
            code: [
                "const MyComponent = () => <div />",
                "export default MyComponent"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // Function declaration with separate default export
        {
            code: [
                "function MyComponent() { return <div /> }",
                "export default MyComponent"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // memo-wrapped default export
        {
            code: "export default memo(() => <div />)",
            filename: "src/components/Foo/index.tsx"
        },

        // React.memo-wrapped default export
        {
            code: "export default React.memo(() => <div />)",
            filename: "src/components/Foo/index.tsx"
        },

        // forwardRef-wrapped default export
        {
            code: "export default forwardRef((props, ref) => <div ref={ref} />)",
            filename: "src/components/Foo/index.tsx"
        },

        // React.forwardRef-wrapped default export
        {
            code: "export default React.forwardRef((props, ref) => <div ref={ref} />)",
            filename: "src/components/Foo/index.tsx"
        },

        // memo variable with separate default export
        {
            code: [
                "const MyComponent = memo(() => <div />)",
                "export default MyComponent"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // forwardRef variable with separate default export
        {
            code: [
                "const MyComponent = forwardRef((props, ref) => <div ref={ref} />)",
                "export default MyComponent"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // Function declaration wrapped with memo at default export
        {
            code: [
                "function MyComponent() { return <div /> }",
                "export default memo(MyComponent)"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // Function declaration wrapped with React.memo at default export
        {
            code: [
                "function MyComponent() { return <div /> }",
                "export default React.memo(MyComponent)"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // Arrow function component wrapped with forwardRef at default export
        {
            code: [
                "const MyComponent = (props) => <div />",
                "export default forwardRef(MyComponent)"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // File with no component definitions (types, constants, etc.)
        {
            code: [
                "export interface IFoo { bar: string }",
                "export const FOO = 42"
            ].join("\n"),
            filename: "src/types/foo.tsx"
        },

        // Hooks are not components
        {
            code: "export default function useFoo() { return 1 }",
            filename: "src/hooks/useFoo.ts"
        },

        // camelCase functions are not components
        {
            code: [
                "function helper() { return 1 }",
                "export default function MyComponent() { return <div /> }"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // Non-function constants with PascalCase are not components
        {
            code: [
                "const MyContext = createContext(null)",
                "export default function MyComponent() { return <div /> }"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // Nested function components (inside the main component) are not module-scope
        {
            code: [
                "export default function MyComponent() {",
                "  const Inner = () => <span />",
                "  return <div><Inner /></div>",
                "}"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // Named export alongside default export — named export is a hook, not a component
        {
            code: [
                "export function useMyHook() { return true }",
                "export default function MyComponent() { return <div /> }"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },

        // export default with function expression (anonymous via expression)
        {
            code: [
                "export default (function() { return <div /> })"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        }
    ],
    invalid: [
        // Single component without default export — function declaration
        {
            code: "function MyComponent() { return <div /> }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "missingDefaultExport", data: { name: "MyComponent" } }]
        },

        // Single component without default export — arrow function
        {
            code: "const MyComponent = () => <div />",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "missingDefaultExport", data: { name: "MyComponent" } }]
        },

        // Single component without default export — function expression
        {
            code: "const MyComponent = function() { return <div /> }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "missingDefaultExport", data: { name: "MyComponent" } }]
        },

        // Single component with named export only
        {
            code: "export function MyComponent() { return <div /> }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "missingDefaultExport", data: { name: "MyComponent" } }]
        },

        // Single component with named const export only
        {
            code: "export const MyComponent = () => <div />",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "missingDefaultExport", data: { name: "MyComponent" } }]
        },

        // memo without default export
        {
            code: "const MyComponent = memo(() => <div />)",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "missingDefaultExport", data: { name: "MyComponent" } }]
        },

        // forwardRef without default export
        {
            code: "const MyComponent = forwardRef((props, ref) => <div ref={ref} />)",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "missingDefaultExport", data: { name: "MyComponent" } }]
        },

        // Two component definitions — both flagged
        {
            code: [
                "const Foo = () => <div />",
                "const Bar = () => <span />"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "multipleComponents", data: { count: "2" } },
                { messageId: "multipleComponents", data: { count: "2" } }
            ]
        },

        // Two components — one default-exported, one not (still invalid: two definitions)
        {
            code: [
                "export default function Foo() { return <div /> }",
                "function Bar() { return <span /> }"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "multipleComponents", data: { count: "2" } },
                { messageId: "multipleComponents", data: { count: "2" } }
            ]
        },

        // Two components — arrow + function declaration
        {
            code: [
                "const Foo = () => <div />",
                "function Bar() { return <span /> }"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "multipleComponents", data: { count: "2" } },
                { messageId: "multipleComponents", data: { count: "2" } }
            ]
        },

        // Three components — all flagged
        {
            code: [
                "const Foo = () => <div />",
                "const Bar = () => <span />",
                "function Baz() { return <p /> }"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "multipleComponents", data: { count: "3" } },
                { messageId: "multipleComponents", data: { count: "3" } },
                { messageId: "multipleComponents", data: { count: "3" } }
            ]
        },

        // Two components — one memo, one arrow
        {
            code: [
                "const Foo = memo(() => <div />)",
                "const Bar = () => <span />"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "multipleComponents", data: { count: "2" } },
                { messageId: "multipleComponents", data: { count: "2" } }
            ]
        },

        // Two components — named function + anonymous default export
        {
            code: [
                "function Sidebar() { return <nav /> }",
                "export default () => <div />"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "multipleComponents", data: { count: "2" } },
                { messageId: "multipleComponents", data: { count: "2" } }
            ]
        },

        // Two components — default-exported named + separate named export
        {
            code: [
                "export default function Main() { return <div /> }",
                "export const Secondary = () => <span />"
            ].join("\n"),
            filename: "src/components/Main/index.tsx",
            errors: [
                { messageId: "multipleComponents", data: { count: "2" } },
                { messageId: "multipleComponents", data: { count: "2" } }
            ]
        },

        // React.memo and React.forwardRef — two components
        {
            code: [
                "const Foo = React.memo(() => <div />)",
                "const Bar = React.forwardRef((props, ref) => <span ref={ref} />)"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [
                { messageId: "multipleComponents", data: { count: "2" } },
                { messageId: "multipleComponents", data: { count: "2" } }
            ]
        },

        // Route-file pattern: component passed as callback with no default export.
        // NOTE: in practice src/routes/** is excluded via the ESLint config ignores so these
        // files never trigger this rule. This test documents what the rule would report if the
        // pattern appeared outside of that exclusion zone.
        {
            code: [
                "function NotFound() { return <div /> }",
                'export const Route = createFileRoute("/$")({ component: NotFound })'
            ].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "missingDefaultExport", data: { name: "NotFound" } }]
        },

        // Compound component pattern using Object.assign — non-standard, must be fixed.
        // The root component (RootComp) is not directly default-exported; instead it is aliased
        // via Object.assign before export. The rule flags the root component for missing default
        // export, guiding developers to remove the Object.assign pattern.
        {
            code: [
                "const RootComp = ({ children }) => <div>{children}</div>",
                "const MyComp = Object.assign(RootComp, { Sub: () => <span /> })",
                "export default MyComp"
            ].join("\n"),
            filename: "src/components/MyComp/index.tsx",
            errors: [{ messageId: "missingDefaultExport", data: { name: "RootComp" } }]
        },

        // Named provider export — context providers must use default export, not named export.
        // Non-standard pattern that must be fixed.
        {
            code: "export function MyProvider({ children }) { return <div>{children}</div> }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "missingDefaultExport", data: { name: "MyProvider" } }]
        },

        // Named const provider export — same as above but arrow function variant.
        {
            code: "export const MyProvider = ({ children }) => <div>{children}</div>",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "missingDefaultExport", data: { name: "MyProvider" } }]
        }
    ]
})
