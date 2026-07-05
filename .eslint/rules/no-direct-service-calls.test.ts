import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./no-direct-service-calls"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

ruleTester.run("no-direct-service-calls", rule, {
    valid: [
        {
            code: "const s = usePrivateProjectService()",
            filename: "src/hooks/queries/useProject.ts"
        },
        {
            code: "const s = usePrivateAnalysisService()",
            filename: "src/hooks/queries/useAnalysis.ts"
        },
        {
            code: "const s = usePrivateProjectService()",
            filename: "src/hooks/services/useProject.ts"
        },

        {
            code: "const s = usePrivateProjectService()",
            filename: "src/components/Foo.test.tsx"
        },
        {
            code: "const s = usePrivateProjectService()",
            filename: "src/components/Foo.spec.ts"
        },
        {
            code: "const s = usePrivateProjectService()",
            filename: "src/hooks/Foo.test.ts"
        },

        {
            code: "const result = doSomething()",
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: "const data = usePrivateData()",
            filename: "src/components/Foo/index.tsx"
        },
        {
            code: "const data = useMyHook()",
            filename: "src/components/Foo/index.tsx"
        }
    ],
    invalid: [
        {
            code: "const s = usePrivateProjectService()",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "noDirectServiceCall" }]
        },
        {
            code: "const s = usePrivateAnalysisService()",
            filename: "src/hooks/useMyHook.ts",
            errors: [{ messageId: "noDirectServiceCall" }]
        },
        {
            code: "const s = usePrivateWorkspaceService()",
            filename: "src/pages/Dashboard/index.tsx",
            errors: [{ messageId: "noDirectServiceCall" }]
        },
        {
            code: "usePrivateExportService()",
            filename: "src/components/ExportButton.tsx",
            errors: [{ messageId: "noDirectServiceCall" }]
        },
        {
            code: "const s = usePrivateInsightService()",
            filename: "src/hooks/useCustomHook.ts",
            errors: [{ messageId: "noDirectServiceCall" }]
        },
        {
            code: "const s = usePublicProjectService()",
            filename: "src/components/Foo/index.tsx",
            errors: [{ messageId: "noDirectServiceCall" }]
        }
    ]
})
