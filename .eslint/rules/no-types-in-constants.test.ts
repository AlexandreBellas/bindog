import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./no-types-in-constants"

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

ruleTester.run("no-types-in-constants", rule, {
    valid: [
        // Types in @types folders are allowed
        {
            code: "interface IUser { id: string; name: string }",
            filename: "src/components/UserCard/@types/user.ts"
        },
        {
            code: "type ITabItem = { label: string; value: number }",
            filename: "src/components/Tabs/@types/tabs.ts"
        },
        {
            code: "interface IConfig { endpoint: string }",
            filename: "src/@types/config.ts"
        },
        {
            code: "type IStatus = 'active' | 'inactive'",
            filename: "src/@types/status.ts"
        },

        // Types in component files are NOT in scope for this rule
        {
            code: "interface IButtonProps { text: string }",
            filename: "src/components/Button/index.tsx"
        },
        {
            code: "type IFooAction = { type: 'reset' }",
            filename: "src/components/Foo/index.tsx"
        },

        // Types in hook files are NOT in scope for this rule
        {
            code: "interface IHookResult { data: string | null }",
            filename: "src/components/Foo/hooks/useFoo.ts"
        },

        // Types in util files are NOT in scope for this rule
        {
            code: "type IHelperInput = { value: string }",
            filename: "src/components/Foo/utils/helpers.ts"
        },

        // Plain const values in constants files are allowed
        {
            code: "export const MAX_ITEMS = 10 as const",
            filename: "src/components/List/constants/config.ts"
        },
        {
            code: "export const LABELS = { submit: 'Submit', cancel: 'Cancel' } as const",
            filename: "src/components/Form/constants/labels.ts"
        },
        {
            code: "export const STATUS_VALUES = ['active', 'inactive'] as const",
            filename: "src/components/Status/constants/values.ts"
        },

        // Const objects (not type aliases) are allowed in constants files
        {
            code: "export const DocumentType = { Text: 'text', Slides: 'slides' } as const",
            filename: "src/components/Document/constants/documentType.ts"
        },

        // Test files are NOT in scope for this rule even if in constants-like paths
        {
            code: "interface ITestData { value: string }",
            filename: "src/components/Foo/constants/config.test.ts"
        }
    ],
    invalid: [
        // Interface declarations in constants files
        {
            code: "interface IConfig { endpoint: string; timeout: number }",
            filename: "src/components/Api/constants/config.ts",
            errors: [{ messageId: "interfaceInConstantsFile" }]
        },
        {
            code: "export interface IButtonVariant { size: string; color: string }",
            filename: "src/components/Button/constants/variants.ts",
            errors: [{ messageId: "interfaceInConstantsFile" }]
        },
        {
            code: "interface IListItem { id: string; label: string }",
            filename: "src/pages/Dashboard/constants/items.ts",
            errors: [{ messageId: "interfaceInConstantsFile" }]
        },

        // Type alias declarations in constants files
        {
            code: "type IStatus = 'active' | 'inactive' | 'pending'",
            filename: "src/components/Status/constants/status.ts",
            errors: [{ messageId: "typeInConstantsFile" }]
        },
        {
            code: "export type ITheme = 'light' | 'dark'",
            filename: "src/components/ThemeToggle/constants/theme.ts",
            errors: [{ messageId: "typeInConstantsFile" }]
        },
        {
            code: "type IDocumentType = 'text' | 'slides' | 'table'",
            filename: "src/constants/documentType.ts",
            errors: [{ messageId: "typeInConstantsFile" }]
        },

        // Complex type aliases in constants files
        {
            code: "type ICallback = (value: string) => void",
            filename: "src/components/Input/constants/callbacks.ts",
            errors: [{ messageId: "typeInConstantsFile" }]
        },
        {
            code: "type IRecord = Record<string, unknown>",
            filename: "src/components/Data/constants/types.ts",
            errors: [{ messageId: "typeInConstantsFile" }]
        },

        // Multiple violations in the same constants file
        {
            code: ["interface IFoo { id: string }", "type IBar = 'a' | 'b'", "export const MAX = 10 as const"].join(
                "\n"
            ),
            filename: "src/components/Foo/constants/mixed.ts",
            errors: [{ messageId: "interfaceInConstantsFile" }, { messageId: "typeInConstantsFile" }]
        },

        // Nested constants folder paths
        {
            code: "interface IRouteConfig { path: string; exact: boolean }",
            filename: "src/pages/Settings/components/Sidebar/constants/routes.ts",
            errors: [{ messageId: "interfaceInConstantsFile" }]
        },

        // Global constants folder (not component-scoped)
        {
            code: "type IGlobalConfig = { apiUrl: string; version: string }",
            filename: "src/constants/globalConfig.ts",
            errors: [{ messageId: "typeInConstantsFile" }]
        }
    ]
})
