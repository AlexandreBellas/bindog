import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, expect, it } from "vitest"
import rule, {
    findParentRelativeSubComponent,
    isAllowedComponentNameParentDepth,
    isAllowedComponentsParentImportDepth
} from "./enforce-component-import-limits"

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

const GLOBAL_FILENAME = "src/components/Foo/index.tsx"
const NESTED_FILENAME = "src/components/Foo/components/Bar/index.tsx"
const DEEP_FILENAME = "src/components/Foo/components/Bar/components/Baz/index.tsx"
const VERY_DEEP_FILENAME = "src/components/Foo/components/Bar/components/Baz/components/Qux/index.tsx"
const DEEPEST_FILENAME = "src/components/Foo/components/Bar/components/Baz/components/Qux/components/Waldo/index.tsx"
const DEEPEST_NESTING5_FILENAME =
    "src/components/Foo/components/Bar/components/Baz/components/Qux/components/Waldo/components/Max/index.tsx"
const PAGE_FILENAME = "src/pages/Project/ProjectArea/components/Panel/index.tsx"
const PAGE_DEEP_FILENAME = "src/pages/Project/ProjectArea/components/Panel/components/Row/index.tsx"
const CREATE_SHEET_FILENAME = "src/pages/Project/ProjectArea/components/CrossTabs/components/CreateSheetPage/index.tsx"
const SIBLING_GRANDCHILD_IMPORT = "../../components/ActionsBox/components/CreateSheetModal/components/BreakdownsSection"

describe("isAllowedComponentsParentImportDepth", () => {
    it.each([
        [0, false],
        [1, true],
        [2, true],
        [5, true]
    ] as const)("parent depth $parentDepth → $expected", (parentDepth, expected) => {
        expect(isAllowedComponentsParentImportDepth(parentDepth)).toBe(expected)
    })
})

describe("findParentRelativeSubComponent", () => {
    it("detects nested components under a sibling path", () => {
        const result = findParentRelativeSubComponent(
            "components/ActionsBox/components/CreateSheetModal/components/BreakdownsSection"
        )
        expect(result.hasIndicator).toBe(true)
        expect(result.topLevel).toBe("ActionsBox")
    })

    it("allows top-level sibling only", () => {
        const result = findParentRelativeSubComponent("components/ActionsBox")
        expect(result.hasIndicator).toBe(false)
        expect(result.topLevel).toBe("ActionsBox")
    })
})

describe("isAllowedComponentNameParentDepth", () => {
    it.each([
        [0, false],
        [1, true],
        [3, true]
    ] as const)("parent depth $parentDepth → $expected", (parentDepth, expected) => {
        expect(isAllowedComponentNameParentDepth(parentDepth)).toBe(expected)
    })
})

