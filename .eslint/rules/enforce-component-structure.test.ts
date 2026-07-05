import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it, vi } from "vitest"

/**
 * Directories that are component structure roots (they contain index.tsx/index.ts).
 *
 * We only list the directories that act as roots; the file-system mock returns
 * true for index.tsx/index.ts inside these, and false everywhere else.
 */
const COMPONENT_ROOTS = new Set([
    // Top-level components
    "src/components/Foo",
    "src/components/Bar",
    "src/components/Chat",
    "src/components/AppBar",
    "src/components/MyComponent",
    // Nested within components/
    "src/components/Foo/components/Bar",
    "src/components/Foo/components/Bar/components/Baz",
    "src/components/AppBar/components/AppBarBreadcrumb",
    "src/components/AppBar/docs/CsvExportBreadcrumbDemo",
    // Hooks inside components
    "src/components/Foo/hooks/useFoo",
    // Contexts inside components
    "src/components/Foo/contexts/FooProvider",
    // Pages
    "src/pages/Dashboard",
    "src/pages/Chat",
    // Nested pages (grouping folder without its own index)
    "src/pages/Project/ProjectArea",
    "src/pages/Project/ProjectArea/components/OutlineTab",
    // Real-world components with the 'types' violation
    "src/components/Project/QuestionFilters"
])

vi.mock("node:fs", () => {
    const existsSyncFn = vi.fn((p: string) => {
        const normalised = p.replace(/\\/g, "/")
        // Strip trailing /index.tsx or /index.ts to get the directory path
        const indexTsx = normalised.endsWith("/index.tsx")
        const indexTs = normalised.endsWith("/index.ts")
        if (!indexTsx && !indexTs) return false

        const dir = normalised.slice(0, normalised.lastIndexOf("/"))
        return COMPONENT_ROOTS.has(dir)
    })

    return { default: { existsSync: existsSyncFn }, existsSync: existsSyncFn }
})

import rule from "./enforce-component-structure"

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

// ── Trivial program used for all tests ───────────────────────────────────────
const code = "export default 1"

// ── Valid paths ───────────────────────────────────────────────────────────────

