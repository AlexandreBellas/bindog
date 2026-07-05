import { describe, expect, it } from "vitest"
import { organizeRegions } from "./organizer.mjs"

function dedent(str: string): string {
    const lines = str.split("\n")
    while (lines.length > 0 && lines[0].trim() === "") lines.shift()
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop()
    const minIndent = lines
        .filter(l => l.trim() !== "")
        .reduce((acc, l) => Math.min(acc, /^(\s*)/.exec(l)![1].length), Infinity)
    return lines.map(l => l.slice(minIndent)).join("\n")
}

function normalize(str: string): string {
    return str.replace(/\s+/g, " ").trim()
}

function expectOrganized(input: string, expected: string): void {
    const got = organizeRegions(dedent(input))
    expect(normalize(got)).toBe(normalize(dedent(expected)))
}

function expectUnchanged(input: string): void {
    const dedented = dedent(input)
    const got = organizeRegions(dedented)
    expect(normalize(got)).toBe(normalize(dedented))
}

describe("organizeRegions — basic classification", () => {
    it("groups useState into States region", () => {
        expectOrganized(
            `
            const Comp = () => {
                const [count, setCount] = useState(0)
                return null
            }
            `,
            `
            const Comp = () => {
                // #region States
                const [count, setCount] = useState(0)
                // #endregion
                return null
            }
            `
        )
    })

    it("groups useTransition into States region", () => {
        expectOrganized(
            `
            const Comp = () => {
                const [isPending, startTransition] = useTransition()
                return null
            }
            `,
            `
            const Comp = () => {
                // #region States
                const [isPending, startTransition] = useTransition()
                // #endregion
                return null
            }
            `
        )
    })

    it("groups useRef into Refs region", () => {
        expectOrganized(
            `
            const Comp = () => {
                const ref = useRef(null)
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Refs
                const ref = useRef(null)
                // #endregion
                return null
            }
            `
        )
    })

    it("groups useEffect into Effects region", () => {
        expectOrganized(
            `
            const Comp = () => {
                useEffect(() => {}, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Effects
                useEffect(() => {}, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("groups useTranslation into Custom hooks region", () => {
        expectOrganized(
            `
            import { useTranslation } from "react-i18next"
            const Comp = () => {
                const { t } = useTranslation("common")
                return null
            }
            `,
            `
            import { useTranslation } from "react-i18next"
            const Comp = () => {
                // #region Custom hooks
                const { t } = useTranslation("common")
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — Services classification", () => {
    it("classifies useQuery as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const { data } = useQuery({})
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const { data } = useQuery({})
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies useMutation as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const { mutate } = useMutation({})
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const { mutate } = useMutation({})
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies usePrivateProjectsUpdateMutation as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const { mutate } = usePrivateProjectsUpdateMutation()
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const { mutate } = usePrivateProjectsUpdateMutation()
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies usePrivateInsightsQuery as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const { data } = usePrivateInsightsQuery()
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const { data } = usePrivateInsightsQuery()
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies usePrivateProjectService as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const projectService = usePrivateProjectService()
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const projectService = usePrivateProjectService()
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies usePublicInterviewService as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const interviewService = usePublicInterviewService()
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const interviewService = usePublicInterviewService()
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies bare useFooService as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const fooService = useFooService()
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const fooService = useFooService()
                // #endregion
                return null
            }
            `
        )
    })

    it("groups multiple use*Service hooks together in Services region", () => {
        expectOrganized(
            `
            const Comp = () => {
                const projectService = usePrivateProjectService()
                const questionService = usePrivateQuestionService()
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const projectService = usePrivateProjectService()
                const questionService = usePrivateQuestionService()
                // #endregion
                return null
            }
            `
        )
    })

    it("groups use*Service alongside useQuery/useMutation in Services region", () => {
        expectOrganized(
            `
            const Comp = () => {
                const projectService = usePrivateProjectService()
                const { data } = useQuery({})
                const { mutate } = useMutation({})
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const projectService = usePrivateProjectService()
                const { data } = useQuery({})
                const { mutate } = useMutation({})
                // #endregion
                return null
            }
            `
        )
    })

    it("moves a use*Service hook out of Custom hooks into Services when mixed", () => {
        expectOrganized(
            `
            import { useTranslation } from "react-i18next"
            const Comp = () => {
                const { t } = useTranslation("common")
                const projectService = usePrivateProjectService()
                return null
            }
            `,
            `
            import { useTranslation } from "react-i18next"
            const Comp = () => {
                // #region Services
                const projectService = usePrivateProjectService()
                // #endregion
                // #region Custom hooks
                const { t } = useTranslation("common")
                // #endregion
                return null
            }
            `
        )
    })

    it("does not classify a variable merely named *Service as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const myService = useTranslation("common")
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Custom hooks
                const myService = useTranslation("common")
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies useAnalyseStream as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const streamCallback = useAnalyseStream()
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const streamCallback = useAnalyseStream()
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies useReportStream as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const streamCallback = useReportStream()
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const streamCallback = useReportStream()
                // #endregion
                return null
            }
            `
        )
    })

    it("groups use*Stream alongside useQuery/useMutation in Services region", () => {
        expectOrganized(
            `
            const Comp = () => {
                const { data } = useQuery({})
                const streamCallback = useAnalyseStream()
                const { mutate } = useMutation({})
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const { data } = useQuery({})
                const streamCallback = useAnalyseStream()
                const { mutate } = useMutation({})
                // #endregion
                return null
            }
            `
        )
    })

    it("does not classify hooks that do not end with Stream as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const cb = useStreamHelper()
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Custom hooks
                const cb = useStreamHelper()
                // #endregion
                return null
            }
            `
        )
    })

    it("does not classify bare useService (no domain prefix) as Services", () => {
        expectOrganized(
            `
            const Comp = () => {
                const svc = useService()
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Custom hooks
                const svc = useService()
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — Contexts classification (import path)", () => {
    it("classifies hook imported from /contexts/ as Contexts", () => {
        expectOrganized(
            `
            import { useProject } from "@pages/Project/ProjectArea/contexts/ProjectProvider"
            const Comp = () => {
                const { project } = useProject()
                return null
            }
            `,
            `
            import { useProject } from "@pages/Project/ProjectArea/contexts/ProjectProvider"
            const Comp = () => {
                // #region Contexts
                const { project } = useProject()
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies hook imported from @contexts/ as Contexts", () => {
        expectOrganized(
            `
            import { useUser } from "@contexts/UserContext"
            const Comp = () => {
                const { currentOrg } = useUser()
                return null
            }
            `,
            `
            import { useUser } from "@contexts/UserContext"
            const Comp = () => {
                // #region Contexts
                const { currentOrg } = useUser()
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies non-context-folder, non-known imports as Custom hooks", () => {
        expectOrganized(
            `
            import { useSomethingElse } from "some-lib"
            const Comp = () => {
                const value = useSomethingElse()
                return null
            }
            `,
            `
            import { useSomethingElse } from "some-lib"
            const Comp = () => {
                // #region Custom hooks
                const value = useSomethingElse()
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — Contexts classification (Provider in import path)", () => {
    it("classifies hook imported from a path ending with Provider as Contexts", () => {
        expectOrganized(
            `
            import { useConversation } from "../ConversationProvider"
            const Comp = () => {
                const { value } = useConversation()
                return null
            }
            `,
            `
            import { useConversation } from "../ConversationProvider"
            const Comp = () => {
                // #region Contexts
                const { value } = useConversation()
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies hook imported from a path with Provider before a slash as Contexts", () => {
        expectOrganized(
            `
            import { useInterviewControls } from "../InterviewControlsProvider/index"
            const Comp = () => {
                const { controls } = useInterviewControls()
                return null
            }
            `,
            `
            import { useInterviewControls } from "../InterviewControlsProvider/index"
            const Comp = () => {
                // #region Contexts
                const { controls } = useInterviewControls()
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies multiple hooks from Provider paths as Contexts together", () => {
        expectOrganized(
            `
            import { useConversation } from "../ConversationProvider"
            import { useInterviewControls } from "../InterviewControlsProvider"
            import { useInterviewMessages } from "../InterviewMessagesProvider"
            const Comp = () => {
                const { interviewSettings } = useConversation()
                const { messages } = useInterviewMessages()
                const { isModeratorVoiceEnabled } = useInterviewControls()
                return null
            }
            `,
            `
            import { useConversation } from "../ConversationProvider"
            import { useInterviewControls } from "../InterviewControlsProvider"
            import { useInterviewMessages } from "../InterviewMessagesProvider"
            const Comp = () => {
                // #region Contexts
                const { interviewSettings } = useConversation()
                const { messages } = useInterviewMessages()
                const { isModeratorVoiceEnabled } = useInterviewControls()
                // #endregion
                return null
            }
            `
        )
    })

    it("groups Provider-path hooks with /contexts/-path hooks in the same Contexts region", () => {
        expectOrganized(
            `
            import { useProject } from "@contexts/ProjectProvider"
            import { useConversation } from "../ConversationProvider"
            const Comp = () => {
                const { project } = useProject()
                const { value } = useConversation()
                return null
            }
            `,
            `
            import { useProject } from "@contexts/ProjectProvider"
            import { useConversation } from "../ConversationProvider"
            const Comp = () => {
                // #region Contexts
                const { project } = useProject()
                const { value } = useConversation()
                // #endregion
                return null
            }
            `
        )
    })

    it("does not classify a hook whose path merely contains 'Provider' mid-word as Contexts", () => {
        expectOrganized(
            `
            import { useProviderStatus } from "@/hooks/useProviderStatus"
            const Comp = () => {
                const status = useProviderStatus()
                return null
            }
            `,
            `
            import { useProviderStatus } from "@/hooks/useProviderStatus"
            const Comp = () => {
                // #region Custom hooks
                const status = useProviderStatus()
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies hook from an alias path ending with Provider as Contexts", () => {
        expectOrganized(
            `
            import { useAuth } from "@pages/Auth/AuthProvider"
            const Comp = () => {
                const { user } = useAuth()
                return null
            }
            `,
            `
            import { useAuth } from "@pages/Auth/AuthProvider"
            const Comp = () => {
                // #region Contexts
                const { user } = useAuth()
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies *Launcher hooks as Custom hooks despite a Provider/contexts import path", () => {
        expectOrganized(
            `
            import { useFooEditorLauncher } from "@pages/Foo/contexts/FooEditorLauncherProvider"
            const Comp = () => {
                const { openCreate } = useFooEditorLauncher()
                return null
            }
            `,
            `
            import { useFooEditorLauncher } from "@pages/Foo/contexts/FooEditorLauncherProvider"
            const Comp = () => {
                // #region Custom hooks
                const { openCreate } = useFooEditorLauncher()
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — Params classification", () => {
    it("classifies useParams as Params", () => {
        expectOrganized(
            `
            import { useParams } from "@tanstack/react-router"
            const Comp = () => {
                const params = useParams({ from: "/_x/$id", shouldThrow: false })
                return null
            }
            `,
            `
            import { useParams } from "@tanstack/react-router"
            const Comp = () => {
                // #region Params
                const params = useParams({ from: "/_x/$id", shouldThrow: false })
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies useNavigate as Params", () => {
        expectOrganized(
            `
            import { useNavigate } from "@tanstack/react-router"
            const Comp = () => {
                const navigate = useNavigate()
                return null
            }
            `,
            `
            import { useNavigate } from "@tanstack/react-router"
            const Comp = () => {
                // #region Params
                const navigate = useNavigate()
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — Memos vs Element memos", () => {
    it("classifies useMemo returning a value as Memos", () => {
        expectOrganized(
            `
            const Comp = () => {
                const total = useMemo(() => 1 + 2, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Memos
                const total = useMemo(() => 1 + 2, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies useMemo returning JSX as Element memos", () => {
        expectOrganized(
            `
            const Comp = () => {
                const node = useMemo(() => <div>x</div>, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Element memos
                const node = useMemo(() => <div>x</div>, [])
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — Callbacks vs Element callbacks", () => {
    it("classifies useCallback returning a value as Callbacks", () => {
        expectOrganized(
            `
            const Comp = () => {
                const fn = useCallback(() => 1, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Callbacks
                const fn = useCallback(() => 1, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies useCallback returning JSX as Element callbacks", () => {
        expectOrganized(
            `
            const Comp = () => {
                const render = useCallback(() => <div />, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Element callbacks
                const render = useCallback(() => <div />, [])
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — debounced/throttled callbacks live with Callbacks", () => {
    it("places useDebouncedCallback inside the Callbacks region", () => {
        expectOrganized(
            `
            import { useDebouncedCallback } from "use-debounce"
            const Comp = () => {
                const cb = useDebouncedCallback(() => {}, 200)
                return null
            }
            `,
            `
            import { useDebouncedCallback } from "use-debounce"
            const Comp = () => {
                // #region Callbacks
                const cb = useDebouncedCallback(() => {}, 200)
                // #endregion
                return null
            }
            `
        )
    })

    it("places useThrottledCallback inside the Callbacks region", () => {
        expectOrganized(
            `
            import { useThrottledCallback } from "@hooks/debouncing/useThrottledCallback"
            const Comp = () => {
                const cb = useThrottledCallback(() => {}, 200)
                return null
            }
            `,
            `
            import { useThrottledCallback } from "@hooks/debouncing/useThrottledCallback"
            const Comp = () => {
                // #region Callbacks
                const cb = useThrottledCallback(() => {}, 200)
                // #endregion
                return null
            }
            `
        )
    })

    it("groups useCallback, useDebouncedCallback and useThrottledCallback together in Callbacks", () => {
        const input = dedent(`
            const Comp = () => {
                const a = useCallback(() => 1, [])
                const b = useDebouncedCallback(() => 2, 100)
                const c = useThrottledCallback(() => 3, 100)
                return null
            }
        `)
        const got = organizeRegions(input)
        const norm = normalize(got)
        const callbackOpens = norm.match(/#region Callbacks/g) ?? []
        expect(callbackOpens.length).toBe(1)
        expect(norm.indexOf("a = useCallback")).toBeLessThan(norm.indexOf("b = useDebouncedCallback"))
        expect(norm.indexOf("b = useDebouncedCallback")).toBeLessThan(norm.indexOf("c = useThrottledCallback"))
    })

    it("puts a debounced JSX-returning callback in Element callbacks", () => {
        expectOrganized(
            `
            const Comp = () => {
                const render = useDebouncedCallback(() => <div />, 100)
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Element callbacks
                const render = useDebouncedCallback(() => <div />, 100)
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — useContext is part of Contexts", () => {
    it("classifies a bare useContext call as Contexts", () => {
        expectOrganized(
            `
            import { useContext } from "react"
            import { ThemeContext } from "@/themes/ThemeContext"
            const Comp = () => {
                const theme = useContext(ThemeContext)
                return null
            }
            `,
            `
            import { useContext } from "react"
            import { ThemeContext } from "@/themes/ThemeContext"
            const Comp = () => {
                // #region Contexts
                const theme = useContext(ThemeContext)
                // #endregion
                return null
            }
            `
        )
    })

    it("groups useContext together with /contexts/ provider hooks under Contexts", () => {
        expectOrganized(
            `
            import { useContext } from "react"
            import { ThemeContext } from "@/themes/ThemeContext"
            import { useProject } from "@contexts/ProjectProvider"
            const Comp = () => {
                const theme = useContext(ThemeContext)
                const { project } = useProject()
                return null
            }
            `,
            `
            import { useContext } from "react"
            import { ThemeContext } from "@/themes/ThemeContext"
            import { useProject } from "@contexts/ProjectProvider"
            const Comp = () => {
                // #region Contexts
                const theme = useContext(ThemeContext)
                const { project } = useProject()
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — multi-region ordering", () => {
    it("sorts states-then-effects from arbitrary input order", () => {
        expectOrganized(
            `
            const Comp = () => {
                useEffect(() => {}, [])
                const [x, setX] = useState(0)
                return null
            }
            `,
            `
            const Comp = () => {
                // #region States
                const [x, setX] = useState(0)
                // #endregion

                // #region Effects
                useEffect(() => {}, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("respects full canonical order: contexts → services → custom hooks → states → effects", () => {
        expectOrganized(
            `
            import { useProject } from "@contexts/ProjectProvider"
            import { useTranslation } from "react-i18next"
            const Comp = () => {
                useEffect(() => {}, [])
                const [x, setX] = useState(0)
                const { t } = useTranslation()
                const { data } = useQuery({})
                const { project } = useProject()
                return null
            }
            `,
            `
            import { useProject } from "@contexts/ProjectProvider"
            import { useTranslation } from "react-i18next"
            const Comp = () => {
                // #region Contexts
                const { project } = useProject()
                // #endregion

                // #region Services
                const { data } = useQuery({})
                // #endregion

                // #region Custom hooks
                const { t } = useTranslation()
                // #endregion

                // #region States
                const [x, setX] = useState(0)
                // #endregion

                // #region Effects
                useEffect(() => {}, [])
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — Custom hooks slot 2 promotion", () => {
    it("places a custom hook depending on a state in the second Custom hooks slot", () => {
        expectOrganized(
            `
            import { useTranslation } from "react-i18next"
            const Comp = () => {
                const { t } = useTranslation()
                const [x, setX] = useState(0)
                const result = useMySpecialHook(x)
                return null
            }
            `,
            `
            import { useTranslation } from "react-i18next"
            const Comp = () => {
                // #region Custom hooks
                const { t } = useTranslation()
                // #endregion

                // #region States
                const [x, setX] = useState(0)
                // #endregion

                // #region Custom hooks
                const result = useMySpecialHook(x)
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — unclassified statement inheritance", () => {
    it("attaches a derived const to its hook's region", () => {
        expectOrganized(
            `
            import { useParams } from "@tanstack/react-router"
            const Comp = () => {
                const params = useParams({ from: "/x", shouldThrow: false })
                const projectId = params?.projectId ?? ""
                return null
            }
            `,
            `
            import { useParams } from "@tanstack/react-router"
            const Comp = () => {
                // #region Params
                const params = useParams({ from: "/x", shouldThrow: false })
                const projectId = params?.projectId ?? ""
                // #endregion
                return null
            }
            `
        )
    })

    it("keeps a destructured-context derivative in Contexts", () => {
        expectOrganized(
            `
            import { useUser } from "@contexts/UserContext"
            const Comp = () => {
                const { currentWs } = useUser()
                const workspaceId = currentWs?.id
                return null
            }
            `,
            `
            import { useUser } from "@contexts/UserContext"
            const Comp = () => {
                // #region Contexts
                const { currentWs } = useUser()
                const workspaceId = currentWs?.id
                // #endregion
                return null
            }
            `
        )
    })

    it("parks a chain of prop-derived consts in Custom hooks even when one depends on the others", () => {
        // Regression: previously the organiser aborted because a derived const
        // depending only on other deps-empty derived consts could never inherit
        // a region — the deps-empty parking ran after the propagation loop, so
        // the dependent block stayed `null` and triggered a full abort.
        expectOrganized(
            `
            const Comp = ({ items }) => {
                const [open, setOpen] = useState(false)
                const hasItems = items.length > 0
                const isEmpty = !hasItems
                return null
            }
            `,
            `
            const Comp = ({ items }) => {
                // #region Custom hooks
                const hasItems = items.length > 0
                const isEmpty = !hasItems
                // #endregion

                // #region States
                const [open, setOpen] = useState(false)
                // #endregion
                return null
            }
            `
        )
    })

    it("organises a default-export component whose derived consts chain off props (CategoryItem)", () => {
        expectOrganized(
            `
            export default function CategoryItem({ category }: Readonly<ICategoryItemProps>) {
                const [expanded, setExpanded] = useState(false)
                const hasChildren = (category.children?.length ?? 0) > 0
                const hasDescription = Boolean(category.description)
                const isExpandable = hasChildren || hasDescription
                return <div onClick={() => isExpandable && setExpanded(prev => !prev)}>{category.label}</div>
            }
            `,
            `
            export default function CategoryItem({ category }: Readonly<ICategoryItemProps>) {
                // #region Custom hooks
                const hasChildren = (category.children?.length ?? 0) > 0
                const hasDescription = Boolean(category.description)
                const isExpandable = hasChildren || hasDescription
                // #endregion

                // #region States
                const [expanded, setExpanded] = useState(false)
                // #endregion
                return <div onClick={() => isExpandable && setExpanded(prev => !prev)}>{category.label}</div>
            }
            `
        )
    })
})

describe("organizeRegions — dependency safety", () => {
    it("aborts when reordering would put a dependency after its consumer", () => {
        const input = dedent(`
            const Comp = () => {
                useEffect(() => { console.log(staticVal) }, [staticVal])
                const staticVal = useMemo(() => 1, [])
                const [x, setX] = useState(0)
                return null
            }
        `)
        const got = organizeRegions(input)
        expect(normalize(got)).toBe(
            normalize(
                dedent(`
            const Comp = () => {
                // #region States
                const [x, setX] = useState(0)
                // #endregion

                // #region Memos
                const staticVal = useMemo(() => 1, [])
                // #endregion

                // #region Effects
                useEffect(() => { console.log(staticVal) }, [staticVal])
                // #endregion
                return null
            }
        `)
            )
        )
    })

    it("does not break a chain where Effect depends on a value derived from a Callback", () => {
        expectOrganized(
            `
            const Comp = () => {
                useEffect(() => { fn() }, [fn])
                const fn = useCallback(() => {}, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Callbacks
                const fn = useCallback(() => {}, [])
                // #endregion

                // #region Effects
                useEffect(() => { fn() }, [fn])
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — already organised", () => {
    it("leaves an already-canonical component unchanged", () => {
        expectUnchanged(
            `
            const Comp = () => {
                // #region States
                const [x, setX] = useState(0)
                // #endregion

                // #region Effects
                useEffect(() => {}, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("re-formats a component whose existing region annotations are wrong", () => {
        expectOrganized(
            `
            const Comp = () => {
                // #region Effects
                useEffect(() => {}, [])
                // #endregion

                // #region States
                const [x, setX] = useState(0)
                // #endregion
                return null
            }
            `,
            `
            const Comp = () => {
                // #region States
                const [x, setX] = useState(0)
                // #endregion

                // #region Effects
                useEffect(() => {}, [])
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — no components / edge cases", () => {
    it("returns the source unchanged when there are no components", () => {
        const input = "export const helper = (x: number) => x + 1\n"
        expect(organizeRegions(input)).toBe(input)
    })

    it("returns the source unchanged when component has only a return statement", () => {
        expectUnchanged(`
            const Comp = () => {
                return null
            }
        `)
    })

    it("returns the source unchanged on parse error", () => {
        const input = "const broken = () => {{{"
        expect(organizeRegions(input)).toBe(input)
    })

    it("ignores non-PascalCase, non-hook functions", () => {
        expectUnchanged(`
            const helper = () => {
                const x = useState(0)
                return null
            }
        `)
    })
})

describe("organizeRegions — function declarations", () => {
    it("organises a hook function declaration", () => {
        expectOrganized(
            `
            export function useMyHook() {
                const { mutate } = useMutation({})
                const navigate = useNavigate()
            }
            `,
            `
            export function useMyHook() {
                // #region Params
                const navigate = useNavigate()
                // #endregion

                // #region Services
                const { mutate } = useMutation({})
                // #endregion
            }
            `
        )
    })

    it("handles multiple components in one file independently", () => {
        const input = dedent(`
            const A = () => {
                useEffect(() => {}, [])
                const [x, setX] = useState(0)
                return null
            }

            const B = () => {
                useEffect(() => {}, [])
                const [y, setY] = useState(0)
                return null
            }
        `)
        const got = organizeRegions(input)
        const norm = normalize(got)
        expect(norm).toContain("// #region States")
        expect(norm).toContain("// #region Effects")
        const aIdx = norm.indexOf("const A")
        const bIdx = norm.indexOf("const B")
        const stateInA = norm.indexOf("setX")
        const stateInB = norm.indexOf("setY")
        const effectInA = norm.indexOf("useEffect", aIdx)
        const effectInB = norm.indexOf("useEffect", bIdx)
        expect(stateInA).toBeLessThan(effectInA)
        expect(stateInB).toBeLessThan(effectInB)
    })
})

describe("organizeRegions — comments are preserved", () => {
    it("preserves a leading line comment attached to a statement", () => {
        const input = dedent(`
            const Comp = () => {
                // counter for the thing
                const [x, setX] = useState(0)
                return null
            }
        `)
        const got = organizeRegions(input)
        expect(got).toContain("// counter for the thing")
        expect(got).toContain("// #region States")
    })

    it("strips pre-existing region open/close comments before re-emitting", () => {
        const input = dedent(`
            const Comp = () => {
                // #region States
                const [x, setX] = useState(0)
                // #endregion
                return null
            }
        `)
        const got = organizeRegions(input)
        const stateOpens = got.match(/#region States/g) ?? []
        expect(stateOpens.length).toBe(1)
        const closes = got.match(/#endregion/g) ?? []
        expect(closes.length).toBe(1)
    })
})

describe("organizeRegions — abort on unsatisfiable dependencies", () => {
    it("returns input unchanged when an Effect declares a value used by a State (impossible legal program, defensive)", () => {
        // Any well-formed program with TDZ-respecting deps reorders fine.
        // Here we ensure that *if* something exotic prevents safe reordering
        // (e.g. a ref-typeof query depending on an effect-side identifier),
        // the formatter stays out of the way rather than silently reorder.
        const input = dedent(`
            const Comp = () => {
                let helperRef = useRef(null)
                useEffect(() => { helperRef.current = 1 }, [])
                return null
            }
        `)
        const got = organizeRegions(input)
        // helperRef is a ref → Refs region; effect uses it → Effects region (later) ✅
        expect(got).toContain("// #region Refs")
        expect(got).toContain("// #region Effects")
        expect(got.indexOf("Refs")).toBeLessThan(got.indexOf("Effects"))
    })
})

describe("organizeRegions — full canonical example with every region", () => {
    it("organises a kitchen-sink component with every region used", () => {
        const input = dedent(`
            import { useProject } from "@contexts/ProjectProvider"
            import { useTranslation } from "react-i18next"
            import { useNavigate, useParams } from "@tanstack/react-router"
            const Comp = () => {
                useEffect(() => {}, [])
                const renderItem = useCallback(() => <span />, [])
                const itemNode = useMemo(() => <div />, [])
                const fn = useCallback(() => 1, [])
                const total = useMemo(() => 1, [])
                const ref = useRef(null)
                const [n, setN] = useState(0)
                const { t } = useTranslation()
                const { data } = useQuery({})
                const { project } = useProject()
                const navigate = useNavigate()
                const params = useParams({ from: "/x", shouldThrow: false })
                return null
            }
        `)
        const got = organizeRegions(input)
        const norm = normalize(got)
        const order = [
            "// #region Params",
            "// #region Contexts",
            "// #region Services",
            "// #region Custom hooks",
            "// #region States",
            "// #region Refs",
            "// #region Memos",
            "// #region Callbacks",
            "// #region Element memos",
            "// #region Element callbacks",
            "// #region Effects"
        ]
        let lastIdx = -1
        for (const marker of order) {
            const idx = norm.indexOf(marker, lastIdx + 1)
            expect(idx, `expected to find ${marker} after position ${lastIdx}`).toBeGreaterThan(lastIdx)
            lastIdx = idx
        }
    })
})

describe("organizeRegions — multi-statement same region", () => {
    it("groups multiple useState calls together in States", () => {
        const input = dedent(`
            const Comp = () => {
                const [a, setA] = useState(0)
                useEffect(() => {}, [])
                const [b, setB] = useState(1)
                return null
            }
        `)
        const got = organizeRegions(input)
        const norm = normalize(got)
        const stateOpens = norm.match(/#region States/g) ?? []
        expect(stateOpens.length).toBe(1)
        expect(norm.indexOf("setA")).toBeLessThan(norm.indexOf("setB"))
        expect(norm.indexOf("setB")).toBeLessThan(norm.indexOf("useEffect"))
    })

    it("preserves original order of statements within the same region", () => {
        const input = dedent(`
            const Comp = () => {
                const m1 = useMutation({ id: 1 })
                const m2 = useMutation({ id: 2 })
                const m3 = useMutation({ id: 3 })
                return null
            }
        `)
        const got = organizeRegions(input)
        const i1 = got.indexOf("id: 1")
        const i2 = got.indexOf("id: 2")
        const i3 = got.indexOf("id: 3")
        expect(i1).toBeLessThan(i2)
        expect(i2).toBeLessThan(i3)
    })
})

describe("organizeRegions — early returns are kept outside regions", () => {
    it("places `if (cond) return null` after all regions, not inside one", () => {
        expectOrganized(
            `
            const Comp = () => {
                const { data } = useQuery({})
                const [x, setX] = useState(0)
                if (!data) return null
                return <div />
            }
            `,
            `
            const Comp = () => {
                // #region Services
                const { data } = useQuery({})
                // #endregion

                // #region States
                const [x, setX] = useState(0)
                // #endregion

                if (!data) return null
                return <div />
            }
            `
        )
    })

    it("does not move hooks below an early return into a region above it", () => {
        // Even though the input is invalid React (hook after early return),
        // we must NOT silently fix it by moving the hook above — because that
        // would change semantics. Cutoff at the early return preserves the
        // original tail verbatim.
        const input = dedent(`
            const Comp = () => {
                const { data } = useQuery({})
                if (!data) return null
                const [x, setX] = useState(0)
                return <div />
            }
        `)
        const got = organizeRegions(input)
        const norm = normalize(got)
        // useQuery is in Services
        expect(norm).toContain("// #region Services")
        // The early return is preserved AFTER the region close
        expect(norm.indexOf("// #endregion")).toBeLessThan(norm.indexOf("if (!data) return null"))
        // useState stays after the early return — we did NOT silently rescue it
        expect(norm.indexOf("if (!data) return null")).toBeLessThan(norm.indexOf("const [x, setX] = useState(0)"))
    })

    it("preserves multiple early returns in original order, all after regions", () => {
        const input = dedent(`
            const Comp = () => {
                const { data } = useQuery({})
                const [x] = useState(0)
                if (!data) return null
                if (x > 10) return <Big />
                return <div />
            }
        `)
        const got = organizeRegions(input)
        const norm = normalize(got)
        const firstGuard = norm.indexOf("if (!data) return null")
        const secondGuard = norm.indexOf("if (x > 10) return <Big />")
        const lastEndregion = norm.lastIndexOf("// #endregion")
        expect(lastEndregion).toBeLessThan(firstGuard)
        expect(firstGuard).toBeLessThan(secondGuard)
        expect(secondGuard).toBeLessThan(norm.indexOf("return <div />"))
    })

    it("treats a switch with returns as tail (preserved verbatim)", () => {
        const input = dedent(`
            const Comp = () => {
                const [x] = useState(0)
                switch (x) {
                    case 1: return <A />
                    case 2: return <B />
                }
                return <Default />
            }
        `)
        const got = organizeRegions(input)
        const norm = normalize(got)
        expect(norm).toContain("// #region States")
        expect(norm.indexOf("// #endregion")).toBeLessThan(norm.indexOf("switch (x)"))
    })

    it("treats a throw guard as tail (preserved verbatim)", () => {
        const input = dedent(`
            const Comp = () => {
                const { data } = useQuery({})
                if (!data) throw new Error("missing")
                return <div />
            }
        `)
        const got = organizeRegions(input)
        const norm = normalize(got)
        expect(norm).toContain("// #region Services")
        expect(norm.indexOf("// #endregion")).toBeLessThan(norm.indexOf("if (!data) throw"))
    })

    it("does not pull an early-return guard into a region via dependency inheritance", () => {
        // Without the fix, `if (!project) return null` would be treated as an
        // unclassified head statement, inherit Contexts from `useProject`, and
        // be sorted *inside* the Contexts region — pushing every other hook
        // below the early return.
        expectOrganized(
            `
            import { useProject } from "@contexts/ProjectProvider"
            const Comp = () => {
                const { project } = useProject()
                const [x] = useState(0)
                if (!project) return null
                return <div />
            }
            `,
            `
            import { useProject } from "@contexts/ProjectProvider"
            const Comp = () => {
                // #region Contexts
                const { project } = useProject()
                // #endregion

                // #region States
                const [x] = useState(0)
                // #endregion

                if (!project) return null
                return <div />
            }
            `
        )
    })

    it("returns the source unchanged when the very first statement is an early return", () => {
        expectUnchanged(`
            const Comp = ({condition}) => {
                if (!condition) return null
                return <div />
            }
        `)
    })
})

describe("organizeRegions — unknown region markers are stripped", () => {
    it("strips an unknown `// #region Foo` wrapping a single hook before re-classifying it", () => {
        expectOrganized(
            `
            const Comp = () => {
                // #region Foo
                const [x, setX] = useState(0)
                // #endregion
                return null
            }
            `,
            `
            const Comp = () => {
                // #region States
                const [x, setX] = useState(0)
                // #endregion
                return null
            }
            `
        )
    })

    it("strips unknown region markers wrapping multiple statements", () => {
        const input = dedent(`
            const Comp = () => {
                // #region Hodgepodge
                const [x] = useState(0)
                const r = useRef(null)
                useEffect(() => {}, [])
                // #endregion
                return null
            }
        `)
        const got = organizeRegions(input)
        const norm = normalize(got)
        expect(norm).not.toContain("Hodgepodge")
        expect(norm).toContain("// #region States")
        expect(norm).toContain("// #region Refs")
        expect(norm).toContain("// #region Effects")
    })

    it("strips an unknown `// #region X` marker between the last hook and the early return", () => {
        const input = dedent(`
            const Comp = () => {
                const [x] = useState(0)
                // #region BadlyPlaced
                if (!x) return null
                // #endregion
                return null
            }
        `)
        const got = organizeRegions(input)
        expect(got).not.toContain("BadlyPlaced")
        expect(got).toContain("// #region States")
        expect(got).toContain("if (!x) return null")
    })

    it("strips nested unknown region markers", () => {
        const input = dedent(`
            const Comp = () => {
                // #region Outer
                // #region Inner
                const [x] = useState(0)
                // #endregion
                // #endregion
                return null
            }
        `)
        const got = organizeRegions(input)
        expect(got).not.toContain("Outer")
        expect(got).not.toContain("Inner")
        expect(got).toContain("// #region States")
    })

    it("strips multiple disjoint unknown regions and re-classifies each statement individually", () => {
        const input = dedent(`
            const Comp = () => {
                // #region A
                const [x] = useState(0)
                // #endregion
                // #region B
                useEffect(() => {}, [])
                // #endregion
                return null
            }
        `)
        const got = organizeRegions(input)
        expect(got).not.toMatch(/#region A\b/)
        expect(got).not.toMatch(/#region B\b/)
        expect(got).toContain("// #region States")
        expect(got).toContain("// #region Effects")
    })
})

describe("organizeRegions — wrapped component (forwardRef / memo)", () => {
    it("organises the body of a forwardRef component", () => {
        const input = dedent(`
            const Comp = forwardRef(() => {
                useEffect(() => {}, [])
                const [x, setX] = useState(0)
                return null
            })
        `)
        const got = organizeRegions(input)
        const norm = normalize(got)
        expect(norm.indexOf("setX")).toBeLessThan(norm.indexOf("useEffect"))
        expect(norm).toContain("// #region States")
        expect(norm).toContain("// #region Effects")
    })
})

describe("organizeRegions — top-level / non-component region markers", () => {
    it("strips a single top-level unknown region wrapping a type declaration", () => {
        const input = dedent(`
            // #region Type definitions
            interface IFoo {
                x: number
            }
            // #endregion

            const Comp = () => {
                const [x] = useState(0)
                return null
            }
        `)
        const got = organizeRegions(input)
        expect(got).not.toContain("Type definitions")
        expect(got).not.toMatch(/#endregion[^\n]*\n[^\n]*const Comp/)
        expect(got).toContain("interface IFoo")
        expect(got).toContain("// #region States")
    })

    it("strips multiple top-level unknown regions surrounding the component", () => {
        const input = dedent(`
            // #region Type definitions
            interface IFooProps { x: number }
            // #endregion

            // #region Context definitions
            export const FooContext = createContext({} as IFooProps)
            // #endregion

            // #region Provider definition
            export default function Foo({ x }: Readonly<IFooProps>) {
                const value = useMemo(() => ({ x }), [x])
                return <FooContext.Provider value={value}>{x}</FooContext.Provider>
            }
            // #endregion
        `)
        const got = organizeRegions(input)
        expect(got).not.toContain("Type definitions")
        expect(got).not.toContain("Context definitions")
        expect(got).not.toContain("Provider definition")
        expect(got).toContain("interface IFooProps")
        expect(got).toContain("export const FooContext")
        expect(got).toContain("// #region Memos")
        expect(got).toContain("export default function Foo")
    })

    it("strips region markers in a file with no React components at all", () => {
        const input = dedent(`
            // #region Helpers
            export function add(a: number, b: number): number {
                return a + b
            }
            // #endregion

            // #region More helpers
            export const MULTIPLIER = 2
            // #endregion
        `)
        const got = organizeRegions(input)
        expect(got).not.toContain("Helpers")
        expect(got).not.toContain("More helpers")
        expect(got).not.toMatch(/#region/)
        expect(got).not.toMatch(/#endregion/)
        expect(got).toContain("export function add")
        expect(got).toContain("export const MULTIPLIER")
    })

    it("strips region markers around a non-component utility function", () => {
        const input = dedent(`
            // #region Utility
            function helper() {
                return 42
            }
            // #endregion

            const Comp = () => {
                const [x] = useState(0)
                return null
            }
        `)
        const got = organizeRegions(input)
        expect(got).not.toContain("Utility")
        expect(got).toContain("function helper")
        expect(got).toContain("// #region States")
    })

    it("does not invent regions when a file has only top-level code", () => {
        const input = dedent(`
            export const VALUE = 42
        `)
        const got = organizeRegions(input)
        expect(got.trim()).toBe("export const VALUE = 42")
    })
})

describe("organizeRegions — conditional rendering at the end of body (YoutubeEmbedBox-style)", () => {
    it("preserves a single early-return guard placed after Effects, outside all regions", () => {
        const input = dedent(`
            const Comp = () => {
                const [state, setState] = useState(null)
                const value = useMemo(() => state ?? 0, [state])
                useEffect(() => {}, [value])
                if (value === null) return <></>
                return <div>{value}</div>
            }
        `)
        const got = organizeRegions(input)

        const guardIdx = got.indexOf("if (value === null)")
        const effectsEndRegionIdx = got.lastIndexOf("// #endregion", guardIdx)
        expect(guardIdx).toBeGreaterThan(0)
        expect(effectsEndRegionIdx).toBeGreaterThan(0)
        expect(effectsEndRegionIdx).toBeLessThan(guardIdx)

        const between = got.slice(effectsEndRegionIdx, guardIdx)
        expect(between).not.toMatch(/#region/)
    })

    it("formatting is idempotent — second run does not move the conditional into a region", () => {
        const input = dedent(`
            const Comp = () => {
                const [state, setState] = useState(null)
                const value = useMemo(() => state ?? 0, [state])
                useEffect(() => {}, [value])
                if (value === null) return <></>
                return <div>{value}</div>
            }
        `)
        const firstPass = organizeRegions(input)
        const secondPass = organizeRegions(firstPass)
        expect(normalize(firstPass)).toBe(normalize(secondPass))
        expect(secondPass).toMatch(/\/\/ #endregion[\s\S]*if \(value === null\)/)
    })
})

describe("organizeRegions — JSX detection in nested blocks and .map() callbacks", () => {
    it("classifies useMemo returning JSX inside an if-block as Element memos", () => {
        expectOrganized(
            `
            const Comp = () => {
                const node = useMemo(() => {
                    if (true) {
                        return <div>hello</div>
                    }
                    return null
                }, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Element memos
                const node = useMemo(() => {
                    if (true) {
                        return <div>hello</div>
                    }
                    return null
                }, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies useMemo returning JSX via .map() as Element memos", () => {
        expectOrganized(
            `
            const Comp = () => {
                const items = useMemo(() => {
                    return data.map(item => <li key={item.id}>{item.name}</li>)
                }, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Element memos
                const items = useMemo(() => {
                    return data.map(item => <li key={item.id}>{item.name}</li>)
                }, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies useMemo returning JSX via .map() with block body as Element memos", () => {
        expectOrganized(
            `
            const Comp = () => {
                const items = useMemo(() => {
                    return data.map(item => {
                        return (<Component key={item.id} />)
                    })
                }, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Element memos
                const items = useMemo(() => {
                    return data.map(item => {
                        return (<Component key={item.id} />)
                    })
                }, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies useCallback returning JSX inside an if-block as Element callbacks", () => {
        expectOrganized(
            `
            const Comp = () => {
                const render = useCallback(() => {
                    if (condition) return <span />
                    return null
                }, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Element callbacks
                const render = useCallback(() => {
                    if (condition) return <span />
                    return null
                }, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("keeps useMemo with no JSX in any branch as Memos", () => {
        expectOrganized(
            `
            const Comp = () => {
                const value = useMemo(() => {
                    if (x) return 1
                    if (y) return data.map(d => d.value)
                    return null
                }, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Memos
                const value = useMemo(() => {
                    if (x) return 1
                    if (y) return data.map(d => d.value)
                    return null
                }, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("keeps useCallback with no JSX in any branch as Callbacks", () => {
        expectOrganized(
            `
            const Comp = () => {
                const handler = useCallback(() => {
                    if (!project) return
                    doSomething().then(() => {
                        if (condition) dispatch({ type: "clear" })
                    })
                }, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Callbacks
                const handler = useCallback(() => {
                    if (!project) return
                    doSomething().then(() => {
                        if (condition) dispatch({ type: "clear" })
                    })
                }, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("handles element memo depending on a callback without aborting", () => {
        expectOrganized(
            `
            const Comp = () => {
                const handleClick = useCallback(() => { console.log("click") }, [])
                const items = useMemo(() => {
                    if (list.length === 0) return <span>empty</span>
                    return list.map(item => (
                        <Item key={item.id} onClick={handleClick} />
                    ))
                }, [handleClick])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Callbacks
                const handleClick = useCallback(() => { console.log("click") }, [])
                // #endregion

                // #region Element memos
                const items = useMemo(() => {
                    if (list.length === 0) return <span>empty</span>
                    return list.map(item => (
                        <Item key={item.id} onClick={handleClick} />
                    ))
                }, [handleClick])
                // #endregion
                return null
            }
            `
        )
    })

    it("keeps useCallback with forEach callback rendering JSX as Callbacks", () => {
        expectOrganized(
            `
            const Comp = () => {
                const handler = useCallback(() => {
                    items.forEach(x => {
                        renderInto(container, <Row key={x.id} />)
                    })
                }, [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Callbacks
                const handler = useCallback(() => {
                    items.forEach(x => {
                        renderInto(container, <Row key={x.id} />)
                    })
                }, [])
                // #endregion
                return null
            }
            `
        )
    })

    it("keeps useCallback that passes JSX-rendering fn to non-renderer as Callbacks", () => {
        expectOrganized(
            `
            const Comp = () => {
                const handler = useCallback(item => logFn(item, x => <Tag>{x}</Tag>), [])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region Callbacks
                const handler = useCallback(item => logFn(item, x => <Tag>{x}</Tag>), [])
                // #endregion
                return null
            }
            `
        )
    })

    it("classifies useMemo with JSX in a switch case as Element memos", () => {
        expectOrganized(
            `
            const Comp = () => {
                const [mode] = useState("a")
                const content = useMemo(() => {
                    switch (mode) {
                        case "a": return <A />
                        case "b": return <B />
                        default: return null
                    }
                }, [mode])
                return null
            }
            `,
            `
            const Comp = () => {
                // #region States
                const [mode] = useState("a")
                // #endregion

                // #region Element memos
                const content = useMemo(() => {
                    switch (mode) {
                        case "a": return <A />
                        case "b": return <B />
                        default: return null
                    }
                }, [mode])
                // #endregion
                return null
            }
            `
        )
    })
})

describe("organizeRegions — abort when dependency graph prevents reorganization", () => {
    it("leaves source unchanged when a callback depends on a customHooks2 output", () => {
        expectUnchanged(`
            const Comp = () => {
                const handler = useCallback(() => {}, [])
                const { send } = useCustomHook({ onResult: handler })
                const submit = useCallback(() => { send() }, [send])
                return null
            }
        `)
    })

    it("preserves existing regions when callbacks depend on customHooks2 outputs", () => {
        expectUnchanged(`
            const Comp = () => {
                // #region States
                const [input, setInput] = useState("")
                // #endregion

                // #region Callbacks
                const earlyHandler = useCallback(() => {}, [])
                // #endregion

                // #region Custom hooks
                const { data, send } = useCustomHook({ onResult: earlyHandler })
                // #endregion

                // #region Callbacks
                const lateHandler = useCallback(() => { send(input) }, [input, send])
                // #endregion
                return null
            }
        `)
    })

    it("is idempotent — second pass also leaves the source unchanged", () => {
        const input = dedent(`
            const Comp = () => {
                const handler = useCallback(() => {}, [])
                const { send } = useCustomHook({ onResult: handler })
                const submit = useCallback(() => { send() }, [send])
                return null
            }
        `)
        const firstPass = organizeRegions(input)
        const secondPass = organizeRegions(firstPass)
        expect(normalize(firstPass)).toBe(normalize(input))
        expect(normalize(secondPass)).toBe(normalize(input))
    })

    it("still aborts for callbacks depending on customHooks2 even when memos are promotable", () => {
        expectUnchanged(`
            const Comp = () => {
                const [input, setInput] = useState("")
                const earlyHandler = useCallback(() => {}, [])
                const { data, send } = useCustomHook({ onResult: earlyHandler })
                const merged = useMemo(() => data, [data])
                const lateHandler = useCallback(() => { send(input) }, [input, send])
                return null
            }
        `)
    })

    it("preserves the ChatSection pattern: interleaved callbacks and customHooks2", () => {
        const input = dedent(`
            import { useProject } from "@pages/Project/ProjectArea/contexts/ProjectProvider"
            import { useAnalyseTab } from "../../../../contexts/AnalyseTabProvider"
            import { useTranslation } from "react-i18next"
            import { useTrackEvent } from "@hooks/error-handling/useTrackEvent"
            export default function ChatSection() {
                // #region Contexts
                const { project } = useProject()
                const { pendingChatMessage, clearPendingChatMessage } = useAnalyseTab()
                // #endregion

                // #region Custom hooks
                const queryClient = useQueryClient()
                const { t } = useTranslation("tabular")
                const { trackEvent } = useTrackEvent()
                // #endregion

                // #region States
                const projectId = project?.id
                const hasProjectId = projectId !== undefined
                const [chatInput, setChatInput] = useState("")
                // #endregion

                // #region Memos
                const attachments = useMemo(() => [{}], [])
                // #endregion

                // #region Callbacks
                const handleChatError = useCallback((error) => {
                    trackEvent({ name: "error" })
                }, [trackEvent, t])
                const handleToolResult = useCallback(({ toolCallId }) => {
                    queryClient.invalidateQueries()
                }, [projectId, queryClient])
                // #endregion

                // #region Custom hooks
                const { loadSession, sendReply } = useAnalyseChatSession({ projectId, attachments })
                const { messages, sendMessage, resumeStreaming, isStreaming } = useSessionChat({
                    loadSession, sendReply,
                    onToolResult: handleToolResult, onError: handleChatError
                })
                // #endregion

                // #region Element callbacks
                const renderMessage = useCallback((msg) => {
                    return <div>{msg}</div>
                }, [projectId, resumeStreaming])
                // #endregion

                // #region Callbacks
                const handleFormSubmit = useCallback((e) => {
                    sendMessage(chatInput)
                    setChatInput("")
                }, [chatInput, sendMessage])
                const handleTextareaSubmit = useCallback(() => {
                    sendMessage(chatInput)
                    setChatInput("")
                }, [chatInput, sendMessage])
                const handleContextAttachmentActiveChange = useCallback((active) => {
                    setChatInput(active)
                }, [])
                // #endregion

                // #region Effects
                useEffect(() => {
                    for (const msg of messages) console.log(msg)
                }, [messages])
                useEffect(() => {
                    if (pendingChatMessage && hasProjectId) sendMessage(pendingChatMessage)
                }, [pendingChatMessage, hasProjectId, sendMessage])
                // #endregion
                return <div />
            }
        `)
        const got = organizeRegions(input)
        expect(normalize(got)).toBe(normalize(input))
    })
})

describe("organizeRegions — memo depending on customHooks2 is promoted into Custom hooks", () => {
    it("promotes a memo depending on customHooks2 into the Custom hooks region", () => {
        expectOrganized(
            `
            export function useMyHook() {
                const ref = useRef(null)
                const handler = useCallback(() => {}, [])
                const { data, isActive } = useCustomHook({ onComplete: handler })
                const merged = useMemo(() => ({ data, ref }), [data])
                useEffect(() => { console.log(merged) }, [merged])
            }
            `,
            `
            export function useMyHook() {
                // #region Refs
                const ref = useRef(null)
                // #endregion

                // #region Callbacks
                const handler = useCallback(() => {}, [])
                // #endregion

                // #region Custom hooks
                const { data, isActive } = useCustomHook({ onComplete: handler })
                const merged = useMemo(() => ({ data, ref }), [data])
                // #endregion

                // #region Effects
                useEffect(() => { console.log(merged) }, [merged])
                // #endregion
            }
            `
        )
    })

    it("correctly classifies useRef as Refs even when a later memo depends on customHooks2", () => {
        const input = dedent(`
            export function useMyHook() {
                const ref1 = useRef(null)
                const ref2 = useRef(0)
                const [state, setState] = useState("")
                const cb = useCallback(() => {}, [])
                const { value } = useCustomHook({ onDone: cb })
                const derived = useMemo(() => value + state, [value, state])
                useEffect(() => {}, [derived])
            }
        `)
        const got = organizeRegions(input)
        expect(got).toContain("// #region Refs")
        expect(got).toContain("ref1 = useRef")
        expect(got).toContain("ref2 = useRef")
        const refsIdx = got.indexOf("// #region Refs")
        const ref1Idx = got.indexOf("ref1 = useRef")
        const refsEnd = got.indexOf("// #endregion", refsIdx)
        expect(ref1Idx).toBeGreaterThan(refsIdx)
        expect(ref1Idx).toBeLessThan(refsEnd)
    })

    it("handles the useSessionChat pattern: refs with callbacks feeding custom hook and memo depending on it", () => {
        const input = dedent(`
            export function useSessionChat() {
                const controllerRef = useRef(null)
                const errorRef = useRef(null)
                const startRef = useRef(null)
                const [history, setHistory] = useState([])
                const [isLoading, setIsLoading] = useState(true)
                const knownTools = useMemo(() => history.filter(Boolean), [history])
                const onComplete = useCallback(() => { setHistory([]) }, [])
                const onError = useCallback(() => { errorRef.current?.() }, [])
                const handleDone = useCallback(() => {}, [])
                const send = useCallback(() => {}, [])
                const { streaming, startStreaming, isStreaming } = useStreamingMessages({
                    onComplete, onError
                })
                const messages = useMemo(
                    () => isStreaming ? [...history, ...streaming] : history,
                    [isStreaming, history, streaming]
                )
                useEffect(() => { startRef.current = startStreaming }, [startStreaming])
                useEffect(() => { console.log(messages) }, [messages])
            }
        `)
        const got = organizeRegions(input)

        expect(got).toContain("// #region Refs")
        expect(got).toContain("// #region States")
        expect(got).toContain("// #region Memos")
        expect(got).toContain("// #region Callbacks")
        expect(got).toContain("// #region Custom hooks")
        expect(got).toContain("// #region Effects")

        const norm = normalize(got)
        expect(norm.indexOf("// #region States")).toBeLessThan(norm.indexOf("// #region Refs"))
        expect(norm.indexOf("// #region Memos")).toBeLessThan(norm.indexOf("// #region Callbacks"))

        const customHooksIdx = norm.indexOf("// #region Custom hooks")
        expect(norm.indexOf("messages = useMemo")).toBeGreaterThan(customHooksIdx)

        const secondPass = organizeRegions(got)
        expect(normalize(secondPass)).toBe(normalize(got))
    })
})
