import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./enforce-helper-location"

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

ruleTester.run("enforce-helper-location", rule, {
    valid: [
        {
            code: "const Foo = () => <div />",
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: "function useFoo() { return 1 }",
            filename: "src/components/Foo/hooks/useFoo.ts"
        },
        {
            code: "export default function useFoo() { return 1 }",
            filename: "src/components/Foo/hooks/useFoo/index.ts"
        },
        {
            code: "export default () => <div />",
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: "export default function Foo() { return <div /> }",
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: "export default function() { return <div /> }",
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: "export default function() { if (x) { return <div /> } return null }",
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: "export default () => { if (x) { return <div /> } return null }",
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: [
                "import { forwardRef } from 'react'",
                "export default forwardRef(function Foo(props, ref) {",
                "  return <div ref={ref} />",
                "})"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: [
                "import { forwardRef } from 'react'",
                "export default forwardRef((props, ref) => <div ref={ref} />)"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: [
                "import { memo } from 'react'",
                "export default memo(function Foo() { return <div /> })"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: [
                "const Foo = () => {",
                "  const nested = () => 1",
                "  return <div />",
                "}"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: [
                "const Foo = () => {",
                "  function nested() { return 1 }",
                "  return <div />",
                "}"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: [
                "const Foo = () => {",
                "  const items = [1, 2].map((n) => n * 2)",
                "  return <div />",
                "}"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: [
                "function isUser(value: unknown):",
                "  value is IUser { return true }",
                "interface IUser { id: string }",
                "const Foo = (): null => null"
            ].join("\n"),
            filename: "src/components/Foo/@types/user.ts"
        },
        {
            code: "function format(x: number): number { return x }",
            filename: "src/components/Foo/utils/format.ts"
        },
        {
            code: "const format = (x: number): number => x",
            filename: "src/components/Foo/utils/format.ts"
        },
        {
            code: "function helper() {}",
            filename: "src/components/Foo/utils/helper.ts"
        },
        {
            code: "function helper() {}",
            filename: "src/utils/global.ts"
        }
    ],
    invalid: [
        {
            code: "function helper() { return 1 }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "helper" } }]
        },
        {
            code: "const helper = () => 1",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "helper" } }]
        },
        {
            code: "const helper = function() { return 1 }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "helper" } }]
        },
        {
            code: "export function helper() { return 1 }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "helper" } }]
        },
        {
            code: "export const helper = () => 1",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "helper" } }]
        },
        {
            code: "export default function notAComponent() { return 1 }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "notAComponent" } }]
        },
        {
            code: "function helper() { return 1 }",
            filename: "src/components/Foo/hooks/useFoo.ts",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "helper" } }]
        },
        {
            code: "const helper = () => 1",
            filename: "src/components/Foo/hooks/useFoo/index.ts",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "helper" } }]
        },
        {
            code: "function helper() { return 1 }",
            filename: "src/hooks/useAuth.ts",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "helper" } }]
        },
        {
            code: ["function format(x: number): string {", "  return String(x)", "}"].join("\n"),
            filename: "src/components/Foo/constants/config.ts",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "format" } }]
        },
        {
            code: ["const format = (x: number): string =>", "  String(x)"].join("\n"),
            filename: "src/components/Foo/contexts/FooContext.tsx",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "format" } }]
        },
        {
            code: "function helper() { return 1 }",
            filename: "src/components/Foo/@types/foo.ts",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "helper" } }]
        },
        {
            code: [
                "function helper() { return 1 }",
                "const Foo = () => <div />"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "helper" } }]
        },
        {
            code: [
                "const Foo = () => {",
                "  const nested = () => 1",
                "  return nested()",
                "}",
                "function moduleHelper() { return 2 }"
            ].join("\n"),
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "plainFunctionMustBeInUtils", data: { name: "moduleHelper" } }]
        },
        {
            code: "export default () => 1",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "plainAnonymousFunctionMustBeInUtils" }]
        }
    ]
})
