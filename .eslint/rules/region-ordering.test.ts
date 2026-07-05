import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./region-ordering"

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

ruleTester.run("region-ordering", rule, {
    valid: [
        {
            name: "correct full ordering",
            code: `
                const Comp = () => {
                    // #region Contexts
                    const ctx = useContext(Ctx)
                    // #endregion

                    // #region Services
                    const data = useQuery()
                    // #endregion

                    // #region Custom Hooks
                    const t = useTranslation()
                    // #endregion

                    // #region States
                    const x = useState(0)
                    // #endregion

                    // #region Refs
                    const ref = useRef(null)
                    // #endregion

                    // #region Memos
                    const val = useMemo(() => x, [x])
                    // #endregion

                    // #region Callbacks
                    const fn = useCallback(() => {}, [])
                    // #endregion

                    // #region Custom hooks
                    const hook = useMyHook(val)
                    // #endregion

                    // #region Element memos
                    const el = useMemo(() => null, [])
                    // #endregion

                    // #region Element callbacks
                    const render = useCallback(() => null, [])
                    // #endregion

                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    return null
                }
            `
        },
        {
            name: "partial ordering - only some regions",
            code: `
                const Comp = () => {
                    // #region States
                    const x = useState(0)
                    // #endregion

                    // #region Memos
                    const val = useMemo(() => x, [x])
                    // #endregion

                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    return null
                }
            `
        },
        {
            name: "only one region - no ordering to check",
            code: `
                const Comp = () => {
                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion
                    return null
                }
            `
        },
        {
            name: "no regions at all",
            code: `
                const Comp = () => {
                    const x = useState(0)
                    return null
                }
            `
        },
        {
            name: "contexts before services",
            code: `
                const Comp = () => {
                    // #region Contexts
                    const ctx = useContext(Ctx)
                    // #endregion

                    // #region Services
                    const data = useQuery()
                    // #endregion

                    return null
                }
            `
        },
        {
            name: "services before states (skipping custom hooks)",
            code: `
                const Comp = () => {
                    // #region Services
                    const data = useQuery()
                    // #endregion

                    // #region States
                    const x = useState(0)
                    // #endregion

                    return null
                }
            `
        },
        {
            name: "callbacks before effects",
            code: `
                const Comp = () => {
                    // #region Callbacks
                    const fn = useCallback(() => {}, [])
                    // #endregion

                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    return null
                }
            `
        },
        {
            name: "first Custom Hooks before States, second Custom hooks after Callbacks",
            code: `
                const Comp = () => {
                    // #region Custom Hooks
                    const t = useTranslation()
                    // #endregion

                    // #region States
                    const x = useState(0)
                    // #endregion

                    // #region Callbacks
                    const fn = useCallback(() => {}, [])
                    // #endregion

                    // #region Custom hooks
                    const hook = useMyHook()
                    // #endregion

                    return null
                }
            `
        },
        {
            name: "element memos before element callbacks",
            code: `
                const Comp = () => {
                    // #region Element memos
                    const el = useMemo(() => null, [])
                    // #endregion

                    // #region Element callbacks
                    const render = useCallback(() => null, [])
                    // #endregion

                    return null
                }
            `
        },
        {
            name: "refs before memos",
            code: `
                const Comp = () => {
                    // #region Refs
                    const ref = useRef(null)
                    // #endregion

                    // #region Memos
                    const val = useMemo(() => 1, [])
                    // #endregion

                    return null
                }
            `
        },
        {
            name: "multiple exported functions with independent region ordering",
            code: `
                export function useFirst() {
                    // #region Services
                    const service = useService()
                    // #endregion

                    // #region Custom hooks
                    const queryClient = useQueryClient()
                    const { t } = useTranslation()
                    // #endregion
                }

                export function useSecond() {
                    // #region Services
                    const service = useService()
                    // #endregion

                    // #region Custom hooks
                    const { trackEvent } = useTrackEvent()
                    // #endregion
                }

                export function useThird() {
                    // #region Contexts
                    const { isLoggedIn } = useAuth()
                    // #endregion

                    // #region Services
                    const service = useService()
                    // #endregion
                }
            `
        },
        {
            name: "multiple functions repeating regions independently",
            code: `
                export function useQuery1() {
                    // #region Contexts
                    const { isLoggedIn } = useAuth()
                    // #endregion

                    // #region Services
                    const service = useService()
                    // #endregion
                }

                export function useMutation1() {
                    // #region Services
                    const service = useService()
                    // #endregion

                    // #region Custom hooks
                    const { trackEvent } = useTrackEvent()
                    // #endregion
                }

                export function useMutation2() {
                    // #region Services
                    const service = useService()
                    // #endregion

                    // #region Custom hooks
                    const { t } = useTranslation()
                    // #endregion
                }
            `
        },
        {
            name: "params before services in base hook pattern",
            code: `
                function useBaseHook() {
                    // #region Params
                    const params = useParams()
                    // #endregion

                    // #region Contexts
                    const { isLoggedIn } = useAuth()
                    // #endregion

                    // #region Services
                    const service = useService()
                    // #endregion

                    // #region Custom hooks
                    const queryClient = useQueryClient()
                    // #endregion
                }
            `
        },
        {
            name: "single Custom hooks after Callbacks (second slot without first)",
            code: `
                export function useSessionChat() {
                    // #region States
                    const x = useState(0)
                    // #endregion

                    // #region Refs
                    const ref = useRef(null)
                    // #endregion

                    // #region Memos
                    const val = useMemo(() => 1, [])
                    // #endregion

                    // #region Callbacks
                    const fn = useCallback(() => {}, [])
                    // #endregion

                    // #region Custom hooks
                    const hook = useMyHook()
                    // #endregion

                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    return null
                }
            `
        },
        {
            name: "single Custom hooks after Refs (second slot without first)",
            code: `
                const Comp = () => {
                    // #region Refs
                    const ref = useRef(null)
                    // #endregion

                    // #region Custom Hooks
                    const t = useTranslation()
                    // #endregion

                    return null
                }
            `
        }
    ],
    invalid: [
        {
            name: "services before contexts",
            code: `
                const Comp = () => {
                    // #region Services
                    const data = useQuery()
                    // #endregion

                    // #region Contexts
                    const ctx = useContext(Ctx)
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "outOfOrder" }]
        },
        {
            name: "effects before memos",
            code: `
                const Comp = () => {
                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    // #region Memos
                    const val = useMemo(() => 1, [])
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "outOfOrder" }]
        },
        {
            name: "states before services",
            code: `
                const Comp = () => {
                    // #region States
                    const x = useState(0)
                    // #endregion

                    // #region Services
                    const data = useQuery()
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "outOfOrder" }]
        },
        {
            name: "callbacks before states",
            code: `
                const Comp = () => {
                    // #region Callbacks
                    const fn = useCallback(() => {}, [])
                    // #endregion

                    // #region States
                    const x = useState(0)
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "outOfOrder" }]
        },
        {
            name: "effects before callbacks",
            code: `
                const Comp = () => {
                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    // #region Callbacks
                    const fn = useCallback(() => {}, [])
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "outOfOrder" }]
        },
        {
            name: "element callbacks before element memos",
            code: `
                const Comp = () => {
                    // #region Element callbacks
                    const render = useCallback(() => null, [])
                    // #endregion

                    // #region Element memos
                    const el = useMemo(() => null, [])
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "outOfOrder" }]
        },
        {
            name: "memos before refs",
            code: `
                const Comp = () => {
                    // #region Memos
                    const val = useMemo(() => 1, [])
                    // #endregion

                    // #region Refs
                    const ref = useRef(null)
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "outOfOrder" }]
        },
        {
            name: "unclosed region",
            code: `
                const Comp = () => {
                    // #region Contexts
                    const ctx = useContext(Ctx)
                    return null
                }
            `,
            errors: [{ messageId: "unclosedRegion" }]
        },
        {
            name: "nested region",
            code: `
                const Comp = () => {
                    // #region Contexts
                    const ctx = useContext(Ctx)
                    // #region Services
                    const data = useQuery()
                    // #endregion
                    // #endregion
                    return null
                }
            `,
            errors: [{ messageId: "nestedRegion" }]
        },
        {
            name: "multiple ordering violations",
            code: `
                const Comp = () => {
                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    // #region States
                    const x = useState(0)
                    // #endregion

                    // #region Contexts
                    const ctx = useContext(Ctx)
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "outOfOrder" }, { messageId: "outOfOrder" }]
        },
        {
            name: "unknown region name",
            code: `
                const Comp = () => {
                    // #region States
                    const x = useState(0)
                    // #endregion

                    // #region Helpers
                    const y = doSomething()
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "unknownRegion" }]
        },
        {
            name: "unknown region as the only region",
            code: `
                const Comp = () => {
                    // #region Utilities
                    const x = doSomething()
                    // #endregion

                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "unknownRegion" }]
        },
        {
            name: "multiple unknown regions",
            code: `
                const Comp = () => {
                    // #region Helpers
                    const x = doSomething()
                    // #endregion

                    // #region Utilities
                    const y = doOther()
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "unknownRegion" }, { messageId: "unknownRegion" }]
        },
        {
            name: "unknown region mixed with ordering violation",
            code: `
                const Comp = () => {
                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    // #region Helpers
                    const x = doSomething()
                    // #endregion

                    // #region States
                    const y = useState(0)
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "unknownRegion" }, { messageId: "outOfOrder" }]
        },
        {
            name: "duplicate non-custom-hooks region (States twice)",
            code: `
                const Comp = () => {
                    // #region States
                    const x = useState(0)
                    // #endregion

                    // #region Memos
                    const val = useMemo(() => x, [x])
                    // #endregion

                    // #region States
                    const y = useState(1)
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "duplicateRegion" }, { messageId: "outOfOrder" }]
        },
        {
            name: "duplicate non-custom-hooks region (Effects twice)",
            code: `
                const Comp = () => {
                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "duplicateRegion" }]
        },
        {
            name: "multiple different duplicate regions",
            code: `
                const Comp = () => {
                    // #region States
                    const x = useState(0)
                    // #endregion

                    // #region Memos
                    const val = useMemo(() => x, [x])
                    // #endregion

                    // #region States
                    const y = useState(1)
                    // #endregion

                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "duplicateRegion" }, { messageId: "outOfOrder" }, { messageId: "duplicateRegion" }]
        },
        {
            name: "custom hooks appears three times",
            code: `
                const Comp = () => {
                    // #region Custom Hooks
                    const t = useTranslation()
                    // #endregion

                    // #region States
                    const x = useState(0)
                    // #endregion

                    // #region Callbacks
                    const fn = useCallback(() => {}, [])
                    // #endregion

                    // #region Custom hooks
                    const hook = useMyHook()
                    // #endregion

                    // #region Custom hooks
                    const hook2 = useMyOtherHook()
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "duplicateRegion" }, { messageId: "adjacentDuplicateRegion" }]
        },
        {
            name: "adjacent custom hooks regions",
            code: `
                const Comp = () => {
                    // #region Custom Hooks
                    const t = useTranslation()
                    // #endregion

                    // #region Custom hooks
                    const hook = useMyHook()
                    // #endregion

                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "adjacentDuplicateRegion" }]
        },
        {
            name: "out-of-order region after second Custom hooks",
            code: `
                const Comp = () => {
                    // #region Custom Hooks
                    const t = useTranslation()
                    // #endregion

                    // #region States
                    const x = useState(0)
                    // #endregion

                    // #region Callbacks
                    const fn = useCallback(() => {}, [])
                    // #endregion

                    // #region Custom hooks
                    const hook = useMyHook(fn)
                    // #endregion

                    // #region States
                    const y = useState(1)
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "duplicateRegion" }, { messageId: "outOfOrder" }]
        },
        {
            name: "three adjacent custom hooks (duplicate + adjacent)",
            code: `
                const Comp = () => {
                    // #region Custom Hooks
                    const t = useTranslation()
                    // #endregion

                    // #region Custom hooks
                    const hook = useMyHook()
                    // #endregion

                    // #region Custom hooks
                    const hook2 = useMyOtherHook()
                    // #endregion

                    return null
                }
            `,
            errors: [
                { messageId: "adjacentDuplicateRegion" },
                { messageId: "duplicateRegion" },
                { messageId: "adjacentDuplicateRegion" }
            ]
        },
        {
            name: "bad ordering in one of multiple functions",
            code: `
                export function useFirst() {
                    // #region Services
                    const service = useService()
                    // #endregion

                    // #region Custom hooks
                    const { t } = useTranslation()
                    // #endregion
                }

                export function useSecond() {
                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    // #region States
                    const x = useState(0)
                    // #endregion
                }
            `,
            errors: [{ messageId: "outOfOrder" }]
        },
        {
            name: "single custom hooks before contexts (invalid in both slots)",
            code: `
                const Comp = () => {
                    // #region Custom hooks
                    const hook = useMyHook()
                    // #endregion

                    // #region Contexts
                    const ctx = useContext(Ctx)
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "outOfOrder" }]
        },
        {
            name: "effects before single custom hooks (invalid in both slots)",
            code: `
                const Comp = () => {
                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    // #region Custom hooks
                    const hook = useMyHook()
                    // #endregion

                    return null
                }
            `,
            errors: [{ messageId: "outOfOrder" }]
        },
        {
            name: "multiple functions each with their own violation",
            code: `
                export function useFirst() {
                    // #region Effects
                    useEffect(() => {}, [])
                    // #endregion

                    // #region States
                    const x = useState(0)
                    // #endregion
                }

                export function useSecond() {
                    // #region Callbacks
                    const fn = useCallback(() => {}, [])
                    // #endregion

                    // #region Services
                    const data = useQuery()
                    // #endregion
                }
            `,
            errors: [{ messageId: "outOfOrder" }, { messageId: "outOfOrder" }]
        }
    ]
})
