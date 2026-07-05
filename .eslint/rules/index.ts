import type { Plugin } from "@eslint/core"
import type { TSESLint } from "@typescript-eslint/utils"
import { ESLint, Linter } from "eslint"
import enforceComponentImportLimits from "./enforce-component-import-limits"
import enforceComponentStructure from "./enforce-component-structure"
import enforceConstantLocation from "./enforce-constant-location"
import enforceHelperLocation from "./enforce-helper-location"
import enforcePropsTypeNaming from "./enforce-props-type-naming"
import enforceQueryHooksStructure from "./enforce-query-hooks-structure"
import enforceRefSuffix from "./enforce-ref-suffix"
import enforceSingleComponent from "./enforce-single-component"
import enforceSingleUseTranslation from "./enforce-single-use-translation"
import enforceTypeLocation from "./enforce-type-location"
import enforceUnionTypesSourceOfTruth from "./enforce-union-types-source-of-truth"
import maxComponentLines from "./max-component-lines"
import noDirectServiceCalls from "./no-direct-service-calls"
import noNonNullAssertion from "./no-non-null-assertion"
import noRawButton from "./no-raw-button"
import noRestrictedAxiosAuth from "./no-restricted-axios-auth"
import noRestrictedUseContext from "./no-restricted-use-context"
import noTypesInConstants from "./no-types-in-constants"
import regionOrdering from "./region-ordering"
import requireRegions from "./require-regions"
import requireStorybook from "./require-storybook"
import requireUtilsConventions from "./require-utils-conventions"
import useeffect from "./useeffect"

const rules = {
    "enforce-component-structure": enforceComponentStructure,
    "enforce-constant-location": enforceConstantLocation,
    "enforce-component-import-limits": enforceComponentImportLimits,
    "enforce-helper-location": enforceHelperLocation,
    "enforce-query-hooks-structure": enforceQueryHooksStructure,
    "enforce-props-type-naming": enforcePropsTypeNaming,
    "enforce-ref-suffix": enforceRefSuffix,
    "enforce-single-component": enforceSingleComponent,
    "enforce-single-use-translation": enforceSingleUseTranslation,
    "enforce-type-location": enforceTypeLocation,
    "enforce-union-types-source-of-truth": enforceUnionTypesSourceOfTruth,
    "max-component-lines": maxComponentLines,
    "no-direct-service-calls": noDirectServiceCalls,
    "no-non-null-assertion": noNonNullAssertion,
    "no-raw-button": noRawButton,
    "no-restricted-axios-auth": noRestrictedAxiosAuth,
    "no-restricted-use-context": noRestrictedUseContext,
    "no-types-in-constants": noTypesInConstants,
    "region-ordering": regionOrdering,
    "require-utils-conventions": requireUtilsConventions,
    "require-regions": requireRegions,
    "require-storybook": requireStorybook,
    useeffect: useeffect
} satisfies Record<string, TSESLint.LooseRuleDefinition>

const customPlugin = { rules, configs: { recommended: [] }, processors: {} } satisfies Omit<
    Plugin,
    "rules" | "configs"
> & {
    rules: Record<string, TSESLint.LooseRuleDefinition>
    configs: Plugin["configs"] & {
        recommended: {
            files?: Readonly<string[]>
            ignores?: Readonly<string[]>
            rules?: Readonly<Linter.RulesRecord>
            plugins?: Readonly<ESLint.Plugin>
            extends?: Readonly<ESLint.ConfigData>
        }[]
    }
}

const ctxProviderGlobs = [
    "src/**/contexts/*/index.tsx",
    "src/**/contexts/*/hooks/use*.ts",
    "src/**/contexts/*Provider.tsx"
] as const

