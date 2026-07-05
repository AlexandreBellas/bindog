import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./useeffect"

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

ruleTester.run("useeffect", rule, {
    valid: [
        {
            name: "useEffect with single-line JSDoc above",
            code: `
                const Comp = () => {
                    /** Syncs the local state with the URL params. */
                    useEffect(() => {}, [])
                    return null
                }
            `
        },
        {
            name: "useEffect with multi-line JSDoc above",
            code: `
                const Comp = () => {
                    /**
                     * Fetches the user profile when the ID changes
                     * and stores it in local state.
                     */
                    useEffect(() => {
                        fetchProfile(id)
                    }, [id])
                    return null
                }
            `
        },
        {
            name: "multiple useEffects each with JSDoc",
            code: `
                const Comp = () => {
                    /** Subscribes to the websocket channel. */
                    useEffect(() => {
                        subscribe()
                    }, [])

                    /** Logs page view on mount. */
                    useEffect(() => {
                        logPageView()
                    }, [])
                    return null
                }
            `
        },
        {
            name: "no useEffect calls present",
            code: `
                const Comp = () => {
                    const x = useState(0)
                    return null
                }
            `
        },
        {
            name: "useEffect with JSDoc and extra blank lines between",
            code: `
                const Comp = () => {
                    /** Initializes the timer. */

                    useEffect(() => {
                        startTimer()
                    }, [])
                    return null
                }
            `
        },
        {
            name: "useEffect inside a custom hook with JSDoc",
            code: `
                function useMyHook() {
                    /** Cleans up resources on unmount. */
                    useEffect(() => {
                        return () => cleanup()
                    }, [])
                }
            `
        },
        {
            name: "JSDoc with asterisks and content",
            code: `
                const Comp = () => {
                    /**
                     * Resets form state when the dialog opens.
                     */
                    useEffect(() => {
                        resetForm()
                    }, [isOpen])
                    return null
                }
            `
        }
    ],
    invalid: [
        {
            name: "useEffect without any comment",
            code: `
                const Comp = () => {
                    useEffect(() => {}, [])
                    return null
                }
            `,
            errors: [{ messageId: "missingDescription" }]
        },
        {
            name: "useEffect with only a line comment above",
            code: `
                const Comp = () => {
                    // Syncs state with URL params
                    useEffect(() => {}, [])
                    return null
                }
            `,
            errors: [{ messageId: "missingDescription" }]
        },
        {
            name: "useEffect with a regular block comment (not JSDoc)",
            code: `
                const Comp = () => {
                    /* Syncs state with URL params */
                    useEffect(() => {}, [])
                    return null
                }
            `,
            errors: [{ messageId: "missingDescription" }]
        },
        {
            name: "useEffect with empty JSDoc",
            code: `
                const Comp = () => {
                    /** */
                    useEffect(() => {}, [])
                    return null
                }
            `,
            errors: [{ messageId: "missingDescription" }]
        },
        {
            name: "useEffect with whitespace-only JSDoc",
            code: `
                const Comp = () => {
                    /**
                     *
                     */
                    useEffect(() => {}, [])
                    return null
                }
            `,
            errors: [{ messageId: "missingDescription" }]
        },
        {
            name: "one described and one undescribed useEffect",
            code: `
                const Comp = () => {
                    /** Fetches data on mount. */
                    useEffect(() => {
                        fetchData()
                    }, [])

                    useEffect(() => {
                        logEvent()
                    }, [])
                    return null
                }
            `,
            errors: [{ messageId: "missingDescription" }]
        },
        {
            name: "multiple undescribed useEffects",
            code: `
                const Comp = () => {
                    useEffect(() => {
                        fetchData()
                    }, [])

                    useEffect(() => {
                        logEvent()
                    }, [])
                    return null
                }
            `,
            errors: [
                { messageId: "missingDescription" },
                { messageId: "missingDescription" }
            ]
        },
        {
            name: "JSDoc on wrong statement does not count",
            code: `
                const Comp = () => {
                    /** This describes the variable, not the effect. */
                    const x = 1
                    useEffect(() => {}, [])
                    return null
                }
            `,
            errors: [{ messageId: "missingDescription" }]
        },
        {
            name: "React.useEffect namespace form is banned",
            code: `
                const Comp = () => {
                    React.useEffect(() => {}, [])
                    return null
                }
            `,
            errors: [{ messageId: "noReactNamespace" }]
        },
        {
            name: "React.useEffect namespace form is banned even with JSDoc above",
            code: `
                const Comp = () => {
                    /** Syncs something. */
                    React.useEffect(() => {}, [])
                    return null
                }
            `,
            errors: [{ messageId: "noReactNamespace" }]
        },
        {
            name: "React.useEffect namespace form inside a custom hook is banned",
            code: `
                function useMyHook() {
                    React.useEffect(() => {
                        return () => cleanup()
                    }, [])
                }
            `,
            errors: [{ messageId: "noReactNamespace" }]
        },
        {
            name: "multiple React.useEffect calls are all banned",
            code: `
                const Comp = () => {
                    React.useEffect(() => {
                        fetchData()
                    }, [])

                    React.useEffect(() => {
                        logEvent()
                    }, [])
                    return null
                }
            `,
            errors: [
                { messageId: "noReactNamespace" },
                { messageId: "noReactNamespace" }
            ]
        },
        {
            name: "mix of React.useEffect (banned) and bare useEffect without JSDoc (missing description)",
            code: `
                const Comp = () => {
                    React.useEffect(() => {
                        fetchData()
                    }, [])

                    useEffect(() => {
                        logEvent()
                    }, [])
                    return null
                }
            `,
            errors: [
                { messageId: "noReactNamespace" },
                { messageId: "missingDescription" }
            ]
        }
    ]
})
