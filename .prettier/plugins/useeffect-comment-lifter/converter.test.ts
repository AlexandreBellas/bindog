import { describe, expect, it } from "vitest"
import { liftUseEffectComments } from "./converter.mjs"

describe("liftUseEffectComments — single plain comment", () => {
    it("converts a single // comment immediately above useEffect to a single-line JSDoc", () => {
        const input = [
            "// Reset form when the modal closes.",
            "useEffect(() => {",
            "    if (!isOpen) resetForm()",
            "}, [isOpen])",
            ""
        ].join("\n")
        const expected = [
            "/** Reset form when the modal closes. */",
            "useEffect(() => {",
            "    if (!isOpen) resetForm()",
            "}, [isOpen])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("preserves indentation from the useEffect line", () => {
        const input = [
            "function Component() {",
            "    // Subscribe to resize events.",
            "    useEffect(() => {",
            "        window.addEventListener('resize', handler)",
            "        return () => window.removeEventListener('resize', handler)",
            "    }, [])",
            "}",
            ""
        ].join("\n")
        const expected = [
            "function Component() {",
            "    /** Subscribe to resize events. */",
            "    useEffect(() => {",
            "        window.addEventListener('resize', handler)",
            "        return () => window.removeEventListener('resize', handler)",
            "    }, [])",
            "}",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("strips one optional space after // when extracting text", () => {
        const input = ["//Fetch data on mount.", "useEffect(() => { fetchData() }, [])"].join("\n")
        const expected = ["/** Fetch data on mount. */", "useEffect(() => { fetchData() }, [])"].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("handles a comment with no trailing period", () => {
        const input = ["// Sync local state with server", "useEffect(() => { sync() }, [data])"].join("\n")
        const expected = ["/** Sync local state with server */", "useEffect(() => { sync() }, [data])"].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("handles a bare // comment with no text", () => {
        const input = ["//", "useEffect(() => { doWork() }, [])"].join("\n")
        const expected = ["/**  */", "useEffect(() => { doWork() }, [])"].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })
})

describe("liftUseEffectComments — multiple consecutive plain comments", () => {
    it("converts two consecutive // comments into a multi-line JSDoc", () => {
        const input = [
            "// Sync local state with server data.",
            "// Runs only when data changes.",
            "useEffect(() => {",
            "    setLocalState(data)",
            "}, [data])",
            ""
        ].join("\n")
        const expected = [
            "/**",
            " * Sync local state with server data.",
            " * Runs only when data changes.",
            " */",
            "useEffect(() => {",
            "    setLocalState(data)",
            "}, [data])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("converts three consecutive // comments into a multi-line JSDoc", () => {
        const input = [
            "// First line.",
            "// Second line.",
            "// Third line.",
            "useEffect(() => { work() }, [dep])",
            ""
        ].join("\n")
        const expected = [
            "/**",
            " * First line.",
            " * Second line.",
            " * Third line.",
            " */",
            "useEffect(() => { work() }, [dep])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("preserves indentation for multi-line JSDoc", () => {
        const input = [
            "    // First part.",
            "    // Second part.",
            "    useEffect(() => {",
            "        doSomething()",
            "    }, [dep])",
            ""
        ].join("\n")
        const expected = [
            "    /**",
            "     * First part.",
            "     * Second part.",
            "     */",
            "    useEffect(() => {",
            "        doSomething()",
            "    }, [dep])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("handles a multi-comment block with an empty // line (blank paragraph)", () => {
        const input = [
            "// Subscribe to window events.",
            "//",
            "// Cleans up on unmount.",
            "useEffect(() => {",
            "    window.addEventListener('resize', handler)",
            "    return () => window.removeEventListener('resize', handler)",
            "}, [])",
            ""
        ].join("\n")
        const expected = [
            "/**",
            " * Subscribe to window events.",
            " * ",
            " * Cleans up on unmount.",
            " */",
            "useEffect(() => {",
            "    window.addEventListener('resize', handler)",
            "    return () => window.removeEventListener('resize', handler)",
            "}, [])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })
})

describe("liftUseEffectComments — useEffect with no comment above", () => {
    it("leaves useEffect untouched when there is no comment above it", () => {
        const input = [
            "const [count, setCount] = useState(0)",
            "useEffect(() => {",
            "    document.title = count",
            "}, [count])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })

    it("leaves useEffect untouched when the line above is blank", () => {
        const input = ["// Some unrelated comment", "", "useEffect(() => { doWork() }, [])", ""].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })

    it("leaves useEffect untouched when it is the first line of the file", () => {
        const input = "useEffect(() => { init() }, [])\n"
        expect(liftUseEffectComments(input)).toBe(input)
    })
})

describe("liftUseEffectComments — useEffect already has JSDoc", () => {
    it("leaves useEffect untouched when it already has a single-line JSDoc", () => {
        const input = [
            "/** Reset form when the modal closes. */",
            "useEffect(() => {",
            "    if (!isOpen) resetForm()",
            "}, [isOpen])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })

    it("leaves useEffect untouched when it already has a multi-line JSDoc", () => {
        const input = [
            "/**",
            " * Sync local state with server data.",
            " * Runs only when data changes.",
            " */",
            "useEffect(() => {",
            "    setLocalState(data)",
            "}, [data])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })
})

describe("liftUseEffectComments — region markers as boundaries", () => {
    it("does not convert a // #region comment directly above useEffect", () => {
        const input = ["// #region Effects", "useEffect(() => { doWork() }, [dep])", "// #endregion", ""].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })

    it("does not convert a // #endregion comment directly above useEffect", () => {
        const input = ["// #endregion", "useEffect(() => { doWork() }, [dep])", ""].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })

    it("converts a plain comment that sits between a region marker and useEffect", () => {
        const input = [
            "// #region Effects",
            "// Fetch data on mount.",
            "useEffect(() => { fetchData() }, [])",
            "// #endregion",
            ""
        ].join("\n")
        const expected = [
            "// #region Effects",
            "/** Fetch data on mount. */",
            "useEffect(() => { fetchData() }, [])",
            "// #endregion",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("stops collecting at a // #endregion when it appears above the comment block", () => {
        const input = [
            "// #endregion",
            "// Reset form when modal closes.",
            "useEffect(() => { resetForm() }, [isOpen])",
            ""
        ].join("\n")
        const expected = [
            "// #endregion",
            "/** Reset form when modal closes. */",
            "useEffect(() => { resetForm() }, [isOpen])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("stops collecting at the region marker even when mixed with plain comments", () => {
        const input = [
            "// #region Effects",
            "// First line.",
            "// Second line.",
            "useEffect(() => { work() }, [dep])",
            "// #endregion",
            ""
        ].join("\n")
        const expected = [
            "// #region Effects",
            "/**",
            " * First line.",
            " * Second line.",
            " */",
            "useEffect(() => { work() }, [dep])",
            "// #endregion",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("does not collect a // #region comment mixed into plain comments", () => {
        const input = ["// #region Effects", "// Only this line.", "useEffect(() => { work() }, [dep])", ""].join("\n")
        const expected = [
            "// #region Effects",
            "/** Only this line. */",
            "useEffect(() => { work() }, [dep])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })
})

describe("liftUseEffectComments — multiple useEffects in one file", () => {
    it("converts all qualifying useEffects in a single pass", () => {
        const input = [
            "// First effect.",
            "useEffect(() => { first() }, [a])",
            "",
            "// Second effect.",
            "useEffect(() => { second() }, [b])",
            ""
        ].join("\n")
        const expected = [
            "/** First effect. */",
            "useEffect(() => { first() }, [a])",
            "",
            "/** Second effect. */",
            "useEffect(() => { second() }, [b])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("handles a mix: some useEffects convert, others are left alone", () => {
        const input = [
            "/** Already JSDoc. */",
            "useEffect(() => { a() }, [a])",
            "",
            "// Plain comment.",
            "useEffect(() => { b() }, [b])",
            "",
            "useEffect(() => { c() }, [c])",
            ""
        ].join("\n")
        const expected = [
            "/** Already JSDoc. */",
            "useEffect(() => { a() }, [a])",
            "",
            "/** Plain comment. */",
            "useEffect(() => { b() }, [b])",
            "",
            "useEffect(() => { c() }, [c])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("converts multiple useEffects within a component with regions", () => {
        const input = [
            "export default function MyComponent() {",
            "    // #region Effects",
            "    // Fetch user data.",
            "    useEffect(() => {",
            "        fetchUser(userId)",
            "    }, [userId])",
            "",
            "    // Watch for theme changes.",
            "    // Applies theme to root element.",
            "    useEffect(() => {",
            "        applyTheme(theme)",
            "    }, [theme])",
            "    // #endregion",
            "}",
            ""
        ].join("\n")
        const expected = [
            "export default function MyComponent() {",
            "    // #region Effects",
            "    /** Fetch user data. */",
            "    useEffect(() => {",
            "        fetchUser(userId)",
            "    }, [userId])",
            "",
            "    /**",
            "     * Watch for theme changes.",
            "     * Applies theme to root element.",
            "     */",
            "    useEffect(() => {",
            "        applyTheme(theme)",
            "    }, [theme])",
            "    // #endregion",
            "}",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })
})

describe("liftUseEffectComments — realistic TSX component", () => {
    it("converts qualifying useEffect comments in a full component", () => {
        const input = [
            "import { useEffect, useState } from 'react'",
            "",
            "export default function ProjectArea() {",
            "    // #region States",
            "    const [isOpen, setIsOpen] = useState(false)",
            "    const [data, setData] = useState(null)",
            "    // #endregion",
            "",
            "    // #region Effects",
            "    /** Reset form when modal closes. */",
            "    useEffect(() => {",
            "        if (!isOpen) resetForm()",
            "    }, [isOpen])",
            "",
            "    // Fetch data when component mounts.",
            "    useEffect(() => {",
            "        fetchData()",
            "    }, [])",
            "",
            "    useEffect(() => {",
            "        document.title = 'Project'",
            "    }, [])",
            "    // #endregion",
            "",
            "    return <div>{data}</div>",
            "}",
            ""
        ].join("\n")
        const expected = [
            "import { useEffect, useState } from 'react'",
            "",
            "export default function ProjectArea() {",
            "    // #region States",
            "    const [isOpen, setIsOpen] = useState(false)",
            "    const [data, setData] = useState(null)",
            "    // #endregion",
            "",
            "    // #region Effects",
            "    /** Reset form when modal closes. */",
            "    useEffect(() => {",
            "        if (!isOpen) resetForm()",
            "    }, [isOpen])",
            "",
            "    /** Fetch data when component mounts. */",
            "    useEffect(() => {",
            "        fetchData()",
            "    }, [])",
            "",
            "    useEffect(() => {",
            "        document.title = 'Project'",
            "    }, [])",
            "    // #endregion",
            "",
            "    return <div>{data}</div>",
            "}",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })
})

describe("liftUseEffectComments — useEffect call variations", () => {
    it("matches useEffect with extra whitespace before the opening paren", () => {
        const input = ["// Some effect.", "useEffect  (() => { work() }, [])"].join("\n")
        const expected = ["/** Some effect. */", "useEffect  (() => { work() }, [])"].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("does not transform a line where useEffect is not at the start", () => {
        const input = ["// Some comment.", "const cleanup = useEffect(() => { work() }, [])", ""].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })

    it("handles a multiline useEffect call where useEffect( is on its own line", () => {
        const input = [
            "// Initialize on mount.",
            "useEffect(",
            "    () => {",
            "        init()",
            "    },",
            "    []",
            ")",
            ""
        ].join("\n")
        const expected = [
            "/** Initialize on mount. */",
            "useEffect(",
            "    () => {",
            "        init()",
            "    },",
            "    []",
            ")",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("does not match useEffectOnce or other hooks containing 'useEffect'", () => {
        const input = ["// Some comment.", "useEffectOnce(() => { init() })", ""].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })
})

describe("liftUseEffectComments — safety", () => {
    it("returns the input unchanged when there are no useEffect calls", () => {
        const input = ["const x = 1", "// just a comment", "const y = 2", ""].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })

    it("returns empty string unchanged", () => {
        expect(liftUseEffectComments("")).toBe("")
    })

    it("is idempotent — running twice produces the same result", () => {
        const input = [
            "// Reset form when modal closes.",
            "useEffect(() => {",
            "    if (!isOpen) resetForm()",
            "}, [isOpen])",
            ""
        ].join("\n")
        const once = liftUseEffectComments(input)
        const twice = liftUseEffectComments(once)
        expect(twice).toBe(once)
    })

    it("is idempotent for multi-line JSDoc output", () => {
        const input = ["// First line.", "// Second line.", "useEffect(() => { work() }, [dep])", ""].join("\n")
        const once = liftUseEffectComments(input)
        const twice = liftUseEffectComments(once)
        expect(twice).toBe(once)
    })

    it("does not modify non-tsx code that has no useEffect", () => {
        const input = [
            "// utility function",
            "export function add(a: number, b: number): number {",
            "    return a + b",
            "}",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })

    it("preserves comments above non-useEffect hooks unchanged", () => {
        const input = [
            "// Get the current user.",
            "const user = useSelector(selectUser)",
            "",
            "// Plain comment above useEffect.",
            "useEffect(() => { track(user) }, [user])",
            ""
        ].join("\n")
        const expected = [
            "// Get the current user.",
            "const user = useSelector(selectUser)",
            "",
            "/** Plain comment above useEffect. */",
            "useEffect(() => { track(user) }, [user])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })
})

describe("liftUseEffectComments — edge cases", () => {
    it("handles a comment with trailing whitespace", () => {
        const input = ["// Comment with trailing spaces.   ", "useEffect(() => { work() }, [])"].join("\n")
        const expected = ["/** Comment with trailing spaces. */", "useEffect(() => { work() }, [])"].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("does not collect a block comment (/* */) as a plain comment", () => {
        const input = ["/* a block comment */", "useEffect(() => { work() }, [dep])", ""].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })

    it("stops collecting at a blank line even if more comments appear further up", () => {
        const input = [
            "// This is unrelated.",
            "",
            "// This is the effect comment.",
            "useEffect(() => { work() }, [dep])",
            ""
        ].join("\n")
        const expected = [
            "// This is unrelated.",
            "",
            "/** This is the effect comment. */",
            "useEffect(() => { work() }, [dep])",
            ""
        ].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("stops collecting at a code line between comment and useEffect", () => {
        const input = ["// Some comment.", "const x = getX()", "useEffect(() => { work(x) }, [x])", ""].join("\n")
        expect(liftUseEffectComments(input)).toBe(input)
    })

    it("handles deeply indented useEffect (e.g. inside nested blocks)", () => {
        const input = ["        // Deep comment.", "        useEffect(() => { doDeepWork() }, [dep])", ""].join("\n")
        const expected = ["        /** Deep comment. */", "        useEffect(() => { doDeepWork() }, [dep])", ""].join(
            "\n"
        )
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("handles tab-indented useEffect", () => {
        const input = ["\t// Tab-indented comment.", "\tuseEffect(() => { work() }, [])"].join("\n")
        const expected = ["\t/** Tab-indented comment. */", "\tuseEffect(() => { work() }, [])"].join("\n")
        expect(liftUseEffectComments(input)).toBe(expected)
    })

    it("ensures no crash when useEffect is at line 0 with no lines above", () => {
        const input = "useEffect(() => { init() }, [])"
        expect(liftUseEffectComments(input)).toBe(input)
    })
})
