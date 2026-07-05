import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./enforce-ref-suffix"

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

const TSX = "src/components/MyComponent/index.tsx"
const HOOK_TS = "src/components/MyComponent/hooks/useMyHook.ts"
const TS = "src/utils/helper.ts"

// ─────────────────────────────────────────────────────────────────────────────
// useRef variables: must have Ref suffix
// ─────────────────────────────────────────────────────────────────────────────
ruleTester.run("enforce-ref-suffix — useRef must have Ref suffix", rule, {
    valid: [
        // Basic useRef with correct Ref suffix
        {
            name: "useRef assigned to variable ending in Ref",
            code: "const containerRef = useRef(null)",
            filename: TSX
        },

        // useRef with TypeScript generic type argument
        {
            name: "useRef<T> with Ref suffix",
            code: "const inputRef = useRef<HTMLInputElement>(null)",
            filename: TSX
        },

        // useRef with initial value
        {
            name: "useRef with a non-null initial value",
            code: "const countRef = useRef(0)",
            filename: TSX
        },

        // React.useRef (member expression form)
        {
            name: "React.useRef with Ref suffix",
            code: "const svgRef = React.useRef<SVGElement>(null)",
            filename: TSX
        },

        // React.useRef with generic
        {
            name: "React.useRef<T> with Ref suffix",
            code: "const divRef = React.useRef<HTMLDivElement>(null)",
            filename: TSX
        },

        // Destructuring from useRef — suffix not enforced on properties
        {
            name: "Destructuring { current } from useRef does not require Ref suffix",
            code: "const { current } = useRef(null)",
            filename: TSX
        },

        // Destructuring with alias from useRef — suffix not enforced on aliases
        {
            name: "Destructuring { current: el } from useRef does not require Ref suffix",
            code: "const { current: el } = useRef(null)",
            filename: TSX
        },

        // Multiple useRef declarations, all with Ref suffix
        {
            name: "Multiple useRef variables each with Ref suffix",
            code: ["const containerRef = useRef(null)", "const inputRef = useRef<HTMLInputElement>(null)"].join("\n"),
            filename: TSX
        },

        // Rule does not apply to non-hook .ts files (e.g. utils)
        {
            name: "useRef without Ref suffix in a plain .ts utility file is ignored",
            code: "const container = useRef(null)",
            filename: TS
        },

        // Rule does not apply to non-hook .ts files for unexpected suffix either
        {
            name: "Ref suffix on non-useRef variable in a plain .ts utility file is ignored",
            code: "const stateRef = useState(null)",
            filename: TS
        },

        // Rule applies to hook .ts files (useRef must have Ref suffix)
        {
            name: "useRef with Ref suffix in a hook .ts file is valid",
            code: "const containerRef = useRef(null)",
            filename: HOOK_TS
        },

        // Shorthand destructuring allowed in hook .ts files too
        {
            name: "Shorthand Ref-keyed destructuring in a hook .ts file is allowed",
            code: "const { audioRef } = useInterviewRefs()",
            filename: HOOK_TS
        },

        // In hook files: non-useRef variables may carry the Ref suffix (hooks establish API naming)
        {
            name: "useCallback with Ref suffix in hook file is allowed (hook API convention)",
            code: "const setScrollRef = useCallback((el) => { }, [])",
            filename: HOOK_TS
        },

        {
            name: "useState with Ref suffix in hook file is allowed (hook API convention)",
            code: "const [inputRef, setInputRef] = useState(null)",
            filename: HOOK_TS
        },

        {
            name: "Non-Ref-keyed destructuring in hook file does not trigger unexpectedRefSuffix",
            code: "const { ref: someRef } = useFoo()",
            filename: HOOK_TS
        }
    ],
    invalid: [
        // Basic useRef without Ref suffix
        {
            name: "useRef assigned to variable without Ref suffix",
            code: "const container = useRef(null)",
            filename: TSX,
            errors: [{ messageId: "missingRefSuffix" }]
        },

        // useRef with TypeScript generic but missing suffix
        {
            name: "useRef<T> without Ref suffix",
            code: "const input = useRef<HTMLInputElement>(null)",
            filename: TSX,
            errors: [{ messageId: "missingRefSuffix" }]
        },

        // React.useRef without Ref suffix
        {
            name: "React.useRef without Ref suffix",
            code: "const svg = React.useRef<SVGElement>(null)",
            filename: TSX,
            errors: [{ messageId: "missingRefSuffix" }]
        },

        // useRef with completely unrelated name
        {
            name: "useRef assigned to an unrelated name",
            code: "const myElement = useRef(null)",
            filename: TSX,
            errors: [{ messageId: "missingRefSuffix" }]
        },

        // Rule also applies to hook .ts files
        {
            name: "useRef without Ref suffix in a hook .ts file is an error",
            code: "const container = useRef(null)",
            filename: HOOK_TS,
            errors: [{ messageId: "missingRefSuffix" }]
        },

        // Note: unexpectedRefSuffix is NOT reported in hook files — only missingRefSuffix is.
        // The following test confirms the missingRefSuffix check still applies in hooks:
        {
            name: "useRef without Ref suffix in hook file still triggers missingRefSuffix",
            code: "const el = useRef(null)",
            filename: HOOK_TS,
            errors: [{ messageId: "missingRefSuffix" }]
        }
    ]
})