ruleTester.run("enforce-component-structure (valid)", rule, {
    valid: [
        // ── Component root entry files ────────────────────────────────────────
        {
            name: "component index.tsx at root",
            code,
            filename: "src/components/Foo/index.tsx"
        },
        {
            name: "component index.ts at root",
            code,
            filename: "src/components/Foo/index.ts"
        },
        {
            name: "page index.tsx at root",
            code,
            filename: "src/pages/Dashboard/index.tsx"
        },

        // ── utils/ ────────────────────────────────────────────────────────────
        {
            name: "utils .ts file under component",
            code,
            filename: "src/components/Foo/utils/helper.ts"
        },
        {
            name: "utils .test.ts file under component",
            code,
            filename: "src/components/Foo/utils/helper.test.ts"
        },
        {
            name: "utils .ts file under page",
            code,
            filename: "src/pages/Dashboard/utils/dateUtils.ts"
        },
        {
            name: "utils .test.ts file under page",
            code,
            filename: "src/pages/Dashboard/utils/dateUtils.test.ts"
        },
        {
            name: "utils .tsx file (e.g. render functions)",
            code,
            filename: "src/components/Foo/utils/renderItem.tsx"
        },
        {
            name: "utils .test.tsx file under component",
            code,
            filename: "src/components/Foo/utils/renderItem.test.tsx"
        },

        // ── components/ ───────────────────────────────────────────────────────
        {
            name: "nested component index.tsx",
            code,
            filename: "src/components/Foo/components/Bar/index.tsx"
        },
        {
            name: "nested component index.test.tsx",
            code,
            filename: "src/components/Foo/components/Bar/index.test.tsx"
        },
        {
            name: "nested component index.stories.tsx",
            code,
            filename: "src/components/Foo/components/Bar/index.stories.tsx"
        },
        {
            name: "deeply nested component index.tsx",
            code,
            filename: "src/components/Foo/components/Bar/components/Baz/index.tsx"
        },
        {
            name: "nested component utils",
            code,
            filename: "src/components/Foo/components/Bar/utils/helper.ts"
        },
        {
            name: "nested component constants",
            code,
            filename: "src/components/Foo/components/Bar/constants/config.ts"
        },

        // ── hooks/ ────────────────────────────────────────────────────────────
        {
            name: "flat hook .ts file directly in hooks/",
            code,
            filename: "src/components/Foo/hooks/useFoo.ts"
        },
        {
            name: "flat hook test file (.test.ts) directly in hooks/",
            code,
            filename: "src/components/Foo/hooks/useFoo.test.ts"
        },
        {
            name: "hook folder index.ts",
            code,
            filename: "src/components/Foo/hooks/useFoo/index.ts"
        },
        {
            name: "hook folder index.test.ts",
            code,
            filename: "src/components/Foo/hooks/useFoo/index.test.ts"
        },
        {
            name: "hook folder sub-structure: utils",
            code,
            filename: "src/components/Foo/hooks/useFoo/utils/helper.ts"
        },
        {
            name: "hook folder sub-structure: utils test file (.test.ts)",
            code,
            filename: "src/components/Foo/hooks/useFoo/utils/helper.test.ts"
        },
        {
            name: "hook folder sub-structure: constants",
            code,
            filename: "src/components/Foo/hooks/useFoo/constants/config.ts"
        },
        {
            name: "hook folder sub-structure: @types",
            code,
            filename: "src/components/Foo/hooks/useFoo/@types/state.ts"
        },

        // ── contexts/ ─────────────────────────────────────────────────────────
        {
            name: "flat provider file (plain structure) directly in contexts/",
            code,
            filename: "src/components/Foo/contexts/FooProvider.tsx"
        },
        {
            name: "flat provider test file (.test.tsx) directly in contexts/",
            code,
            filename: "src/components/Foo/contexts/FooProvider.test.tsx"
        },
        {
            name: "flat provider test file (.test.ts) directly in contexts/",
            code,
            filename: "src/components/Foo/contexts/FooProvider.test.ts"
        },
        {
            name: "context folder index.tsx",
            code,
            filename: "src/components/Foo/contexts/FooProvider/index.tsx"
        },
        {
            name: "context folder index.test.tsx",
            code,
            filename: "src/components/Foo/contexts/FooProvider/index.test.tsx"
        },
        {
            name: "context sub-structure: hooks/ flat file",
            code,
            filename: "src/components/Foo/contexts/FooProvider/hooks/useFoo.ts"
        },
        {
            name: "context sub-structure: hooks/ flat test file (.test.ts)",
            code,
            filename: "src/components/Foo/contexts/FooProvider/hooks/useFoo.test.ts"
        },
        {
            name: "context sub-structure: hooks/ with nested index",
            code,
            filename: "src/components/Foo/contexts/FooProvider/hooks/useFoo/index.ts"
        },
        {
            name: "context sub-structure: hooks/ with nested index.test.ts",
            code,
            filename: "src/components/Foo/contexts/FooProvider/hooks/useFoo/index.test.ts"
        },
        {
            name: "context sub-structure: utils/",
            code,
            filename: "src/components/Foo/contexts/FooProvider/utils/helper.ts"
        },
        {
            name: "context sub-structure: utils/ test file (.test.ts)",
            code,
            filename: "src/components/Foo/contexts/FooProvider/utils/helper.test.ts"
        },
        {
            name: "context sub-structure: @types/",
            code,
            filename: "src/components/Foo/contexts/FooProvider/@types/state.ts"
        },
        {
            name: "context sub-structure: constants/",
            code,
            filename: "src/components/Foo/contexts/FooProvider/constants/config.ts"
        },

        // ── constants/ ────────────────────────────────────────────────────────
        {
            name: "constants .ts file under component",
            code,
            filename: "src/components/Foo/constants/config.ts"
        },
        {
            name: "constants .ts file under page",
            code,
            filename: "src/pages/Dashboard/constants/labels.ts"
        },

        // ── @types/ ───────────────────────────────────────────────────────────
        {
            name: "@types file under component",
            code,
            filename: "src/components/Foo/@types/foo.ts"
        },
        {
            name: "@types file under page",
            code,
            filename: "src/pages/Dashboard/@types/state.ts"
        },

        // ── docs/ ─────────────────────────────────────────────────────────────
        {
            name: "docs file under component",
            code,
            filename: "src/components/Foo/docs/README.md"
        },
        {
            name: "docs sub-folder index under component",
            code,
            filename: "src/components/Foo/docs/demo/index.tsx"
        },

        // ── stores/ ───────────────────────────────────────────────────────────
        {
            name: "stores .ts file under component",
            code,
            filename: "src/components/Foo/stores/fooStore.ts"
        },

        // ── Pages with nested component roots ─────────────────────────────────
        {
            name: "deeply nested page component root index",
            code,
            filename: "src/pages/Project/ProjectArea/index.tsx"
        },
        {
            name: "deeply nested page component with components/ subfolder",
            code,
            filename: "src/pages/Project/ProjectArea/components/OutlineTab/index.tsx"
        },
        {
            name: "deeply nested page hook",
            code,
            filename: "src/pages/Project/ProjectArea/components/OutlineTab/hooks/useOutline.ts"
        },
        {
            name: "deeply nested page context folder",
            code,
            filename: "src/pages/Project/ProjectArea/contexts/ProjectProvider/index.tsx"
        },

        // ── Files outside component structures are always valid ───────────────
        {
            name: "top-level utils file",
            code,
            filename: "src/utils/formatDate.ts"
        },
        {
            name: "top-level hooks file",
            code,
            filename: "src/hooks/useAuth.ts"
        },
        {
            name: "top-level contexts file",
            code,
            filename: "src/contexts/ToastProvider.tsx"
        },
        {
            name: "top-level @types file",
            code,
            filename: "src/@types/base.ts"
        },
        {
            name: "top-level stores file",
            code,
            filename: "src/stores/ui/preferencesStore.ts"
        },
        {
            name: "routes file",
            code,
            filename: "src/routes/_platform/index.tsx"
        },
        {
            name: "services file",
            code,
            filename: "src/services/private/projects/api/projects.api.ts"
        },

        // ── AppBar real-world scenario ───────────────────────────────────
        {
            name: "AppBar contexts flat provider",
            code,
            filename: "src/components/AppBar/contexts/AppBarProvider.tsx"
        },
        {
            name: "AppBar docs sub-component index",
            code,
            filename: "src/components/AppBar/docs/CsvExportBreadcrumbDemo/index.tsx"
        },
        {
            name: "generic nested component with @types",
            code,
            filename: "src/components/Foo/components/Bar/@types/menuSubRow.ts"
        },
        {
            name: "AppBar nested component with constants",
            code,
            filename:
                "src/components/AppBar/components/AppBarBreadcrumb/constants/breadcrumbSlotComponents.ts"
        }
    ],

    invalid: [
        // ── Invalid subfolder directly under component root ───────────────────
        {
            name: "types/ folder (should be @types/)",
            code,
            filename: "src/components/Foo/types/foo.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "types" } }]
        },
        {
            name: "type/ folder (should be @types/)",
            code,
            filename: "src/components/Foo/type/foo.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "type" } }]
        },
        {
            name: "helpers/ folder (should be utils/)",
            code,
            filename: "src/components/Foo/helpers/helper.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "helpers" } }]
        },
        {
            name: "providers/ folder (should be contexts/)",
            code,
            filename: "src/components/Foo/providers/FooProvider.tsx",
            errors: [{ messageId: "invalidFolder", data: { folder: "providers" } }]
        },
        {
            name: "config/ folder (should be constants/)",
            code,
            filename: "src/components/Foo/config/appConfig.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "config" } }]
        },
        {
            name: "service/ folder (not allowed)",
            code,
            filename: "src/components/Foo/service/fooService.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "service" } }]
        },

        // ── Invalid subfolder under pages ─────────────────────────────────────
        {
            name: "types/ folder under page root",
            code,
            filename: "src/pages/Dashboard/types/state.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "types" } }]
        },
        {
            name: "helpers/ folder under page root",
            code,
            filename: "src/pages/Dashboard/helpers/util.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "helpers" } }]
        },

        // ── Invalid subfolder under nested components ─────────────────────────
        {
            name: "helpers/ inside nested component",
            code,
            filename: "src/components/Foo/components/Bar/helpers/util.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "helpers" } }]
        },
        {
            name: "types/ inside nested component (should be @types/)",
            code,
            filename: "src/components/Foo/components/Bar/types/state.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "types" } }]
        },

        // ── Invalid subfolder under hooks sub-structure ───────────────────────
        {
            name: "helpers/ inside hook sub-structure",
            code,
            filename: "src/components/Foo/hooks/useFoo/helpers/util.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "helpers" } }]
        },

        // ── Invalid subfolder under contexts sub-structure ────────────────────
        {
            name: "types/ inside context sub-structure",
            code,
            filename: "src/components/Foo/contexts/FooProvider/types/state.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "types" } }]
        },
        {
            name: "helpers/ inside context sub-structure",
            code,
            filename: "src/components/Foo/contexts/FooProvider/helpers/util.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "helpers" } }]
        },

        // ── Real-world violations from the codebase ───────────────────────────
        {
            name: "Chat/types/ (real-world: should be @types/)",
            code,
            filename: "src/components/Chat/types/index.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "types" } }]
        },
        {
            name: "Project/QuestionFilters/types/ (real-world: should be @types/)",
            code,
            filename: "src/components/Project/QuestionFilters/types/index.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "types" } }]
        },

        // ── Nested page component with invalid subfolder ──────────────────────
        {
            name: "invalid folder inside a deeply nested page component",
            code,
            filename: "src/pages/Project/ProjectArea/components/OutlineTab/helpers/util.ts",
            errors: [{ messageId: "invalidFolder", data: { folder: "helpers" } }]
        }
    ]
})
