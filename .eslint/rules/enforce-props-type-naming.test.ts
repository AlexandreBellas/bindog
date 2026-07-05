import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./enforce-props-type-naming"

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
const HOOK_TS = "src/pages/Home/hooks/useMyHook.ts"
const HOOK_INDEX = "src/features/useMyHook/index.ts"

// Absolute-path variants — simulate what ESLint passes via context.filename in
// CLI / IDE integrations (as opposed to the relative paths used by RuleTester).
const ABS_TSX = "/home/user/project/src/components/MyComponent/index.tsx"
const ABS_HOOK_TS = "/home/user/project/src/pages/Home/hooks/useMyHook.ts"
const ABS_HOOK_INDEX = "/home/user/project/src/features/useMyHook/index.ts"

// Windows absolute paths (backslashes) — normalizePath must convert these too.
const WIN_TSX = "C:\\Users\\user\\project\\src\\components\\MyComponent\\index.tsx"
const WIN_HOOK_TS = "C:\\Users\\user\\project\\src\\pages\\Home\\hooks\\useMyHook.ts"

// Non-component/non-hook .ts files — Props declarations must not live here.
const TYPES_FILE = "src/components/MyComponent/@types/props.ts"
const GLOBAL_TYPES_FILE = "src/@types/myComponent.ts"
const UTILS_FILE = "src/utils/helpers.ts"
const CONSTANTS_FILE = "src/constants/api.ts"
const SERVICE_FILE = "src/services/foo/api/foo.api.ts"

