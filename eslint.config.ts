// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import { tanstackConfig } from "@tanstack/eslint-config"
import customPlugin from "code-conventions/eslint"
import storybook from "eslint-plugin-storybook"

export default [
    ...tanstackConfig,
    {
        rules: {
            "import/no-cycle": "off",
            "import/order": "off",
            "sort-imports": "off",
            "@typescript-eslint/array-type": "off",
            "@typescript-eslint/require-await": "off",
            "pnpm/json-enforce-catalog": "off"
        }
    },
    {
        ignores: ["eslint.config.ts", "prettier.config.js"]
    },
    ...storybook.configs["flat/recommended"],
    // Custom plugin
    ...customPlugin.configs.recommended,
    {
        rules: {
            "custom/require-storybook": "off",
            "@typescript-eslint/naming-convention": [
                "warn",
                {
                    selector: "interface",
                    format: ["PascalCase"],
                    prefix: ["I"],
                    filter: { regex: "^I|^(Window)$", match: false }
                },
                { selector: "typeAlias", format: ["PascalCase"], prefix: ["I"] }
            ]
        }
    },
    {
        ignores: [
            "src/**/*.test.tsx",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.spec.tsx",
            "src/**/docs/**",
            "src/lib/**",
            "src/tests/**",
            "src/router.tsx"
        ]
    }
]
