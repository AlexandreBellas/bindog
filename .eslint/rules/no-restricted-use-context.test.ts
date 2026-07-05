import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./no-restricted-use-context"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

// ── Allowed locations ──────────────────────────────────────────────────────────
const CONTEXT_INDEX_FILE = "src/components/MyFeature/contexts/MyProvider/index.tsx"
const CONTEXT_HOOK_FILE = "src/components/MyFeature/contexts/MyProvider/hooks/useMyContext.ts"
const CONTEXT_FLAT_PROVIDER_FILE = "src/contexts/MyProvider.tsx"
const CONTEXT_FLAT_PROVIDER_NESTED = "src/pages/Foo/contexts/FooBarProvider.tsx"
const CONTEXT_NESTED_INDEX = "src/pages/Foo/components/Bar/contexts/BarProvider/index.tsx"
const CONTEXT_NESTED_HOOK = "src/pages/Foo/contexts/FooProvider/hooks/useFooContext.ts"
// Multi-level nesting inside contexts/ is also allowed (e.g. contexts/services/SomeProvider/)
const CONTEXT_SERVICES_INDEX = "src/contexts/services/PrivateServicesProvider/index.tsx"
const CONTEXT_SERVICES_FLAT_PROVIDER = "src/contexts/services/PublicServicesProvider.tsx"
const CONTEXT_SERVICES_HOOK = "src/contexts/services/TrackingServicesProvider/hooks/useTrackingServices.ts"

// ── Disallowed locations ───────────────────────────────────────────────────────
const COMPONENT_FILE = "src/components/MyComponent/index.tsx"
const PAGE_FILE = "src/pages/Dashboard/index.tsx"
const HOOK_FILE = "src/hooks/useSomething.ts"
const UTILS_FILE = "src/utils/someUtil.ts"
const RANDOM_CONTEXT_HOOK = "src/components/MyFeature/hooks/useMyHook.ts"

ruleTester.run("no-restricted-use-context", rule, {
    valid: [
        // ── Context index file ─────────────────────────────────────────────────
        {
            code: "const value = useContext(MyContext)",
            filename: CONTEXT_INDEX_FILE
        },
        {
            code: "const value = React.useContext(MyContext)",
            filename: CONTEXT_INDEX_FILE
        },

        // ── Context hook file ──────────────────────────────────────────────────
        {
            code: "export function useMyContext() { return useContext(MyContext) }",
            filename: CONTEXT_HOOK_FILE
        },
        {
            code: "export function useMyContext() { return React.useContext(MyContext) }",
            filename: CONTEXT_HOOK_FILE
        },

        // ── Flat context provider file ─────────────────────────────────────────
        {
            code: "const value = useContext(MyContext)",
            filename: CONTEXT_FLAT_PROVIDER_FILE
        },
        {
            code: "const value = useContext(MyContext)",
            filename: CONTEXT_FLAT_PROVIDER_NESTED
        },

        // ── Nested context index file ──────────────────────────────────────────
        {
            code: "const value = useContext(BarContext)",
            filename: CONTEXT_NESTED_INDEX
        },

        // ── Nested context hook file ───────────────────────────────────────────
        {
            code: "export function useFooContext() { return useContext(FooContext) }",
            filename: CONTEXT_NESTED_HOOK
        },

        // ── Multi-level nested contexts (contexts/services/Provider) ──────────
        {
            code: "export function usePrivateServices() { return useContext(PrivateServicesContext) }",
            filename: CONTEXT_SERVICES_INDEX
        },
        {
            code: "export function usePublicServices() { return useContext(PublicServicesContext) }",
            filename: CONTEXT_SERVICES_FLAT_PROVIDER
        },
        {
            code: "export function useTrackingServices() { return useContext(TrackingServicesContext) }",
            filename: CONTEXT_SERVICES_HOOK
        },

        // ── Non-useContext calls must not trigger the rule ─────────────────────
        {
            code: "const value = useState(null)",
            filename: COMPONENT_FILE
        },
        {
            code: "const value = useCallback(() => {}, [])",
            filename: COMPONENT_FILE
        },
        {
            code: "const x = someOtherContext()",
            filename: COMPONENT_FILE
        }
    ],

    invalid: [
        // ── Regular component file ─────────────────────────────────────────────
        {
            code: "const value = useContext(MyContext)",
            filename: COMPONENT_FILE,
            errors: [{ messageId: "noUseContext" }]
        },
        {
            code: "const value = React.useContext(MyContext)",
            filename: COMPONENT_FILE,
            errors: [{ messageId: "noUseContext" }]
        },

        // ── Page file ─────────────────────────────────────────────────────────
        {
            code: "const value = useContext(SomeContext)",
            filename: PAGE_FILE,
            errors: [{ messageId: "noUseContext" }]
        },

        // ── Generic hook file (not inside a contexts/ folder) ─────────────────
        {
            code: "export function useHook() { return useContext(MyContext) }",
            filename: HOOK_FILE,
            errors: [{ messageId: "noUseContext" }]
        },
        {
            code: "export function useMyHook() { return useContext(MyContext) }",
            filename: RANDOM_CONTEXT_HOOK,
            errors: [{ messageId: "noUseContext" }]
        },

        // ── Utility file ──────────────────────────────────────────────────────
        {
            code: "const value = useContext(SomeContext)",
            filename: UTILS_FILE,
            errors: [{ messageId: "noUseContext" }]
        },

        // ── Multiple useContext calls in the same file ─────────────────────────
        {
            code: `
                const a = useContext(ContextA)
                const b = useContext(ContextB)
            `,
            filename: COMPONENT_FILE,
            errors: [{ messageId: "noUseContext" }, { messageId: "noUseContext" }]
        },

        // ── useContext inside function body in a non-context file ─────────────
        {
            code: `
                function MyComponent() {
                    const value = useContext(MyContext)
                    return null
                }
            `,
            filename: COMPONENT_FILE,
            errors: [{ messageId: "noUseContext" }]
        },

        // ── React.useContext form in a page file ──────────────────────────────
        {
            code: "const v = React.useContext(ThemeContext)",
            filename: PAGE_FILE,
            errors: [{ messageId: "noUseContext" }]
        },

        // ── Context file that does NOT match any allowed pattern ──────────────
        // A file named context/Something.tsx (missing the "Provider" suffix) is not allowed
        {
            code: "const value = useContext(MyContext)",
            filename: "src/components/MyFeature/context/MyContext.tsx",
            errors: [{ messageId: "noUseContext" }]
        },
        // A hook file outside a contexts/ subfolder is not allowed
        {
            code: "const value = useContext(MyContext)",
            filename: "src/components/MyFeature/contexts/hooks/useMyContext.ts",
            errors: [{ messageId: "noUseContext" }]
        }
    ]
})
