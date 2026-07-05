import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./no-restricted-axios-auth"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

const ALLOWED_DEFINITION_FILE =
    "src/contexts/services/PrivateServicesProvider/hooks/useAxiosAuth.ts"

const ALLOWED_CONSUMER_FILE =
    "src/contexts/services/PrivateServicesProvider/index.tsx"

ruleTester.run("no-restricted-axios-auth", rule, {
    valid: [
        // ── Definition file is always allowed ──────────────────────────────
        {
            code: "const axiosInstance = useAxiosAuth()",
            filename: ALLOWED_DEFINITION_FILE
        },
        {
            code: "import useAxiosAuth from \"./hooks/useAxiosAuth\"",
            filename: ALLOWED_DEFINITION_FILE
        },

        // ── PrivateServicesProvider entry point is always allowed ──────────
        {
            code: "import useAxiosAuth from \"./hooks/useAxiosAuth\"",
            filename: ALLOWED_CONSUMER_FILE
        },
        {
            code: `
                import useAxiosAuth from "./hooks/useAxiosAuth"
                export default function PrivateServicesProvider() {
                    const axiosInstance = useAxiosAuth()
                }
            `,
            filename: ALLOWED_CONSUMER_FILE
        },

        // ── Unrelated imports must not trigger the rule ────────────────────
        {
            code: "import useAuth from \"@contexts/AuthProvider\"",
            filename: "src/components/MyComponent/index.tsx"
        },
        {
            code: "import axios from \"axios\"",
            filename: "src/hooks/useSomething.ts"
        },
        {
            code: "import { usePrivateServices } from \"@contexts/services/PrivateServicesProvider\"",
            filename: "src/components/MyComponent/index.tsx"
        },

        // ── Calling an unrelated hook named similarly must not trigger ─────
        {
            code: "const result = useAuth()",
            filename: "src/components/MyComponent/index.tsx"
        },
        {
            code: "const result = useAxios()",
            filename: "src/components/MyComponent/index.tsx"
        }
    ],
    invalid: [
        // ── Import via alias in a regular component ────────────────────────
        {
            code: "import useAxiosAuth from \"@hooks/useAxiosAuth\"",
            filename: "src/components/inputs/ImageInput/index.tsx",
            errors: [{ messageId: "noImportAxiosAuth" }]
        },

        // ── Import via relative path in a regular component ───────────────
        {
            code: "import useAxiosAuth from \"../../../hooks/useAxiosAuth\"",
            filename: "src/components/inputs/ImageInput/index.tsx",
            errors: [{ messageId: "noImportAxiosAuth" }]
        },

        // ── Import via relative path in a legacy JS file ──────────────────
        {
            code: "import useAxiosAuth from \"../../hooks/useAxiosAuth\"",
            filename: "src/components/Popups/ImportCSV.js",
            errors: [{ messageId: "noImportAxiosAuth" }]
        },

        // ── Import in a service hook (not the provider) ───────────────────
        {
            code: "import useAxiosAuth from \"@hooks/useAxiosAuth\"",
            filename: "src/hooks/services/useBuilderService.ts",
            errors: [{ messageId: "noImportAxiosAuth" }]
        },

        // ── Import in a page component ────────────────────────────────────
        {
            code: "import useAxiosAuth from \"@hooks/useAxiosAuth\"",
            filename: "src/pages/Dashboard/index.tsx",
            errors: [{ messageId: "noImportAxiosAuth" }]
        },

        // ── Import in a hook outside the allowed path ─────────────────────
        {
            code: "import useAxiosAuth from \"@hooks/useAxiosAuth\"",
            filename: "src/hooks/useMyCustomHook.ts",
            errors: [{ messageId: "noImportAxiosAuth" }]
        },

        // ── Bare call to useAxiosAuth() without a local import ────────────
        //    (e.g. injected via global scope or called through re-export)
        {
            code: "const axiosInstance = useAxiosAuth()",
            filename: "src/components/inputs/ImageInput/index.tsx",
            errors: [{ messageId: "noCallAxiosAuth" }]
        },
        {
            code: "const axiosInstance = useAxiosAuth()",
            filename: "src/hooks/services/useBuilderService.ts",
            errors: [{ messageId: "noCallAxiosAuth" }]
        },
        {
            code: "const axiosInstance = useAxiosAuth()",
            filename: "src/pages/SomePage/index.tsx",
            errors: [{ messageId: "noCallAxiosAuth" }]
        },

        // ── Import + call together should produce two errors ──────────────
        //    (one for import, one WOULD be suppressed because importedLocalNames
        //     is set; but since both are violations let's ensure correct count)
        //    Actually the CallExpression handler skips calls whose name is in
        //    importedLocalNames to avoid double-reporting. Verify that behaviour:
        {
            code: `
                import useAxiosAuth from "@hooks/useAxiosAuth"
                const axiosInstance = useAxiosAuth()
            `,
            filename: "src/components/MyComponent/index.tsx",
            errors: [{ messageId: "noImportAxiosAuth" }]
        },

        // ── Import using a relative path that still ends with /useAxiosAuth ─
        {
            code: "import useAxiosAuth from \"./hooks/useAxiosAuth\"",
            filename: "src/contexts/services/SomeOtherProvider/index.tsx",
            errors: [{ messageId: "noImportAxiosAuth" }]
        },

        // ── Adversarially-named file must NOT be allowed (endsWith guard) ──
        // A file at `src/evil/PrivateServicesProvider/index.tsx` must still
        // be flagged — the full canonical path check prevents false negatives.
        {
            code: "import useAxiosAuth from \"./hooks/useAxiosAuth\"",
            filename: "src/evil/PrivateServicesProvider/index.tsx",
            errors: [{ messageId: "noImportAxiosAuth" }]
        },

        // ── Named re-export import scenario ───────────────────────────────
        {
            code: "import { useAxiosAuth } from \"@hooks/useAxiosAuth\"",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "noImportAxiosAuth" }]
        }
    ]
})