ruleTester.run("enforce-props-type-naming", rule, {
    valid: [
        // Components without props are allowed
        {
            code: "function MyComponent() { return <div /> }",
            filename: TSX
        },
        {
            code: "const MyComponent = () => <div />",
            filename: TSX
        },
        {
            code: "const MyComponent: React.FC = () => <div />",
            filename: TSX
        },

        // Correct props typing — function declaration
        {
            code: [
                "function MyComponent(",
                "  { text }: Readonly<IMyComponentProps>",
                ") { return <div>{text}</div> }"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — exported function declaration
        {
            code: [
                "export function MyComponent(",
                "  { text }: Readonly<IMyComponentProps>",
                ") { return <div>{text}</div> }"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — default exported function
        {
            code: [
                "export default function MyComponent(",
                "  { text }: Readonly<IMyComponentProps>",
                ") { return <div>{text}</div> }"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — arrow function
        {
            code: [
                "const MyComponent = ",
                "  ({ text }: Readonly<IMyComponentProps>) =>",
                "    <div>{text}</div>"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — named param (not destructured)
        {
            code: [
                "const MyComponent = ",
                "  (props: Readonly<IMyComponentProps>) =>",
                "    <div>{props.text}</div>"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — React.FC
        {
            code: [
                "const MyComponent: React.FC<",
                "  Readonly<IMyComponentProps>",
                "> = ({ text }) => <div>{text}</div>"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — React.FunctionComponent
        {
            code: [
                "const MyComponent: React.FunctionComponent<",
                "  Readonly<IMyComponentProps>",
                "> = ({ text }) => <div>{text}</div>"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — bare FC import
        {
            code: [
                "const MyComponent: FC<",
                "  Readonly<IMyComponentProps>",
                "> = ({ text }) => <div>{text}</div>"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — forwardRef with generics
        {
            code: [
                "const MyComponent = forwardRef<",
                "  HTMLDivElement,",
                "  Readonly<IMyComponentProps>",
                ">(({ text }, ref) => <div ref={ref}>{text}</div>)"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — React.forwardRef
        {
            code: [
                "const MyComponent = React.forwardRef<",
                "  HTMLDivElement,",
                "  Readonly<IMyComponentProps>",
                ">(({ text }, ref) => <div ref={ref}>{text}</div>)"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — forwardRef with param type
        {
            code: [
                "const MyComponent = forwardRef(",
                "  ({ text }: Readonly<IMyComponentProps>, ref) =>",
                "    <div ref={ref}>{text}</div>",
                ")"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — memo
        {
            code: [
                "const MyComponent = memo(",
                "  ({ text }: Readonly<IMyComponentProps>) =>",
                "    <div>{text}</div>",
                ")"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — React.memo
        {
            code: [
                "const MyComponent = React.memo(",
                "  ({ text }: Readonly<IMyComponentProps>) =>",
                "    <div>{text}</div>",
                ")"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — memo(forwardRef)
        {
            code: [
                "const MyComponent = memo(forwardRef<",
                "  HTMLDivElement,",
                "  Readonly<IMyComponentProps>",
                ">(({ text }, ref) => <div ref={ref}>{text}</div>))"
            ].join("\n"),
            filename: TSX
        },

        // Correct props typing — with default param values
        {
            code: [
                "function MyComponent(",
                '  { text = "hi" }: Readonly<IMyComponentProps>',
                ") { return <div>{text}</div> }"
            ].join("\n"),
            filename: TSX
        },

        // Non-PascalCase names are ignored (not components)
        {
            code: "const myHelper = (data: IData) => data.value",
            filename: TSX
        },
        {
            code: ["const formatDate =", "  (d: Date): string => d.toISOString()"].join("\n"),
            filename: TSX
        },

        // Non-target .ts files are ignored (not under hook filename patterns)
        {
            code: ["function MyComponent(", "  { text }: IWrongType", ") { return text }"].join("\n"),
            filename: "src/lib/helpers.ts"
        },

        // Nested hook path under hooks/ does not match `hooks/use*.ts` — ignored
        {
            code: ["export function useNested(", "  { text }: IWrongType", ") { return text }"].join("\n"),
            filename: "src/pages/Home/hooks/sub/useNested.ts"
        },

        // Hooks — correct Readonly<IUse{Name}Props> (`useMyHook` → `IUseMyHookProps`)
        {
            code: ["export function useMyHook(", "  { text }: Readonly<IUseMyHookProps>", ") { return text }"].join(
                "\n"
            ),
            filename: HOOK_TS
        },
        {
            code: ["export const useMyHook = ", "  ({ text }: Readonly<IUseMyHookProps>) => text"].join("\n"),
            filename: HOOK_INDEX
        },

        // Hook with named (non-destructured) param typed with Readonly
        {
            code: ["export function useMyHook(", "  opts: Readonly<IUseMyHookProps>", ") { return opts.text }"].join(
                "\n"
            ),
            filename: HOOK_TS
        },

        // Hook typed via FC<> generic — Readonly in generic (unusual but enforced by the rule)
        {
            code: ["const useMyHook: React.FC<", "  Readonly<IUseMyHookProps>", "> = ({ text }) => text"].join("\n"),
            filename: HOOK_TS
        },

        // Hook without props param — allowed
        {
            code: "export function useMyHook() { return 1 }",
            filename: HOOK_TS
        },

        // Test files are excluded
        {
            code: ["function MyComponent(", "  { text }: IWrongType", ") { return <div>{text}</div> }"].join("\n"),
            filename: "src/components/Foo/index.test.tsx"
        },

        // Story files are excluded
        {
            code: ["function MyComponent(", "  { text }: IWrongType", ") { return <div>{text}</div> }"].join("\n"),
            filename: "src/components/Foo/index.stories.tsx"
        },

        // Spec files are excluded
        {
            code: ["function MyComponent(", "  { text }: IWrongType", ") { return <div>{text}</div> }"].join("\n"),
            filename: "src/components/Foo/index.spec.tsx"
        },

        // Multi-word component name
        {
            code: [
                "const AnalysisTabButton = ",
                "  ({ label }: Readonly<IAnalysisTabButtonProps>) =>",
                "    <button>{label}</button>"
            ].join("\n"),
            filename: "src/components/AnalysisTabButton/index.tsx"
        },

        // forwardRef without generics and without typed params → no props
        {
            code: ["const MyComponent = forwardRef(", "  (_, ref) => <div ref={ref} />", ")"].join("\n"),
            filename: TSX
        },

        // memo without typed params → no props
        {
            code: "const MyComponent = memo(() => <div />)",
            filename: TSX
        },

        // forwardRef with generics AND a typed param — only the second generic is
        // validated; a mismatched inline param annotation is intentionally ignored
        // because the canonical source of truth is the type argument, not the param.
        {
            code: [
                "const MyComponent = forwardRef<",
                "  HTMLDivElement,",
                "  Readonly<IMyComponentProps>",
                ">(({ text }: Readonly<IWrongProps>, ref) => <div ref={ref}>{text}</div>)"
            ].join("\n"),
            filename: TSX
        },

        // React.PropsWithChildren as standalone props — acceptable for layout/wrapper
        // components that have no custom props interface (interface form).
        {
            code: [
                "interface IMyComponentProps extends React.PropsWithChildren {}",
                "const MyComponent: React.FC<Readonly<IMyComponentProps>> =",
                "  ({ children }) => <div>{children}</div>"
            ].join("\n"),
            filename: TSX
        },

        // React.PropsWithChildren used directly as inline param type — valid for
        // wrapper components; should not trigger invalidPropsTypeName.
        {
            code: [
                "const MyComponent =",
                "  ({ children }: Readonly<React.PropsWithChildren>) =>",
                "    <div>{children}</div>"
            ].join("\n"),
            filename: TSX
        },

        // Bare PropsWithChildren (named import) — also acceptable.
        {
            code: [
                "const MyComponent =",
                "  ({ children }: Readonly<PropsWithChildren>) =>",
                "    <div>{children}</div>"
            ].join("\n"),
            filename: TSX
        },

        // memo(Inner) where Inner is already typed as React.FC — the Identifier
        // argument is not a function expression, so the rule passes MyComponent
        // without re-validating props. Inner is validated separately via its own
        // declaration, so no double-reporting occurs. This is intentional behavior.
        {
            code: [
                "const Inner: React.FC<Readonly<IInnerProps>> =",
                "  ({ text }) => <div>{text}</div>",
                "const MyComponent = memo(Inner)"
            ].join("\n"),
            filename: TSX
        },

        // ── Absolute-path regression tests ──────────────────────────────────
        // ESLint passes absolute paths to context.filename in real runs; the
        // rule must normalise them so that the ^src/ regexes still fire.

        // Unix absolute path — correct TSX props (should pass, not be silently skipped)
        {
            code: [
                "export function MyComponent(",
                "  { text }: Readonly<IMyComponentProps>",
                ") { return <div>{text}</div> }"
            ].join("\n"),
            filename: ABS_TSX
        },

        // Unix absolute path — correct hook props
        {
            code: ["export function useMyHook(", "  { text }: Readonly<IUseMyHookProps>", ") { return text }"].join(
                "\n"
            ),
            filename: ABS_HOOK_TS
        },

        // Unix absolute path — correct hook index barrel
        {
            code: ["export const useMyHook = ", "  ({ text }: Readonly<IUseMyHookProps>) => text"].join("\n"),
            filename: ABS_HOOK_INDEX
        },

        // Windows absolute path — correct TSX props
        {
            code: [
                "export function MyComponent(",
                "  { text }: Readonly<IMyComponentProps>",
                ") { return <div>{text}</div> }"
            ].join("\n"),
            filename: WIN_TSX
        },

        // Windows absolute path — correct hook props
        {
            code: ["export function useMyHook(", "  { text }: Readonly<IUseMyHookProps>", ") { return text }"].join(
                "\n"
            ),
            filename: WIN_HOOK_TS
        },

        // Absolute path to a non-hook .ts file — must remain ignored (rule should
        // not fire just because the path happens to pass after normalisation).
        {
            code: ["function MyComponent(", "  { text }: IWrongType", ") { return text }"].join("\n"),
            filename: "/home/user/project/src/lib/helpers.ts"
        },

        // ── Props colocation: Props interface IS allowed in component/hook files ──

        // Props interface declared in a TSX component file — allowed
        {
            code: "interface IMyComponentProps { text: string }",
            filename: TSX
        },

        // Props type alias declared in a TSX component file — allowed
        {
            code: "type IMyComponentProps = { text: string }",
            filename: TSX
        },

        // Props interface declared in a hook file — allowed
        {
            code: "interface IUseMyHookProps { text: string }",
            filename: HOOK_TS
        },

        // Props type alias declared in a hook index barrel — allowed
        {
            code: "type IUseMyHookProps = { text: string }",
            filename: HOOK_INDEX
        },

        // Props interface in absolute-path component file — allowed
        {
            code: "interface IMyComponentProps { text: string }",
            filename: ABS_TSX
        },

        // Props interface in absolute-path hook file — allowed
        {
            code: "interface IUseMyHookProps { text: string }",
            filename: ABS_HOOK_TS
        },

        // Non-Props interfaces in @types files are fine (not flagged by this rule)
        {
            code: "interface IUser { id: string }",
            filename: TYPES_FILE
        },

        // Non-Props type aliases in @types files are fine
        {
            code: "type ITabItem = { label: string }",
            filename: GLOBAL_TYPES_FILE
        },

        // Test/spec/stories files are excluded from Props colocation check too
        {
            code: "interface IMyComponentProps { text: string }",
            filename: "src/components/Foo/@types/props.test.ts"
        },

        // Non-Props interfaces in utility files are not checked by this rule
        {
            code: "interface IHelper { compute: () => void }",
            filename: UTILS_FILE
        }
    ],
    invalid: [
        // Missing Readonly wrapper — function declaration
        {
            code: ["function MyComponent(", "  { text }: IMyComponentProps", ") { return <div>{text}</div> }"].join(
                "\n"
            ),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Missing Readonly wrapper — arrow function
        {
            code: ["const MyComponent = ", "  ({ text }: IMyComponentProps) =>", "    <div>{text}</div>"].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Missing Readonly wrapper — React.FC
        {
            code: ["const MyComponent: React.FC<IMyComponentProps> = ", "  ({ text }) => <div>{text}</div>"].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Missing Readonly wrapper — forwardRef generic
        {
            code: [
                "const MyComponent = forwardRef<",
                "  HTMLDivElement,",
                "  IMyComponentProps",
                ">(({ text }, ref) => <div ref={ref}>{text}</div>)"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Missing Readonly wrapper — memo
        {
            code: [
                "const MyComponent = memo(",
                "  ({ text }: IMyComponentProps) =>",
                "    <div>{text}</div>",
                ")"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Wrong type name — with Readonly
        {
            code: ["function MyComponent(", "  { text }: Readonly<IWrongName>", ") { return <div>{text}</div> }"].join(
                "\n"
            ),
            filename: TSX,
            errors: [{ messageId: "invalidPropsTypeName" }]
        },

        // Wrong type name — React.FC with Readonly
        {
            code: [
                "const MyComponent: React.FC<",
                "  Readonly<IWrongName>",
                "> = ({ text }) => <div>{text}</div>"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "invalidPropsTypeName" }]
        },

        // Wrong type name — forwardRef with Readonly
        {
            code: [
                "const MyComponent = forwardRef<",
                "  HTMLDivElement,",
                "  Readonly<IWrongName>",
                ">(({ text }, ref) => <div ref={ref}>{text}</div>)"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "invalidPropsTypeName" }]
        },

        // Both wrong: wrong name AND missing Readonly
        {
            code: ["function MyComponent(", "  { text }: IWrongName", ") { return <div>{text}</div> }"].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }, { messageId: "invalidPropsTypeName" }]
        },

        // Both wrong — React.FC
        {
            code: ["const MyComponent: React.FC<IWrongName> = ", "  ({ text }) => <div>{text}</div>"].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }, { messageId: "invalidPropsTypeName" }]
        },

        // Inline type — no Readonly, no named interface
        {
            code: ["function MyComponent(", "  { text }: { text: string }", ") { return <div>{text}</div> }"].join(
                "\n"
            ),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }, { messageId: "invalidPropsTypeName" }]
        },

        // Inline type inside Readonly — named interface required
        {
            code: [
                "function MyComponent(",
                "  { text }: Readonly<{ text: string }>",
                ") { return <div>{text}</div> }"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "invalidPropsTypeName" }]
        },

        // Named param (not destructured) — missing Readonly
        {
            code: ["const MyComponent = ", "  (props: IMyComponentProps) =>", "    <div>{props.text}</div>"].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Exported component — wrong name
        {
            code: ["export const MyComponent = ", "  ({ text }: Readonly<IFoo>) =>", "    <div>{text}</div>"].join(
                "\n"
            ),
            filename: TSX,
            errors: [{ messageId: "invalidPropsTypeName" }]
        },

        // Multi-word component — wrong name
        {
            code: [
                "const AnalysisTabButton = ",
                "  ({ label }: Readonly<IButtonProps>) =>",
                "    <button>{label}</button>"
            ].join("\n"),
            filename: "src/components/AnalysisTabButton/index.tsx",
            errors: [{ messageId: "invalidPropsTypeName" }]
        },

        // forwardRef with param type — missing Readonly
        {
            code: [
                "const MyComponent = forwardRef(",
                "  ({ text }: IMyComponentProps, ref) =>",
                "    <div ref={ref}>{text}</div>",
                ")"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // memo(forwardRef) — wrong name in generic
        {
            code: [
                "const MyComponent = memo(forwardRef<",
                "  HTMLDivElement,",
                "  Readonly<IWrongName>",
                ">(({ text }, ref) => <div ref={ref}>{text}</div>))"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "invalidPropsTypeName" }]
        },

        // memo(forwardRef) — missing Readonly in generic
        {
            code: [
                "const MyComponent = memo(forwardRef<",
                "  HTMLDivElement,",
                "  IMyComponentProps",
                ">(({ text }, ref) => <div ref={ref}>{text}</div>))"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // FunctionComponent variant — missing Readonly
        {
            code: [
                "const MyComponent: FunctionComponent<",
                "  IMyComponentProps",
                "> = ({ text }) => <div>{text}</div>"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Hook — missing Readonly
        {
            code: ["export function useMyHook(", "  { text }: IUseMyHookProps", ") { return text }"].join("\n"),
            filename: HOOK_TS,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Hook — wrong inner interface name (with Readonly)
        {
            code: ["export function useMyHook(", "  { text }: Readonly<IWrongHookProps>", ") { return text }"].join(
                "\n"
            ),
            filename: HOOK_TS,
            errors: [{ messageId: "invalidPropsTypeName" }]
        },

        // Hook — wrong name and missing Readonly
        {
            code: ["export function useMyHook(", "  { text }: IWrongHookProps", ") { return text }"].join("\n"),
            filename: HOOK_INDEX,
            errors: [{ messageId: "missingReadonlyWrapper" }, { messageId: "invalidPropsTypeName" }]
        },

        // Hook (arrow function) — missing Readonly
        {
            code: ["export const useMyHook = ", "  ({ text }: IUseMyHookProps) => text"].join("\n"),
            filename: HOOK_INDEX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Hook (arrow function) — wrong interface name (with Readonly)
        {
            code: ["export const useMyHook = ", "  ({ text }: Readonly<IWrongHookProps>) => text"].join("\n"),
            filename: HOOK_TS,
            errors: [{ messageId: "invalidPropsTypeName" }]
        },

        // Hook typed via FC<> generic — missing Readonly
        {
            code: ["const useMyHook: React.FC<IUseMyHookProps> = ", "  ({ text }) => text"].join("\n"),
            filename: HOOK_TS,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Hook typed via FC<> generic — wrong interface name
        {
            code: ["const useMyHook: React.FC<", "  Readonly<IWrongHookProps>", "> = ({ text }) => text"].join("\n"),
            filename: HOOK_TS,
            errors: [{ messageId: "invalidPropsTypeName" }]
        },

        // ── Absolute-path regression tests ──────────────────────────────────
        // The rule must report errors even when context.filename is absolute.

        // Unix absolute path — missing Readonly in TSX component
        {
            code: ["function MyComponent(", "  { text }: IMyComponentProps", ") { return <div>{text}</div> }"].join(
                "\n"
            ),
            filename: ABS_TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Unix absolute path — wrong name in TSX component
        {
            code: ["function MyComponent(", "  { text }: Readonly<IWrongName>", ") { return <div>{text}</div> }"].join(
                "\n"
            ),
            filename: ABS_TSX,
            errors: [{ messageId: "invalidPropsTypeName" }]
        },

        // Unix absolute path — missing Readonly in hook
        {
            code: ["export function useMyHook(", "  { text }: IUseMyHookProps", ") { return text }"].join("\n"),
            filename: ABS_HOOK_TS,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Unix absolute path — wrong name and missing Readonly in hook barrel
        {
            code: ["export function useMyHook(", "  { text }: IWrongHookProps", ") { return text }"].join("\n"),
            filename: ABS_HOOK_INDEX,
            errors: [{ messageId: "missingReadonlyWrapper" }, { messageId: "invalidPropsTypeName" }]
        },

        // Windows absolute path — missing Readonly in TSX component
        {
            code: ["function MyComponent(", "  { text }: IMyComponentProps", ") { return <div>{text}</div> }"].join(
                "\n"
            ),
            filename: WIN_TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // Windows absolute path — missing Readonly in hook
        {
            code: ["export function useMyHook(", "  { text }: IUseMyHookProps", ") { return text }"].join("\n"),
            filename: WIN_HOOK_TS,
            errors: [{ messageId: "missingReadonlyWrapper" }]
        },

        // ── Validation 1: paramsInsteadOfProps ────────────────────────────────
        // When the props annotation ends with "Params", report paramsInsteadOfProps
        // instead of invalidPropsTypeName.

        // Component: Params with Readonly → only paramsInsteadOfProps
        {
            code: [
                "function MyComponent(",
                "  { text }: Readonly<IMyComponentParams>",
                ") { return <div>{text}</div> }"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "paramsInsteadOfProps" }]
        },

        // Component: Params without Readonly → missingReadonlyWrapper + paramsInsteadOfProps
        {
            code: ["function MyComponent(", "  { text }: IMyComponentParams", ") { return <div>{text}</div> }"].join(
                "\n"
            ),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }, { messageId: "paramsInsteadOfProps" }]
        },

        // Component (arrow function): Params with Readonly
        {
            code: [
                "const MyComponent = ",
                "  ({ text }: Readonly<IMyComponentParams>) =>",
                "    <div>{text}</div>"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "paramsInsteadOfProps" }]
        },

        // Component (arrow function): Params without Readonly
        {
            code: ["const MyComponent = ", "  ({ text }: IMyComponentParams) =>", "    <div>{text}</div>"].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }, { messageId: "paramsInsteadOfProps" }]
        },

        // Component (React.FC): Params with Readonly
        {
            code: [
                "const MyComponent: React.FC<",
                "  Readonly<IMyComponentParams>",
                "> = ({ text }) => <div>{text}</div>"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "paramsInsteadOfProps" }]
        },

        // Component (React.FC): Params without Readonly
        {
            code: ["const MyComponent: React.FC<IMyComponentParams> = ", "  ({ text }) => <div>{text}</div>"].join(
                "\n"
            ),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }, { messageId: "paramsInsteadOfProps" }]
        },

        // Component (forwardRef generic): Params with Readonly
        {
            code: [
                "const MyComponent = forwardRef<",
                "  HTMLDivElement,",
                "  Readonly<IMyComponentParams>",
                ">(({ text }, ref) => <div ref={ref}>{text}</div>)"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "paramsInsteadOfProps" }]
        },

        // Component (forwardRef generic): Params without Readonly
        {
            code: [
                "const MyComponent = forwardRef<",
                "  HTMLDivElement,",
                "  IMyComponentParams",
                ">(({ text }, ref) => <div ref={ref}>{text}</div>)"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "missingReadonlyWrapper" }, { messageId: "paramsInsteadOfProps" }]
        },

        // Component (memo): Params with Readonly
        {
            code: [
                "const MyComponent = memo(",
                "  ({ text }: Readonly<IMyComponentParams>) =>",
                "    <div>{text}</div>",
                ")"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "paramsInsteadOfProps" }]
        },

        // Component (memo(forwardRef)): Params with Readonly
        {
            code: [
                "const MyComponent = memo(forwardRef<",
                "  HTMLDivElement,",
                "  Readonly<IMyComponentParams>",
                ">(({ text }, ref) => <div ref={ref}>{text}</div>))"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "paramsInsteadOfProps" }]
        },

        // Hook (function declaration): Params with Readonly
        {
            code: ["export function useMyHook(", "  { text }: Readonly<IUseMyHookParams>", ") { return text }"].join(
                "\n"
            ),
            filename: HOOK_TS,
            errors: [{ messageId: "paramsInsteadOfProps" }]
        },

        // Hook (function declaration): Params without Readonly
        {
            code: ["export function useMyHook(", "  { text }: IUseMyHookParams", ") { return text }"].join("\n"),
            filename: HOOK_TS,
            errors: [{ messageId: "missingReadonlyWrapper" }, { messageId: "paramsInsteadOfProps" }]
        },

        // Hook (arrow function): Params with Readonly
        {
            code: ["export const useMyHook = ", "  ({ text }: Readonly<IUseMyHookParams>) => text"].join("\n"),
            filename: HOOK_INDEX,
            errors: [{ messageId: "paramsInsteadOfProps" }]
        },

        // Hook (arrow function): Params without Readonly
        {
            code: ["export const useMyHook = ", "  ({ text }: IUseMyHookParams) => text"].join("\n"),
            filename: HOOK_INDEX,
            errors: [{ messageId: "missingReadonlyWrapper" }, { messageId: "paramsInsteadOfProps" }]
        },

        // Params that has a wrong component name prefix — still paramsInsteadOfProps
        // (after renaming Params → Props the name will be validated in the next run)
        {
            code: [
                "function MyComponent(",
                "  { text }: Readonly<IWrongComponentParams>",
                ") { return <div>{text}</div> }"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "paramsInsteadOfProps" }]
        },

        // ── Validation 2: propsInterfaceNotColocated ──────────────────────────
        // Props-ending interfaces/types declared outside component/hook files
        // must be reported.

        // Interface in a component-local @types folder
        {
            code: "interface IMyComponentProps { text: string }",
            filename: TYPES_FILE,
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        },

        // Type alias in a component-local @types folder
        {
            code: "type IMyComponentProps = { text: string }",
            filename: TYPES_FILE,
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        },

        // Interface in global @types file
        {
            code: "interface IMyComponentProps { text: string }",
            filename: GLOBAL_TYPES_FILE,
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        },

        // Type alias in global @types file
        {
            code: "type IMyComponentProps = { text: string }",
            filename: GLOBAL_TYPES_FILE,
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        },

        // Interface in a utility file
        {
            code: "interface IMyComponentProps { text: string }",
            filename: UTILS_FILE,
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        },

        // Type alias in a utility file
        {
            code: "type IMyComponentProps = { text: string }",
            filename: UTILS_FILE,
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        },

        // Interface in a constants file
        {
            code: "interface IFilterProps { label: string }",
            filename: CONSTANTS_FILE,
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        },

        // Interface in a service file
        {
            code: "interface IRequestProps { id: string }",
            filename: SERVICE_FILE,
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        },

        // Exported interface in @types — same rule applies
        {
            code: "export interface IMyComponentProps { text: string }",
            filename: TYPES_FILE,
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        },

        // Exported type alias in @types — same rule applies
        {
            code: "export type IMyComponentProps = { text: string }",
            filename: GLOBAL_TYPES_FILE,
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        },

        // Multiple Props declarations in the same non-component file — each reported
        {
            code: [
                "interface IFooProps { a: string }",
                "interface IBarProps { b: number }",
                "type IFooAction = { type: 'reset' }"
            ].join("\n"),
            filename: TYPES_FILE,
            errors: [{ messageId: "propsInterfaceNotColocated" }, { messageId: "propsInterfaceNotColocated" }]
        },

        // Absolute path to @types file — must still be caught
        {
            code: "interface IMyComponentProps { text: string }",
            filename: "/home/user/project/src/components/MyComponent/@types/props.ts",
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        },

        // Windows absolute path to @types file — normalizePath must convert backslashes
        {
            code: "interface IMyComponentProps { text: string }",
            filename: "C:\\Users\\user\\project\\src\\components\\MyComponent\\@types\\props.ts",
            errors: [{ messageId: "propsInterfaceNotColocated" }]
        }
    ]
})
