// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import { tanstackConfig } from '@tanstack/eslint-config'
import storybook from 'eslint-plugin-storybook'
import customPlugin from './.eslint/rules/index.ts'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    ignores: ['eslint.config.ts', 'prettier.config.js'],
  },
  ...storybook.configs['flat/recommended'],
  // Custom plugin
  ...customPlugin.configs.recommended,
  {
    ignores: [
      'src/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
      'src/**/docs/**',
    ],
  },
]
