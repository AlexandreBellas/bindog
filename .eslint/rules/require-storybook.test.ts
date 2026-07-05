import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it, vi } from "vitest"

vi.mock("node:fs", () => {
    const siblingStories = new Set([
        "src/components/HasStory/index.stories.tsx",
        "src/components/ui/has-story.stories.tsx"
    ])
    const existsSyncFn = vi.fn((p: string) => siblingStories.has(p))
    const mock = { existsSync: existsSyncFn }
    return { default: mock, ...mock }
})

import rule from "./require-storybook"

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

const NO_STORY = "src/components/NoStory/index.tsx"
const HAS_STORY = "src/components/HasStory/index.tsx"
const HAS_STORY_UI = "src/components/ui/has-story.tsx"
const STORY_FILE = "src/components/Foo/index.stories.tsx"

// #region — missingStorybook: component files without a storybook sibling

ruleTester.run("require-storybook (missingStorybook)", rule, {
    valid: [
        // #region — Storybook file exists (sibling)

        {
            name: "default-exported function with storybook sibling",
            code: "export default function MyComponent() { return <div /> }",
            filename: HAS_STORY
        },
        {
            name: "default-exported arrow function with storybook sibling",
            code: ["const MyComponent = () => <div />", "export default MyComponent"].join("\n"),
            filename: HAS_STORY
        },
        {
            name: "memo-wrapped component with storybook sibling",
            code: "export default memo(() => <div />)",
            filename: HAS_STORY
        },
        {
            name: "forwardRef-wrapped component with storybook sibling",
            code: "export default forwardRef((props, ref) => <div ref={ref} />)",
            filename: HAS_STORY
        },
        {
            name: "named function with separate default export and storybook sibling",
            code: ["function MyComponent() { return <div /> }", "export default MyComponent"].join("\n"),
            filename: HAS_STORY
        },
        {
            name: "ui component with storybook sibling",
            code: "export default function HasStory() { return <div /> }",
            filename: HAS_STORY_UI
        },

        // #endregion

        // #region — No component definition (nothing to report)

        {
            name: "file with only type exports",
            code: ["export interface IFoo { bar: string }", "export type TBaz = number"].join("\n"),
            filename: NO_STORY
        },
        {
            name: "file with only constants",
            code: ["export const FOO = 42", "export const BAR = 'hello'"].join("\n"),
            filename: NO_STORY
        },
        {
            name: "file with only hooks",
            code: "export default function useFoo() { return 1 }",
            filename: NO_STORY
        },
        {
            name: "hook arrow function",
            code: "export const useBar = () => true",
            filename: NO_STORY
        },
        {
            name: "file with only camelCase functions",
            code: ["function helper() { return 1 }", "export default helper"].join("\n"),
            filename: NO_STORY
        },
        {
            name: "context creation (not a component)",
            code: "export const MyContext = createContext(null)",
            filename: NO_STORY
        },
        {
            name: "nested component inside function (not module-level)",
            code: [
                "export default function MyComponent() {",
                "  const Inner = () => <span />",
                "  return <div><Inner /></div>",
                "}"
            ].join("\n"),
            filename: HAS_STORY
        },

        // #endregion

        // #region — Anonymous default export with storybook sibling

        {
            name: "anonymous arrow function default export with storybook",
            code: "export default () => <div />",
            filename: HAS_STORY
        },
        {
            name: "anonymous function expression default export with storybook",
            code: "export default (function() { return <div /> })",
            filename: HAS_STORY
        }

        // #endregion
    ],
    invalid: [
        // #region — Default-exported components without storybook

        {
            name: "default-exported function component without storybook",
            code: "export default function MyComponent() { return <div /> }",
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "MyComponent", expected: "index.stories.tsx" } }]
        },
        {
            name: "default-exported arrow function component without storybook",
            code: ["const MyComponent = () => <div />", "export default MyComponent"].join("\n"),
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "MyComponent", expected: "index.stories.tsx" } }]
        },
        {
            name: "default-exported function declaration with separate export without storybook",
            code: ["function MyComponent() { return <div /> }", "export default MyComponent"].join("\n"),
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "MyComponent", expected: "index.stories.tsx" } }]
        },

        // #endregion

        // #region — memo / forwardRef without storybook

        {
            name: "memo-wrapped default export without storybook",
            code: "export default memo(() => <div />)",
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "(anonymous)", expected: "index.stories.tsx" } }]
        },
        {
            name: "React.memo-wrapped default export without storybook",
            code: "export default React.memo(() => <div />)",
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "(anonymous)", expected: "index.stories.tsx" } }]
        },
        {
            name: "forwardRef-wrapped default export without storybook",
            code: "export default forwardRef((props, ref) => <div ref={ref} />)",
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "(anonymous)", expected: "index.stories.tsx" } }]
        },
        {
            name: "React.forwardRef-wrapped default export without storybook",
            code: "export default React.forwardRef((props, ref) => <div ref={ref} />)",
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "(anonymous)", expected: "index.stories.tsx" } }]
        },
        {
            name: "named memo variable with separate default export without storybook",
            code: ["const MyComponent = memo(() => <div />)", "export default MyComponent"].join("\n"),
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "MyComponent", expected: "index.stories.tsx" } }]
        },
        {
            name: "named forwardRef variable with separate default export without storybook",
            code: [
                "const MyComponent = forwardRef((props, ref) => <div ref={ref} />)",
                "export default MyComponent"
            ].join("\n"),
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "MyComponent", expected: "index.stories.tsx" } }]
        },
        {
            name: "function wrapped with memo at default export without storybook",
            code: ["function MyComponent() { return <div /> }", "export default memo(MyComponent)"].join("\n"),
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "MyComponent", expected: "index.stories.tsx" } }]
        },
        {
            name: "function wrapped with React.memo at default export without storybook",
            code: ["function MyComponent() { return <div /> }", "export default React.memo(MyComponent)"].join("\n"),
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "MyComponent", expected: "index.stories.tsx" } }]
        },

        // #endregion

        // #region — Anonymous default exports without storybook

        {
            name: "anonymous arrow function default export without storybook",
            code: "export default () => <div />",
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "(anonymous)", expected: "index.stories.tsx" } }]
        },
        {
            name: "anonymous function expression default export without storybook",
            code: "export default (function() { return <div /> })",
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "(anonymous)", expected: "index.stories.tsx" } }]
        },
        {
            name: "anonymous function declaration default export without storybook",
            code: "export default function() { return <div /> }",
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "(anonymous)", expected: "index.stories.tsx" } }]
        },

        // #endregion

        // #region — Named-only components (no default export) without storybook

        {
            name: "named export function component without storybook",
            code: "export function MyComponent() { return <div /> }",
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "MyComponent", expected: "index.stories.tsx" } }]
        },
        {
            name: "named export arrow function component without storybook",
            code: "export const MyComponent = () => <div />",
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "MyComponent", expected: "index.stories.tsx" } }]
        },
        {
            name: "non-exported component without storybook",
            code: "function MyComponent() { return <div /> }",
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "MyComponent", expected: "index.stories.tsx" } }]
        },

        // #endregion

        // #region — Different file basenames

        {
            name: "non-index component file without storybook",
            code: "export default function Button() { return <button /> }",
            filename: "src/components/ui/button.tsx",
            errors: [{ messageId: "missingStorybook", data: { name: "Button", expected: "button.stories.tsx" } }]
        },
        {
            name: "ts file component without storybook",
            code: ["const Panel = () => null", "export default Panel"].join("\n"),
            filename: "src/components/Panel/index.ts",
            errors: [{ messageId: "missingStorybook", data: { name: "Panel", expected: "index.stories.ts" } }]
        },

        // #endregion

        // #region — Hook alongside component (hook is ignored, component reported)

        {
            name: "hook alongside default-exported component without storybook",
            code: [
                "export function useMyHook() { return true }",
                "export default function MyComponent() { return <div /> }"
            ].join("\n"),
            filename: NO_STORY,
            errors: [{ messageId: "missingStorybook", data: { name: "MyComponent", expected: "index.stories.tsx" } }]
        },

        // #endregion

        // #region — Story file in docs/ (convention violation — not a valid sibling)

        {
            name: "component with storybook only in docs directory (not a valid sibling)",
            code: "export default function MyComponent() { return <div /> }",
            filename: "src/components/HasDocsStory/index.tsx",
            errors: [
                {
                    messageId: "missingStorybook",
                    data: { name: "MyComponent", expected: "index.stories.tsx" }
                }
            ]
        }

        // #endregion
    ]
})

