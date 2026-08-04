//  @ts-check

import { defineConfig } from "code-conventions/prettier"

/** @type {import('prettier').Config} */
export default defineConfig({
    semi: false,
    singleQuote: false,
    arrowParens: "avoid",
    trailingComma: "none",
    endOfLine: "lf",
    printWidth: 120,
    jsxSingleQuote: false,
    tabWidth: 4,
    useTabs: false
})
