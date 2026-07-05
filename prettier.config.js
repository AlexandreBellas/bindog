//  @ts-check

/** @type {import('prettier').Config} */
const config = {
  semi: false,
  singleQuote: false,
  arrowParens: "avoid",
  trailingComma: "none",
  endOfLine: "lf",
  printWidth: 120,
  jsxSingleQuote: false,
  tabWidth: 4,
  useTabs: false,
  plugins: [
    "./.prettier/plugins/region-organizer/index.mjs",
    "./.prettier/plugins/eslint-directive-remover/index.mjs",
    "./.prettier/plugins/use-translation-merger/index.mjs",
    "./.prettier/plugins/useeffect-comment-lifter/index.mjs",
    "./.prettier/plugins/union-type-formatter/index.mjs"
  ]
};

export default config;