// #endregion

// #region — emptyStorybook: storybook files without any story exports

ruleTester.run("require-storybook (emptyStorybook)", rule, {
    valid: [
        // #region — Storybook files with at least one story

        {
            name: "storybook file with one const story export",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "export const Default = {}"
            ].join("\n"),
            filename: STORY_FILE
        },
        {
            name: "storybook file with multiple story exports",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "export const Default = {}",
                "export const WithProps = { args: { x: 1 } }"
            ].join("\n"),
            filename: STORY_FILE
        },
        {
            name: "storybook file with function story export",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "export function Default() { return <div /> }"
            ].join("\n"),
            filename: STORY_FILE
        },
        {
            name: "storybook file with re-export story",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "export { Default } from './other'"
            ].join("\n"),
            filename: STORY_FILE
        },
        {
            name: "storybook file with value and inline type specifiers in same export",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "export { Default, type IStoryArgs } from './other'"
            ].join("\n"),
            filename: STORY_FILE
        },
        {
            name: "storybook file with story alongside type exports",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "type Story = { args: {} }",
                "export const Default = {}"
            ].join("\n"),
            filename: STORY_FILE
        },
        {
            name: "storybook file with typed story constant",
            code: [
                "const meta = { title: 'Foo', component: Foo }",
                "export default meta",
                "type Story = StoryObj<typeof meta>",
                "export const Default: Story = {}"
            ].join("\n"),
            filename: STORY_FILE
        },

        // #endregion

        // #region — Different storybook file extensions

        {
            name: "storybook .stories.ts file with story",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "export const Default = {}"
            ].join("\n"),
            filename: "src/components/Foo/index.stories.ts"
        },
        {
            name: "storybook .stories.jsx file with story",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "export const Default = {}"
            ].join("\n"),
            filename: "src/components/Foo/Foo.stories.jsx"
        }

        // #endregion
    ],
    invalid: [
        // #region — Empty storybook files (no story exports)

        {
            name: "storybook file with only default export (meta only)",
            code: [
                "const meta = { title: 'Foo', component: Foo }",
                "export default meta"
            ].join("\n"),
            filename: STORY_FILE,
            errors: [
                { messageId: "emptyStorybook", data: { filename: "index.stories.tsx" } }
            ]
        },
        {
            name: "storybook file with default export and type-only exports",
            code: [
                "const meta = { title: 'Foo', component: Foo }",
                "export default meta",
                "export type Story = StoryObj<typeof meta>",
                "export interface IStoryArgs { label: string }"
            ].join("\n"),
            filename: STORY_FILE,
            errors: [
                { messageId: "emptyStorybook", data: { filename: "index.stories.tsx" } }
            ]
        },
        {
            name: "storybook file with type re-export only",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "export type { IFoo } from './types'"
            ].join("\n"),
            filename: STORY_FILE,
            errors: [
                { messageId: "emptyStorybook", data: { filename: "index.stories.tsx" } }
            ]
        },
        {
            name: "completely empty storybook file (no exports at all)",
            code: "// empty file",
            filename: STORY_FILE,
            errors: [
                { messageId: "emptyStorybook", data: { filename: "index.stories.tsx" } }
            ]
        },
        {
            name: "storybook file with only imports and local variables",
            code: [
                "import Foo from '.'",
                "const meta = { title: 'Foo', component: Foo }"
            ].join("\n"),
            filename: STORY_FILE,
            errors: [
                { messageId: "emptyStorybook", data: { filename: "index.stories.tsx" } }
            ]
        },
        {
            name: "storybook file with interface export only",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "export interface IStoryArgs { x: number }"
            ].join("\n"),
            filename: STORY_FILE,
            errors: [
                { messageId: "emptyStorybook", data: { filename: "index.stories.tsx" } }
            ]
        },
        {
            name: "storybook .stories.ts with only meta",
            code: [
                "const meta = { title: 'Bar' }",
                "export default meta"
            ].join("\n"),
            filename: "src/components/Bar/index.stories.ts",
            errors: [
                { messageId: "emptyStorybook", data: { filename: "index.stories.ts" } }
            ]
        },
        {
            name: "storybook file with inline type specifier re-export only",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "export { type IFoo } from './types'"
            ].join("\n"),
            filename: STORY_FILE,
            errors: [
                { messageId: "emptyStorybook", data: { filename: "index.stories.tsx" } }
            ]
        },
        {
            name: "storybook file with multiple inline type specifier re-exports only",
            code: [
                "const meta = { title: 'Foo' }",
                "export default meta",
                "export { type IFoo, type IBar } from './types'"
            ].join("\n"),
            filename: STORY_FILE,
            errors: [
                { messageId: "emptyStorybook", data: { filename: "index.stories.tsx" } }
            ]
        }

        // #endregion
    ]
})

// #endregion