Object.assign(customPlugin.configs, {
    recommended: [
        { plugins: { custom: customPlugin } },
        {
            files: ["src/**/*.tsx", "src/**/hooks/**/*.ts"],
            ignores: ["src/**/hooks/queries/**", "src/**/hooks/services/**"],
            rules: {
                "custom/no-direct-service-calls": "error"
            }
        },
        {
            files: ["src/**/*.tsx", "src/**/hooks/use*.ts", "src/**/use*/index.ts"],
            ignores: ["src/**/*.stories.tsx", "src/hooks/queries/**"],
            rules: {
                "custom/enforce-props-type-naming": "error"
            }
        },
        {
            files: ["src/**/*.tsx"],
            ignores: ["src/**/*.stories.tsx"],
            rules: {
                "custom/max-component-lines": "error"
            }
        },
        {
            files: ["src/**/*.tsx"],
            ignores: ["src/**/*.stories.tsx", "src/components/ui/**", "src/routes/**"],
            rules: {
                "custom/enforce-single-component": "error"
            }
        },
        {
            files: ["src/components/**/*.tsx", "src/pages/**/*.tsx"],
            ignores: ["src/components/**/*.stories.tsx", "src/components/ui/**", "src/pages/**/*.stories.tsx"],
            rules: {
                "custom/enforce-component-import-limits": "error"
            }
        },
        {
            files: ["src/**/*.tsx", "src/**/*.ts"],
            ignores: ["src/**/utils/**/*.ts", "src/**/*.stories.tsx", "src/routes/**"],
            rules: {
                "custom/enforce-helper-location": "error"
            }
        },
        {
            files: ["src/**/*.tsx", "src/**/*.ts"],
            ignores: [
                "src/**/constants/**/*.ts",
                "src/**/@types/**",
                "src/**/*.stories.tsx",
                "src/routes/**",
                "src/hooks/queries/**",
                "src/utils/**"
            ],
            rules: {
                "custom/enforce-constant-location": "error"
            }
        },
        {
            files: ["src/**/constants/**/*.ts"],
            rules: {
                "custom/no-types-in-constants": "error"
            }
        },
        {
            files: ["src/**/utils/**/*.ts"],
            rules: {
                "custom/require-utils-conventions": "error"
            }
        },
        {
            files: ["src/**/@types/**/*.ts"],
            rules: {
                "custom/enforce-union-types-source-of-truth": "error"
            }
        },
        {
            files: ["src/**/*.tsx", "src/**/hooks/**/use*.ts", "src/**/hooks/*/index.ts"],
            ignores: ["src/**/*.stories.tsx", "src/components/ui/**", "src/routes/**"],
            rules: {
                "custom/region-ordering": "error",
                "custom/require-regions": "error",
                "custom/enforce-type-location": "error",
                "custom/useeffect": "error"
            }
        },
        {
            files: ["src/**/*.ts", "src/**/*.tsx"],
            ignores: ["src/**/*.stories.tsx", "src/**/*.stories.ts"],
            rules: {
                "custom/no-non-null-assertion": "error",
                "custom/no-restricted-axios-auth": "error"
            }
        },
        {
            files: ["src/**/*.tsx"],
            ignores: ["src/**/*.stories.tsx", "src/components/ui/**"],
            rules: {
                "custom/no-raw-button": "error"
            }
        },
        {
            files: ["src/**/*.ts", "src/**/*.tsx"],
            ignores: ["src/**/*.stories.tsx", "src/**/*.stories.ts", ...ctxProviderGlobs],
            rules: {
                "custom/no-restricted-use-context": "error"
            }
        },
        {
            files: ["src/components/**/*.tsx"],
            ignores: ["src/components/ui/**", ...ctxProviderGlobs],
            rules: {
                "custom/require-storybook": "warn"
            }
        },
        {
            files: ["src/components/**/*.ts", "src/components/**/*.tsx", "src/pages/**/*.ts", "src/pages/**/*.tsx"],
            ignores: ["src/components/ui/**"],
            rules: {
                "custom/enforce-component-structure": "error"
            }
        },
        {
            files: ["src/**/hooks/**/*.ts", "src/**/*.tsx"],
            ignores: ["src/**/*.stories.tsx", "src/**/*.stories.ts"],
            rules: {
                "custom/enforce-single-use-translation": "error"
            }
        },
        {
            files: ["src/**/*.ts", "src/**/*.tsx"],
            ignores: ["src/**/*.stories.tsx", "src/**/*.stories.ts"],
            rules: {
                "custom/enforce-query-hooks-structure": "error"
            }
        },
        {
            files: ["src/**/*.tsx", "src/**/hooks/**/use*.ts", "src/**/hooks/*/index.ts"],
            ignores: ["src/**/*.stories.tsx", "src/**/*.stories.ts"],
            rules: {
                "custom/enforce-ref-suffix": "error"
            }
        }
    ]
})

export default customPlugin