// ─────────────────────────────────────────────────────────────────────────────
// Non-useRef variables: must NOT have Ref suffix
// ─────────────────────────────────────────────────────────────────────────────
ruleTester.run("enforce-ref-suffix — non-useRef must not have Ref suffix", rule, {
    valid: [
        // useState with no Ref suffix
        {
            name: "useState without Ref suffix",
            code: "const [count, setCount] = useState(0)",
            filename: TSX
        },

        // Regular variable without Ref suffix
        {
            name: "Regular variable without Ref suffix",
            code: "const myValue = 42",
            filename: TSX
        },

        // Function call result without Ref suffix
        {
            name: "Function call without Ref suffix",
            code: "const result = someFunction()",
            filename: TSX
        },

        // Object destructuring without Ref suffix
        {
            name: "Object destructuring without Ref suffix",
            code: "const { data, isLoading } = useQuery()",
            filename: TSX
        },

        // Array destructuring without Ref suffix
        {
            name: "Array destructuring without Ref suffix",
            code: "const [value, setValue] = useState(null)",
            filename: TSX
        },

        // Nested destructuring without Ref suffix
        {
            name: "Nested object destructuring without Ref suffix",
            code: "const { a: { b } } = someObject",
            filename: TSX
        },

        // Destructuring with default values without Ref suffix
        {
            name: "Destructuring with default value without Ref suffix",
            code: "const { value = 0 } = someObject",
            filename: TSX
        },

        // Rest element without Ref suffix
        {
            name: "Object rest element without Ref suffix",
            code: "const { a, ...rest } = someObject",
            filename: TSX
        },

        // Array rest element without Ref suffix
        {
            name: "Array rest element without Ref suffix",
            code: "const [first, ...others] = someArray",
            filename: TSX
        },

        // No initializer, no Ref suffix
        {
            name: "Variable without initializer and without Ref suffix",
            code: "let myElement",
            filename: TSX
        },

        // createRef is not useRef — but the name has no Ref suffix (OK for the naming)
        {
            name: "createRef without Ref suffix (not useRef — any suffix rule still applies)",
            code: "const container = createRef()",
            filename: TSX
        },

        // Using 'ref' alone (no Ref suffix — ends with 'ref', not 'Ref')
        {
            name: "Variable named 'ref' does not have 'Ref' suffix (case-sensitive)",
            code: "const ref = someFunction()",
            filename: TSX
        },

        // Variable ending in 'ref' (lowercase) — not 'Ref'
        {
            name: "Variable ending in lowercase 'ref' does not trigger the rule",
            code: "const buttonref = someFunction()",
            filename: TSX
        },

        // ── Inherited-key (component-property) allowance ──────────────────────
        // When a non-useRef source's object property key already ends in Ref, the
        // bound variable inherits that name and is allowed to keep the Ref suffix.
        {
            name: "Shorthand destructuring where property key ends in Ref is allowed",
            code: "const { myRef } = someObject",
            filename: TSX
        },

        {
            name: "Shorthand destructuring: multiple Ref-keyed props from a hook",
            code: "const { audioRef, bodyRef, headerRef } = useInterviewRefs()",
            filename: TSX
        },

        {
            name: "Shorthand destructuring: Ref-keyed prop from any non-useRef source",
            code: "const { fileInputRef } = useSomething()",
            filename: TSX
        },

        {
            name: "Shorthand destructuring: Ref-keyed prop with default value",
            code: "const { scrollAreaRef = null } = useChatRefs()",
            filename: TSX
        },

        {
            name: "Renamed destructuring where the key itself ends in Ref",
            code: "const { bodyRef: localBodyRef } = useSomeHook()",
            filename: TSX
        }
    ],
    invalid: [
        // useState returns with Ref suffix
        {
            name: "useState result assigned to variable with Ref suffix",
            code: "const containerRef = useState(null)",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // useCallback with Ref suffix
        {
            name: "useCallback result with Ref suffix",
            code: "const callbackRef = useCallback(() => {}, [])",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // createRef (not useRef) with Ref suffix
        {
            name: "createRef result with Ref suffix is not allowed",
            code: "const containerRef = createRef()",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // React.createRef with Ref suffix
        {
            name: "React.createRef result with Ref suffix is not allowed",
            code: "const containerRef = React.createRef()",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // Plain value with Ref suffix
        {
            name: "Literal value with Ref suffix",
            code: "const valueRef = 42",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // No initializer but Ref suffix
        {
            name: "Variable with Ref suffix and no initializer",
            code: "let inputRef",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // Object destructuring: renamed property with Ref suffix
        {
            name: "Object destructuring rename to a name with Ref suffix",
            code: "const { value: stateRef } = useGlobalState()",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // Array destructuring: first element with Ref suffix
        {
            name: "Array destructuring first element with Ref suffix",
            code: "const [listRef] = useState([])",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // Array destructuring: sparse array with Ref suffix in second slot
        {
            name: "Array destructuring sparse element with Ref suffix",
            code: "const [, setRef] = useState(null)",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // Rest element with Ref suffix in object destructuring
        {
            name: "Object rest element with Ref suffix",
            code: "const { a, ...restRef } = someObject",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // Rest element with Ref suffix in array destructuring
        {
            name: "Array rest element with Ref suffix",
            code: "const [first, ...othersRef] = someArray",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // Default value in destructuring, but the bound name still has Ref suffix
        {
            name: "Destructuring with default value where bound name has Ref suffix",
            code: "const { value: stateRef = null } = someObject",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // Nested destructuring where inner name has Ref suffix — key does NOT end in Ref
        {
            name: "Nested object destructuring where inner bound name has Ref suffix (key has no Ref)",
            code: "const { a: { b: myRef } } = someObject",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        // Multiple violations in the same statement
        {
            name: "Multiple Ref-suffixed names in object destructuring",
            code: "const { a: firstRef, b: secondRef } = someObject",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }, { messageId: "unexpectedRefSuffix" }]
        },

        // Ref suffix on a useCallback callback-ref (common mistake)
        {
            name: "Callback ref pattern: useCallback result must not use Ref suffix",
            code: "const setCallbackRef = useCallback(node => { if (node) node.focus() }, [])",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        }
    ]
})

// ─────────────────────────────────────────────────────────────────────────────
// Combined / mixed scenarios
// ─────────────────────────────────────────────────────────────────────────────
ruleTester.run("enforce-ref-suffix — mixed scenarios", rule, {
    valid: [
        // Both a useRef variable (with Ref) and a useState (without Ref) in same code block
        {
            name: "Correct useRef and useState variable names together",
            code: ["const inputRef = useRef<HTMLInputElement>(null)", "const [value, setValue] = useState('')"].join(
                "\n"
            ),
            filename: TSX
        },

        // Ref suffix inside a longer identifier — 'Refresh' does not end in 'Ref'
        {
            name: "Word 'Refresh' does not match Ref suffix",
            code: "const autoRefresh = setInterval(() => {}, 1000)",
            filename: TSX
        },

        // 'Reference' does not end in 'Ref'
        {
            name: "Word 'Reference' does not match Ref suffix",
            code: "const idReference = someFunction()",
            filename: TSX
        },

        // Shorthand prop from context/hook — real-world pattern (sendAssistantMessageRef)
        {
            name: "Shorthand Ref-keyed prop from context hook is allowed",
            code: "const { sendAssistantMessageRef } = useCreateSheet()",
            filename: TSX
        },

        // Renamed shorthand where key ends in Ref is also allowed
        {
            name: "Renamed shorthand where key ends in Ref: const { bodyRef: bodyRef } allowed",
            code: "const { bodyRef: bodyRefLocal } = useBodyRefs()",
            filename: TSX
        }
    ],
    invalid: [
        // Both violations in one block
        {
            name: "useRef without suffix AND useState with suffix",
            code: ["const container = useRef(null)", "const valueRef = useState('')"].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingRefSuffix" }, { messageId: "unexpectedRefSuffix" }]
        },

        // Rule applies regardless of const/let/var
        {
            name: "let useRef variable missing Ref suffix",
            code: "let container = useRef(null)",
            filename: TSX,
            errors: [{ messageId: "missingRefSuffix" }]
        },

        {
            name: "var useRef variable missing Ref suffix",
            code: "var container = useRef(null)",
            filename: TSX,
            errors: [{ messageId: "missingRefSuffix" }]
        },

        {
            name: "let non-useRef variable with Ref suffix",
            code: "let myRef = someFunction()",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        },

        {
            name: "var non-useRef variable with Ref suffix",
            code: "var myRef = 'hello'",
            filename: TSX,
            errors: [{ messageId: "unexpectedRefSuffix" }]
        }
    ]
})
