import type { IToPascalCase } from "./to-pascal-case.ts"

/**
 * Type-level transformation that converts a string literal value into the
 * canonical PascalCase key used to index it in a string-literal union's
 * companion `as const` object (see `glaut/enforce-union-types-source-of-truth`).
 *
 * This is the single source of truth referenced by the ESLint rule: the
 * rule inspects `satisfies Record<IKeyable<T>, T>`, so any future change to
 * how values map to keys only needs to happen here (and, in parallel, in
 * the rule's runtime key-derivation helper).
 *
 * Currently delegates to `IToPascalCase`, which splits on `_` and `-`
 * before capitalizing, so delimited values become `PascalCase` keys:
 * - `IKeyable<"bar_chart">`      -> `"BarChart"`
 * - `IKeyable<"stacked_bar">`    -> `"StackedBar"`
 * - `IKeyable<"pre-generation">` -> `"PreGeneration"`
 * - `IKeyable<"crosstab">`       -> `"Crosstab"`
 */
export type IKeyable<S extends string> = IToPascalCase<S>
