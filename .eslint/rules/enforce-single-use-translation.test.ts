import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./enforce-single-use-translation"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

const COMPONENT_FILE = "src/components/MyComponent/index.tsx"
const HOOK_FILE = "src/hooks/useSomething.ts"

ruleTester.run("enforce-single-use-translation", rule, {
    valid: [
        // ── Single namespace call – no prefix required ───────────────────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t } = useTranslation("common")
                    return t("key")
                }
            `,
            filename: COMPONENT_FILE
        },

        // ── Single namespace call with t alias – no prefix required ──────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t: tCommon } = useTranslation("common")
                    return tCommon("key")
                }
            `,
            filename: COMPONENT_FILE
        },

        // ── Array call with single namespace – no prefix required ────────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t } = useTranslation(["common"])
                    return t("key")
                }
            `,
            filename: COMPONENT_FILE
        },

        // ── Multiple namespaces in array – all t() calls have prefix ─────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t } = useTranslation(["common", "project"])
                    return t("common:key")
                }
            `,
            filename: COMPONENT_FILE
        },

        // ── Multiple namespaces – prefixes in nested arrow function ───────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t } = useTranslation(["common", "project"])
                    const handleClick = () => { return t("common:key") }
                    return handleClick()
                }
            `,
            filename: COMPONENT_FILE
        },

        // ── No argument (default namespace) – no prefix required ─────────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t } = useTranslation()
                    return t("key")
                }
            `,
            filename: COMPONENT_FILE
        },

        // ── useTranslation from a non-i18next source is not flagged ──────────────
        {
            code: `
                import { useTranslation } from "../hooks/useTranslation"
                function MyComponent() {
                    const { t: t1 } = useTranslation("common")
                    const { t: t2 } = useTranslation("project")
                    return t1("key") + t2("key2")
                }
            `,
            filename: COMPONENT_FILE
        },

        // ── useTranslation in sibling components (separate scopes) ───────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function CompA() {
                    const { t } = useTranslation("common")
                    return t("key")
                }
                function CompB() {
                    const { t } = useTranslation("project")
                    return t("key")
                }
            `,
            filename: COMPONENT_FILE
        },

        // ── i18next source also treated as i18next ───────────────────────────────
        {
            code: `
                import { useTranslation } from "i18next"
                function MyComponent() {
                    const { t } = useTranslation("common")
                    return t("key")
                }
            `,
            filename: COMPONENT_FILE
        },

        // ── Hook file with single call ────────────────────────────────────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function useMyHook() {
                    const { t } = useTranslation("common")
                    return { t }
                }
            `,
            filename: HOOK_FILE
        },

        // ── Dynamic namespace argument is not enforced ────────────────────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent({ ns }) {
                    const { t } = useTranslation(ns)
                    return t("key")
                }
            `,
            filename: COMPONENT_FILE
        }
    ],

    invalid: [
        // ── Two calls in the same component ──────────────────────────────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t: tCommon } = useTranslation("common")
                    const { t: tProject } = useTranslation("project")
                    return tCommon("key1") + tProject("key2")
                }
            `,
            filename: COMPONENT_FILE,
            errors: [{ messageId: "multipleCalls" }]
        },

        // ── Three calls in the same component ────────────────────────────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t: tA } = useTranslation("a")
                    const { t: tB } = useTranslation("b")
                    const { t: tC } = useTranslation("c")
                    return tA("x") + tB("y") + tC("z")
                }
            `,
            filename: COMPONENT_FILE,
            errors: [{ messageId: "multipleCalls" }, { messageId: "multipleCalls" }]
        },

        // ── Two calls in the same hook ────────────────────────────────────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function useMyHook() {
                    const { t } = useTranslation("common")
                    const { t: tReport } = useTranslation("report")
                    return { t, tReport }
                }
            `,
            filename: HOOK_FILE,
            errors: [{ messageId: "multipleCalls" }]
        },

        // ── Multiple namespaces without prefix on t() call ───────────────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t } = useTranslation(["common", "project"])
                    return t("key-without-prefix")
                }
            `,
            filename: COMPONENT_FILE,
            errors: [{ messageId: "missingNamespacePrefix" }]
        },

        // ── Multiple namespaces, some calls have prefix some don't ────────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t } = useTranslation(["common", "project"])
                    const a = t("common:key")
                    const b = t("missing-prefix")
                    const c = t("project:other")
                    return a + b + c
                }
            `,
            filename: COMPONENT_FILE,
            errors: [{ messageId: "missingNamespacePrefix" }]
        },

        // ── Multiple namespaces – t alias without prefix in nested function ───────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t } = useTranslation(["common", "project"])
                    const render = () => t("no-prefix")
                    return render()
                }
            `,
            filename: COMPONENT_FILE,
            errors: [{ messageId: "missingNamespacePrefix" }]
        },

        // ── Single multi-namespace call with unprefixed t() ────────────────────────
        {
            code: `
                import { useTranslation } from "react-i18next"
                function MyComponent() {
                    const { t } = useTranslation(["a", "b"])
                    return t("no-prefix")
                }
            `,
            filename: COMPONENT_FILE,
            errors: [{ messageId: "missingNamespacePrefix" }]
        }
    ]
})
