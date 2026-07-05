import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./enforce-type-location"

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

ruleTester.run("enforce-type-location", rule, {
    valid: [
        // Props interfaces are allowed in .tsx files
        {
            code: "interface IButtonProps { text: string }",
            filename: "src/components/Button/index.tsx"
        },
        {
            code: "type IMyComponentProps = { text: string }",
            filename: "src/components/MyComponent/index.tsx"
        },
        {
            code: "type IExtendedProps = IBaseProps & { extra: boolean }",
            filename: "src/components/Extended/index.tsx"
        },

        // Ref interfaces are allowed in .tsx files (forwardRef imperative handles)
        {
            code: "interface IButtonRef { focus: () => void }",
            filename: "src/components/Button/index.tsx"
        },
        {
            code: "type IMatrixItemsSelectRef = { reset: () => void }",
            filename: "src/components/MatrixItemsSelect/index.tsx"
        },

        // Result interfaces are allowed in hook (.ts) files
        {
            code: "interface IUseOnSessionStreamingEventResult { handle: () => void }",
            filename: "src/hooks/services/useOnSessionStreamingEvent/hooks/useOnSessionStreamingEvent.ts"
        },
        {
            code: "type IUseDataResult = { data: string }",
            filename: "src/components/Foo/hooks/useData.ts"
        },
        {
            code: "export interface IUseFooResult { value: number }",
            filename: "src/components/Foo/hooks/useFoo.ts"
        },

        // Interfaces inside @types folders are allowed
        {
            code: "interface IUser { id: string; name: string }",
            filename: "src/components/UserCard/@types/user.ts"
        },
        {
            code: "type ITabItem = { label: string; value: number }",
            filename: "src/components/Tabs/@types/tabs.ts"
        },
        {
            code: "interface IUser { id: string }",
            filename: "src/@types/user.ts"
        },

        // Type guards inside @types folders are allowed
        {
            code: ["function isUser(value: unknown):", "  value is IUser { return true }"].join("\n"),
            filename: "src/components/UserCard/@types/user.ts"
        },
        {
            code: ["const isUser =", "  (value: unknown): value is IUser => true"].join("\n"),
            filename: "src/components/UserCard/@types/user.ts"
        },
        {
            code: ["const isProject = function(value: unknown):", "  value is IProject { return true }"].join("\n"),
            filename: "src/@types/project.ts"
        },

        // Test and story files are excluded
        {
            code: "interface ITestData { value: string }",
            filename: "src/components/Foo/index.test.tsx"
        },
        {
            code: "interface IMockData { id: string }",
            filename: "src/components/Foo/index.spec.tsx"
        },
        {
            code: "interface IStoryData { value: string }",
            filename: "src/components/Foo/index.stories.tsx"
        },
        {
            code: ["function isMock(v: unknown):", "  v is IMock { return true }"].join("\n"),
            filename: "src/components/Foo/utils/helpers.test.ts"
        },

        // Regular functions (not type guards) are fine anywhere
        {
            code: "function formatDate(d: Date): string { return '' }",
            filename: "src/components/DatePicker/utils/format.ts"
        },
        {
            code: "const formatDate = (d: Date): string => ''",
            filename: "src/components/DatePicker/utils/format.ts"
        },
        {
            code: "function calculate(x: number): number { return x * 2 }",
            filename: "src/components/Chart/index.tsx"
        },

        // Inline type predicates in callbacks are not standalone type guards
        {
            code: ["const filtered = items.filter(", "  (x): x is string => typeof x === 'string'", ")"].join("\n"),
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: ["const mapped = items.filter(", "  (item): item is IFoo => item != null", ")"].join("\n"),
            filename: "src/components/Foo/hooks/useData.ts"
        },

        // JSX with no interfaces or type guards is fine
        {
            code: "const Foo = () => <div>Hello</div>",
            filename: "src/components/Foo/index.tsx"
        }
    ],
    invalid: [
        // Non-Props/Ref interfaces in .tsx files
        {
            code: "interface IUser { id: string; name: string }",
            filename: "src/components/UserCard/index.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },
        {
            code: "type ITabItem = { label: string; value: number }",
            filename: "src/components/Tabs/index.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },
        {
            code: "interface IPropsValidator { validate: () => boolean }",
            filename: "src/components/Form/index.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },
        {
            code: "interface IUserData { email: string }",
            filename: "src/pages/Dashboard/index.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },

        // Exported interfaces in .tsx files
        {
            code: "export interface IModalState { isOpen: boolean }",
            filename: "src/components/Modal/index.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },
        {
            code: "export type IFilterOption = { id: string }",
            filename: "src/components/Filters/index.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },

        // State/Action are forbidden in ALL .tsx files — must live in ./@types
        {
            code: "interface IFooState { count: number }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },
        {
            code: "type IFooAction = { type: 'reset' }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },
        {
            code: "interface IFooState { count: number }",
            filename: "src/components/Foo/contexts/FooContext.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },
        {
            code: "type IFooAction = { type: 'increment' } | { type: 'reset' }",
            filename: "src/components/Foo/contexts/FooContext.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },
        {
            code: "interface IAppState { user: string | null }",
            filename: "src/contexts/AppContext.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },
        {
            code: "type IAppAction = { type: 'SET_USER'; payload: string }",
            filename: "src/contexts/AppContext.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },

        // Type guard function declarations outside @types in component folders
        {
            code: ["function isUser(value: unknown):", "  value is IUser { return true }"].join("\n"),
            filename: "src/components/UserCard/utils/type-guards.ts",
            errors: [{ messageId: "typeGuardOutsideTypes" }]
        },
        {
            code: ["function isActive(value: unknown):", "  value is IActiveItem { return true }"].join("\n"),
            filename: "src/components/List/index.tsx",
            errors: [{ messageId: "typeGuardOutsideTypes" }]
        },

        // Type guard arrow functions outside @types in component folders
        {
            code: ["const isUser =", "  (value: unknown): value is IUser => true"].join("\n"),
            filename: "src/components/UserCard/utils/guards.ts",
            errors: [{ messageId: "typeGuardOutsideTypes" }]
        },

        // Type guard function expressions outside @types in component folders
        {
            code: ["const isUser = function(value: unknown):", "  value is IUser { return true }"].join("\n"),
            filename: "src/components/UserCard/utils/guards.ts",
            errors: [{ messageId: "typeGuardOutsideTypes" }]
        },

        // Type guards in hooks inside component folders outside @types
        {
            code: ["function isValidResponse(r: unknown):", "  r is IResponse { return true }"].join("\n"),
            filename: "src/components/DataView/hooks/useData.ts",
            errors: [{ messageId: "typeGuardOutsideTypes" }]
        },

        // Type guards in constants inside component folders outside @types
        {
            code: ["const isAllowedType =", "  (v: unknown): v is IAllowedType => true"].join("\n"),
            filename: "src/components/Filter/constants/types.ts",
            errors: [{ messageId: "typeGuardOutsideTypes" }]
        },

        // Type guards in page files outside @types
        {
            code: ["function isValidParam(v: unknown):", "  v is IParam { return true }"].join("\n"),
            filename: "src/pages/Dashboard/utils/guards.ts",
            errors: [{ messageId: "typeGuardOutsideTypes" }]
        },

        // Type guards in utility and service .ts files outside @types are also forbidden
        {
            code: ["function isValidToken(v: unknown):", "  v is IToken { return true }"].join("\n"),
            filename: "src/utils/token-guards.ts",
            errors: [{ messageId: "typeGuardOutsideTypes" }]
        },
        {
            code: ["const isValidConfig =", "  (v: unknown): v is IConfig => true"].join("\n"),
            filename: "src/services/config/api/config.api.ts",
            errors: [{ messageId: "typeGuardOutsideTypes" }]
        },

        // Result interfaces are NOT allowed in .tsx component files
        {
            code: "interface IUseDataResult { data: string }",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "interfaceInComponent" }]
        },

        // Non-Props/Ref interfaces in .ts files (hooks, utils, constants)
        {
            code: "interface IHelper { value: string }",
            filename: "src/components/Foo/utils/helpers.ts",
            errors: [{ messageId: "interfaceInHook" }]
        },
        {
            code: "type IConfig = { key: string; value: unknown }",
            filename: "src/components/Foo/constants/config.ts",
            errors: [{ messageId: "interfaceInHook" }]
        },

        // Multiple violations in a single .tsx file
        {
            code: [
                "interface IUser { id: string }",
                "interface IButtonProps { text: string }",
                "type ITabItem = { label: string }",
                "function isUser(value: unknown):",
                "  value is IUser { return true }"
            ].join("\n"),
            filename: "src/components/Mixed/index.tsx",
            errors: [
                { messageId: "interfaceInComponent" },
                { messageId: "interfaceInComponent" },
                { messageId: "typeGuardOutsideTypes" }
            ]
        }
    ]
})
