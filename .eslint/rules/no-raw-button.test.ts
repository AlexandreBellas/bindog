import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./no-raw-button"

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

ruleTester.run("no-raw-button", rule, {
    valid: [
        // Uppercase `<Button>` React component — allowed (shadcn component)
        {
            code: "const MyComponent = () => <Button>Click me</Button>",
            filename: TSX
        },

        // Uppercase `<Button>` with attributes — allowed
        {
            code: 'const MyComponent = () => <Button type="submit" onClick={handleClick}>Submit</Button>',
            filename: TSX
        },

        // Uppercase `<Button>` with disabled prop — allowed
        {
            code: "const MyComponent = () => <Button disabled>Disabled</Button>",
            filename: TSX
        },

        // Uppercase `<Button>` self-closing — allowed
        {
            code: "const MyComponent = () => <Button />",
            filename: TSX
        },

        // `<div>` element — allowed (not a button)
        {
            code: "const MyComponent = () => <div>Content</div>",
            filename: TSX
        },

        // `<input>` element — allowed (not a button)
        {
            code: 'const MyComponent = () => <input type="text" />',
            filename: TSX
        },

        // `<form>` element with submit — allowed (no button tag)
        {
            code: "const MyComponent = () => <form onSubmit={handleSubmit}><input /></form>",
            filename: TSX
        },

        // `<a>` element used as clickable area — allowed
        {
            code: 'const MyComponent = () => <a href="/path">Link</a>',
            filename: TSX
        },

        // `<span>` with onClick — allowed (not a button)
        {
            code: "const MyComponent = () => <span onClick={handleClick}>Clickable</span>",
            filename: TSX
        },

        // Namespaced component (JSXMemberExpression) — not a raw HTML button
        {
            code: "const MyComponent = () => <Foo.Button>Click</Foo.Button>",
            filename: TSX
        },

        // Component with no JSX at all — allowed
        {
            code: "const value = 42",
            filename: TSX
        },

        // Note: storybook files (*.stories.tsx) are excluded from this rule at the config
        // level via `ignores: ["src/**/*.stories.tsx"]` in the plugin's recommended config.
        // The RuleTester tests the rule in isolation without config-level file exclusions,
        // so there is no valid test case for storybook files here.

        // Non-TSX TS file using button string (not JSX) — allowed
        {
            code: 'const tag = "button"',
            filename: "src/utils/helper.ts"
        },

        // Complex component with shadcn Button imported and used — allowed
        {
            code: [
                'import Button from "src/components/ui/button"',
                "const MyComponent = () => (",
                "  <div>",
                "    <Button onClick={handleClick}>Save</Button>",
                "  </div>",
                ")"
            ].join("\n"),
            filename: TSX
        },

        // `<ButtonGroup>` — not a raw button (PascalCase)
        {
            code: "const MyComponent = () => <ButtonGroup><Button>A</Button></ButtonGroup>",
            filename: TSX
        }
    ],
    invalid: [
        // Simple raw `<button>` element
        {
            code: "const MyComponent = () => <button>Click me</button>",
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        },

        // Raw `<button>` with type attribute
        {
            code: 'const MyComponent = () => <button type="submit">Submit</button>',
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        },

        // Raw `<button>` with onClick handler
        {
            code: "const MyComponent = () => <button onClick={handleClick}>Click</button>",
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        },

        // Raw `<button>` with disabled attribute
        {
            code: "const MyComponent = () => <button disabled>Disabled</button>",
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        },

        // Raw `<button>` with className
        {
            code: 'const MyComponent = () => <button className="btn">Styled</button>',
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        },

        // Self-closing raw `<button />`
        {
            code: "const MyComponent = () => <button />",
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        },

        // Raw `<button>` with multiple attributes
        {
            code: [
                "const MyComponent = () => (",
                '  <button type="button" onClick={handleClick} disabled={isLoading}>',
                "    Save",
                "  </button>",
                ")"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        },

        // Raw `<button>` nested inside a div
        {
            code: [
                "const MyComponent = () => (",
                "  <div>",
                "    <button onClick={handleClick}>Click</button>",
                "  </div>",
                ")"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        },

        // Multiple raw `<button>` elements in the same component — each flagged
        {
            code: [
                "const MyComponent = () => (",
                "  <div>",
                "    <button onClick={onConfirm}>Confirm</button>",
                "    <button onClick={onCancel}>Cancel</button>",
                "  </div>",
                ")"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "noRawButton" }, { messageId: "noRawButton" }]
        },

        // Raw `<button>` inside a form element
        {
            code: [
                "const MyForm = () => (",
                "  <form onSubmit={handleSubmit}>",
                '    <input type="text" />',
                '    <button type="submit">Submit</button>',
                "  </form>",
                ")"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        },

        // Raw `<button>` rendered conditionally
        {
            code: [
                "const MyComponent = ({ isVisible }) => (",
                "  <div>",
                "    {isVisible && <button onClick={handleClick}>Toggle</button>}",
                "  </div>",
                ")"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        },

        // Raw `<button>` inside a map — flagged once per occurrence in source
        {
            code: [
                "const MyComponent = ({ items }) => (",
                "  <ul>",
                "    {items.map(item => (",
                "      <li key={item.id}>",
                "        <button onClick={() => handleClick(item)}>Select</button>",
                "      </li>",
                "    ))}",
                "  </ul>",
                ")"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        },

        // Raw `<button>` alongside a correct shadcn `<Button>` — only raw one is flagged
        {
            code: [
                "const MyComponent = () => (",
                "  <div>",
                "    <Button onClick={onPrimary}>Primary</Button>",
                "    <button onClick={onSecondary}>Secondary</button>",
                "  </div>",
                ")"
            ].join("\n"),
            filename: TSX,
            errors: [{ messageId: "noRawButton" }]
        }
    ]
})