ruleTester.run("enforce-component-import-limits", rule, {
    valid: [
        {
            name: "third-party import (react)",
            code: 'import React from "react"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "third-party scoped package",
            code: 'import { useQuery } from "@tanstack/react-query"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "third-party scoped DefinitelyTyped-like package",
            code: 'import foo from "@radix-ui/react-dialog"',
            filename: GLOBAL_FILENAME
        },

        {
            name: "alias import from @components top-level",
            code: 'import Foo from "@components/Foo"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @components barrel path (grouping folder + component)",
            code: 'import Button from "@components/Buttons/ButtonPrimary"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @components with nested grouping folder (no sub-component indicator)",
            code: 'import Foo from "@components/Analysis/AnalysisContent"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @/components top-level",
            code: 'import Foo from "@/components/Foo"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @hooks",
            code: 'import { useThing } from "@hooks/useThing"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @/hooks",
            code: 'import { useThing } from "@/hooks/useThing"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @utils",
            code: 'import { helper } from "@utils/helper"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @/utils",
            code: 'import { helper } from "@/utils/helper"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @contexts",
            code: 'import { ThingProvider } from "@contexts/ThingProvider"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @/contexts",
            code: 'import { ThingProvider } from "@/contexts/ThingProvider"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @constants",
            code: 'import { MAX } from "@constants/limits"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @assets",
            code: 'import logo from "@assets/logo.svg"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @/@types",
            code: 'import type { IThing } from "@/@types/thing"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "alias import from @/errors",
            code: 'import { AuthError } from "@/errors/auth"',
            filename: GLOBAL_FILENAME
        },

        {
            name: "local import from ./components (1st-level child only)",
            code: 'import Bar from "./components/Bar"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "local import from ./hooks",
            code: 'import { useThing } from "./hooks/useThing"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "local import from ./utils",
            code: 'import { helper } from "./utils/helper"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "local import from ./contexts",
            code: 'import { Provider } from "./contexts/Provider"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "local import from ./constants",
            code: 'import { X } from "./constants/x"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "local import from ./@types",
            code: 'import type { IX } from "./@types/x"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "local import from ./providers",
            code: 'import { Provider } from "./providers/Provider"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "local sibling file import",
            code: 'import { foo } from "./foo"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "local import from ./stores",
            code: 'import { useStore } from "./stores/myStore"',
            filename: GLOBAL_FILENAME
        },

        {
            name: "parent import from ../hooks",
            code: 'import { useThing } from "../hooks/useThing"',
            filename: NESTED_FILENAME
        },
        {
            name: "parent import from ../utils",
            code: 'import { helper } from "../utils/helper"',
            filename: NESTED_FILENAME
        },
        {
            name: "parent import from ../contexts",
            code: 'import { Ctx } from "../contexts/Ctx"',
            filename: NESTED_FILENAME
        },
        {
            name: "parent import from ../@types",
            code: 'import type { IX } from "../@types/x"',
            filename: NESTED_FILENAME
        },
        {
            name: "one-level parent import from ../constants",
            code: 'import { MAX } from "../constants/limits"',
            filename: NESTED_FILENAME
        },
        {
            name: "deep parent import from ../../constants",
            code: 'import { MAX } from "../../constants/limits"',
            filename: DEEP_FILENAME
        },
        {
            name: "deep parent import from ../../hooks",
            code: 'import { useThing } from "../../hooks/useThing"',
            filename: DEEP_FILENAME
        },
        {
            name: "deep parent import from ../../../../utils",
            code: 'import { helper } from "../../../../utils/helper"',
            filename: DEEP_FILENAME
        },
        {
            name: "deep parent import from ../../contexts",
            code: 'import { Ctx } from "../../contexts/Ctx"',
            filename: DEEP_FILENAME
        },
        {
            name: "deep parent import from ../../../@types",
            code: 'import type { IX } from "../../../@types/x"',
            filename: DEEP_FILENAME
        },
        {
            name: "sibling import via ../components (depth 1, nesting 1)",
            code: 'import Thing from "../components/Thing"',
            filename: NESTED_FILENAME
        },
        {
            name: "sibling import via ../components under parent (depth 1, nesting 2)",
            code: 'import Thing from "../components/Thing"',
            filename: DEEP_FILENAME
        },
        {
            name: "sibling import via ../../components (depth 2, nesting 2)",
            code: 'import Thing from "../../components/Thing"',
            filename: DEEP_FILENAME
        },
        {
            name: "uncle import via ../../../components (depth 3, nesting 2)",
            code: 'import Thing from "../../../components/Thing"',
            filename: DEEP_FILENAME
        },
        {
            name: "grand-uncle import via ../../../../components (depth 4, nesting 2)",
            code: 'import Thing from "../../../../components/Thing"',
            filename: DEEP_FILENAME
        },
        {
            name: "grand-uncle import via ../../../../../components (depth 5, nesting 2)",
            code: 'import Thing from "../../../../../components/Thing"',
            filename: DEEP_FILENAME
        },
        {
            name: "sibling component import via ../Bro",
            code: 'import Bro from "../Bro"',
            filename: NESTED_FILENAME
        },
        {
            name: "sibling component import via ../../Bro (nesting 2)",
            code: 'import Bro from "../../Bro"',
            filename: DEEP_FILENAME
        },
        {
            name: "grand-uncle component import via ../../../../Other",
            code: 'import Other from "../../../../Other"',
            filename: DEEP_FILENAME
        },
        {
            name: "uncle component import via ../../../Foo (depth 3, nesting 2)",
            code: 'import Foo from "../../../Foo"',
            filename: DEEP_FILENAME
        },

        {
            name: "side-effect import of third-party module",
            code: 'import "react"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "type-only import from @components top-level",
            code: 'import type { IFooProps } from "@components/Foo"',
            filename: GLOBAL_FILENAME
        },

        {
            name: "page component: alias import from @components",
            code: 'import Foo from "@components/Foo"',
            filename: PAGE_FILENAME
        },
        {
            name: "page component: local 1st-level child",
            code: 'import Row from "./components/Row"',
            filename: PAGE_FILENAME
        },
        {
            name: "page component: sibling via ../../components",
            code: 'import Sibling from "../../components/Sibling"',
            filename: PAGE_DEEP_FILENAME
        },
        {
            name: "page component: uncle via ../../../components",
            code: 'import Uncle from "../../../components/Uncle"',
            filename: PAGE_DEEP_FILENAME
        },
        {
            name: "page component: sibling via ../../Other",
            code: 'import Other from "../../Other"',
            filename: PAGE_DEEP_FILENAME
        },
        {
            name: "page component: parent constants at any depth",
            code: 'import { MAX } from "../constants/limits"',
            filename: PAGE_DEEP_FILENAME
        },
        {
            name: "page component: sibling under parent via ../components (depth 1, nesting 2)",
            code: 'import Panel from "../components/Panel"',
            filename: PAGE_DEEP_FILENAME
        },
        {
            name: "page component: top-level sibling via ../../components/ActionsBox",
            code: 'import ActionsBox from "../../components/ActionsBox"',
            filename: CREATE_SHEET_FILENAME
        },
        {
            name: "top-level component: sibling via ../components (nesting 0)",
            code: 'import Thing from "../components/Thing"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "top-level component: sibling by name from parent folder (nesting 0)",
            code: 'import Bro from "../Bro"',
            filename: GLOBAL_FILENAME
        },
        {
            name: "depth-3 component: sibling via ../components (depth 1)",
            code: 'import Thing from "../components/Thing"',
            filename: VERY_DEEP_FILENAME
        },
        {
            name: "depth-3 component: sibling by name via ../ (depth 1)",
            code: 'import Bro from "../Bro"',
            filename: VERY_DEEP_FILENAME
        },
        {
            name: "depth-4 component: cousin via ../../components (depth 2)",
            code: 'import Thing from "../../components/Thing"',
            filename: DEEPEST_FILENAME
        },
        {
            name: "depth-4 component: cousin by name via ../../ (depth 2)",
            code: 'import Bro from "../../Bro"',
            filename: DEEPEST_FILENAME
        },
        {
            name: "depth-5 component: ../../components/ at any nesting depth",
            code: 'import Thing from "../../components/Thing"',
            filename: DEEPEST_NESTING5_FILENAME
        }
    ],
    invalid: [
        {
            name: "import from @pages alias",
            code: 'import { Thing } from "@pages/Dashboard"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importFromDisallowedAlias" }]
        },
        {
            name: "import from @/pages alias",
            code: 'import { Thing } from "@/pages/Dashboard"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importFromDisallowedAlias" }]
        },
        {
            name: "import from @services alias",
            code: 'import { Service } from "@services/project"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importFromDisallowedAlias" }]
        },
        {
            name: "import from @/services alias",
            code: 'import { Service } from "@/services/project"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importFromDisallowedAlias" }]
        },

        {
            name: "sub-component import via @components with components/ indicator",
            code: 'import Bar from "@components/Foo/components/Bar"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importSubComponent" }]
        },
        {
            name: "sub-component import via @/components with components/ indicator",
            code: 'import Bar from "@/components/Foo/components/Bar"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importSubComponent" }]
        },
        {
            name: "sub-component import reaching into hooks/",
            code: 'import { useBar } from "@components/Foo/hooks/useBar"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importSubComponent" }]
        },
        {
            name: "sub-component import reaching into utils/",
            code: 'import { barHelper } from "@components/Foo/utils/barHelper"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importSubComponent" }]
        },
        {
            name: "sub-component import reaching into contexts/",
            code: 'import { Provider } from "@components/Foo/contexts/Provider"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importSubComponent" }]
        },
        {
            name: "sub-component import reaching into constants/",
            code: 'import { X } from "@components/Foo/constants/x"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importSubComponent" }]
        },
        {
            name: "sub-component import reaching into @types/",
            code: 'import type { IX } from "@components/Foo/@types/x"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importSubComponent" }]
        },
        {
            name: "deep sub-component import preserves full topLevel path",
            code: 'import X from "@components/Analysis/AnalysisContent/components/Thing"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "importSubComponent" }]
        },

        {
            name: "local 2nd-level child via ./components/X/components/Y",
            code: 'import Grandchild from "./components/Bar/components/Baz"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "localImportSubComponent" }]
        },
        {
            name: "local child internals via ./components/X/hooks/",
            code: 'import { useBar } from "./components/Bar/hooks/useBar"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "localImportSubComponent" }]
        },
        {
            name: "local child internals via ./components/X/utils/",
            code: 'import { helper } from "./components/Bar/utils/helper"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "localImportSubComponent" }]
        },
        {
            name: "local child internals via ./components/X/contexts/",
            code: 'import { Provider } from "./components/Bar/contexts/Provider"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "localImportSubComponent" }]
        },
        {
            name: "local child internals via ./components/X/constants/",
            code: 'import { X } from "./components/Bar/constants/x"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "localImportSubComponent" }]
        },
        {
            name: "local child internals via ./components/X/@types/",
            code: 'import type { IX } from "./components/Bar/@types/x"',
            filename: GLOBAL_FILENAME,
            errors: [{ messageId: "localImportSubComponent" }]
        },

        {
            name: "parent import from ../providers",
            code: 'import { P } from "../providers/P"',
            filename: NESTED_FILENAME,
            errors: [{ messageId: "parentImportFromDisallowedFolder" }]
        },
        {
            name: "parent import from ../stores",
            code: 'import { useStore } from "../stores/myStore"',
            filename: NESTED_FILENAME,
            errors: [{ messageId: "parentImportFromDisallowedFolder" }]
        },
        {
            name: "bare parent import with no segment",
            code: 'import x from ".."',
            filename: NESTED_FILENAME,
            errors: [{ messageId: "parentImportNotAllowed" }]
        },
        {
            name: "bare deep parent import with no segment",
            code: 'import x from "../../.."',
            filename: DEEP_FILENAME,
            errors: [{ messageId: "parentImportNotAllowed" }]
        },
        {
            name: "page component: import from @pages",
            code: 'import Other from "@pages/Other/OtherPage"',
            filename: PAGE_FILENAME,
            errors: [{ messageId: "importFromDisallowedAlias" }]
        },
        {
            name: "page component: local 2nd-level child",
            code: 'import Cell from "./components/Row/components/Cell"',
            filename: PAGE_FILENAME,
            errors: [{ messageId: "localImportSubComponent" }]
        },
        {
            name: "page component: sibling grand-child via nested components path",
            code: `import { isValidBreakdown } from "${SIBLING_GRANDCHILD_IMPORT}"`,
            filename: CREATE_SHEET_FILENAME,
            errors: [{ messageId: "parentImportSubComponent" }]
        },
        {
            name: "deep component: sibling grand-child under Bar via ../../components",
            code: 'import X from "../../components/Bro/components/Grandchild"',
            filename: DEEP_FILENAME,
            errors: [{ messageId: "parentImportSubComponent" }]
        },
        {
            name: "nested component: sibling internals via ../../Bro/hooks",
            code: 'import { useX } from "../../Bro/hooks/useX"',
            filename: DEEP_FILENAME,
            errors: [{ messageId: "parentImportSubComponent" }]
        }
    ]
})
