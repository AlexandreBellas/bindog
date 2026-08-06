/**
 * Type-level transformation that converts a delimited string literal into
 * `PascalCase`. Splits on `_` (snake_case) and `-` (kebab-case).
 *
 * Examples:
 * - `IToPascalCase<"bar_chart">`      -> `"BarChart"`
 * - `IToPascalCase<"stacked_bar">`    -> `"StackedBar"`
 * - `IToPascalCase<"pre-generation">` -> `"PreGeneration"`
 * - `IToPascalCase<"crosstab">`       -> `"Crosstab"`
 * - `IToPascalCase<"a_b_c">`          -> `"ABC"`
 *
 * Used as the key constraint for the PascalCase const values that back
 * string-literal union types throughout `src/@types` (see the
 * `glaut/enforce-union-types-source-of-truth` ESLint rule).
 */
export type IToPascalCase<S extends string> = S extends `${infer Head}_${infer Tail}`
    ? `${Capitalize<Head>}${IToPascalCase<Tail>}`
    : S extends `${infer Head}-${infer Tail}`
      ? `${Capitalize<Head>}${IToPascalCase<Tail>}`
      : Capitalize<S>
