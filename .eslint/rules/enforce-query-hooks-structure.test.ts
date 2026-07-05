import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./enforce-query-hooks-structure"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIVATE_FILE = "src/hooks/queries/private/usePrivateInsightsQuery.ts"
const PUBLIC_FILE = "src/hooks/queries/public/usePublicInterviewsQuery.ts"
const COMPONENT_FILE = "src/components/MyComponent/index.tsx"
const HOOK_FILE = "src/hooks/useMyHook.ts"
const PAGE_FILE = "src/pages/MyPage/index.tsx"

/** Minimal valid private file with one Query hook. */
const VALID_PRIVATE_QUERY = [
    "export const privateInsightsQueryKeys = {",
    '    all: () => ["private", "insights"] as const',
    "}",
    "export function usePrivateInsightsQuery() {",
    "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
    "}"
].join("\n")

/** Minimal valid public file with one Query hook. */
const VALID_PUBLIC_QUERY = [
    "export const publicInterviewsQueryKeys = {",
    '    all: () => ["public", "interviews"] as const',
    "}",
    "export function usePublicInterviewsQuery() {",
    "    return useQuery({ queryKey: publicInterviewsQueryKeys.all(), queryFn: () => null })",
    "}"
].join("\n")

// ---------------------------------------------------------------------------
// Suite 1: useQuery / useMutation outside src/hooks/queries/
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (useQuery and useMutation outside queries)", rule, {
    valid: [
        {
            name: "useQuery inside src/hooks/queries/private/ — no useQuery restriction error",
            code: VALID_PRIVATE_QUERY,
            filename: PRIVATE_FILE
        },
        {
            name: "useQuery inside src/hooks/queries/public/ — no useQuery restriction error",
            code: VALID_PUBLIC_QUERY,
            filename: PUBLIC_FILE
        },
        {
            name: "useMutation inside src/hooks/queries/private/ — no useMutation restriction error",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsCreateMutation() {",
                "    return useMutation({ mutationFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        },
        {
            name: "useMutation inside src/hooks/queries/public/ — no useMutation restriction error",
            code: [
                "export const publicInterviewsQueryKeys = {",
                '    all: () => ["public", "interviews"] as const',
                "}",
                "export function usePublicInterviewsCreateMutation() {",
                "    return useMutation({ mutationFn: () => null })",
                "}"
            ].join("\n"),
            filename: PUBLIC_FILE
        },
        {
            name: "useQuery in a test file — allowed",
            code: "const result = useQuery({ queryKey: [], queryFn: () => null })",
            filename: "src/hooks/queries/private/usePrivateInsightsQuery.test.ts"
        },
        {
            name: "useMutation in a spec file — allowed",
            code: "const mutation = useMutation({ mutationFn: () => null })",
            filename: "src/components/Foo.spec.tsx"
        },
        {
            name: "useQueryClient outside queries folder — allowed (not restricted)",
            code: "const queryClient = useQueryClient()",
            filename: COMPONENT_FILE
        },
        {
            name: "useInfiniteQuery outside queries folder — allowed (not restricted by this rule)",
            code: "const result = useInfiniteQuery({ queryKey: [], queryFn: () => null })",
            filename: COMPONENT_FILE
        },
        {
            name: "unrelated hook outside queries folder — allowed",
            code: "const data = useSomeHook()",
            filename: COMPONENT_FILE
        }
    ],
    invalid: [
        {
            name: "useQuery in a component — forbidden",
            code: "const result = useQuery({ queryKey: [], queryFn: () => null })",
            filename: COMPONENT_FILE,
            errors: [{ messageId: "useQueryOutsideQueriesFolder" }]
        },
        {
            name: "useMutation in a component — forbidden",
            code: "const mutation = useMutation({ mutationFn: () => null })",
            filename: COMPONENT_FILE,
            errors: [{ messageId: "useMutationOutsideQueriesFolder" }]
        },
        {
            name: "useQuery in a non-query hook file — forbidden",
            code: "const result = useQuery({ queryKey: [], queryFn: () => null })",
            filename: HOOK_FILE,
            errors: [{ messageId: "useQueryOutsideQueriesFolder" }]
        },
        {
            name: "useMutation in a non-query hook file — forbidden",
            code: "const mutation = useMutation({ mutationFn: () => null })",
            filename: HOOK_FILE,
            errors: [{ messageId: "useMutationOutsideQueriesFolder" }]
        },
        {
            name: "useQuery in a page component — forbidden",
            code: "const result = useQuery({ queryKey: [], queryFn: () => null })",
            filename: PAGE_FILE,
            errors: [{ messageId: "useQueryOutsideQueriesFolder" }]
        },
        {
            name: "multiple restricted calls in one file — each is reported",
            code: [
                "const r = useQuery({ queryKey: [], queryFn: () => null })",
                "const m = useMutation({ mutationFn: () => null })"
            ].join("\n"),
            filename: COMPONENT_FILE,
            errors: [{ messageId: "useQueryOutsideQueriesFolder" }, { messageId: "useMutationOutsideQueriesFolder" }]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 2: File placement — must be in private/ or public/
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (file placement)", rule, {
    valid: [
        {
            name: "file in private/ subfolder — valid placement",
            code: VALID_PRIVATE_QUERY,
            filename: PRIVATE_FILE
        },
        {
            name: "file in public/ subfolder — valid placement",
            code: VALID_PUBLIC_QUERY,
            filename: PUBLIC_FILE
        },
        {
            name: "@shared/queries.ts — valid placement",
            code: "export interface IUseQueryOptions { enabled?: boolean }",
            filename: "src/hooks/queries/@shared/queries.ts"
        },
        {
            name: "@shared/mutations.ts — valid placement",
            code: "export interface IUseMutationOptions { retry?: number }",
            filename: "src/hooks/queries/@shared/mutations.ts"
        }
    ],
    invalid: [
        {
            name: "file directly in src/hooks/queries/ root — forbidden",
            code: "export const x = 1",
            filename: "src/hooks/queries/useAdminQuery.ts",
            errors: [{ messageId: "fileNotInPrivateOrPublic" }]
        },
        {
            name: "file in src/hooks/queries/@shared/ with non-allowed name — invalidSharedFile",
            code: "export const x = 1",
            filename: "src/hooks/queries/@shared/usePrefetchAdjacentPages.ts",
            errors: [{ messageId: "invalidSharedFile" }]
        },
        {
            name: "file in src/hooks/queries/@shared/ with arbitrary name — invalidSharedFile",
            code: "export const x = 1",
            filename: "src/hooks/queries/@shared/helpers.ts",
            errors: [{ messageId: "invalidSharedFile" }]
        },
        {
            name: "file in src/hooks/queries/utils/ subfolder — forbidden",
            code: "export const x = 1",
            filename: "src/hooks/queries/utils/helpers.ts",
            errors: [{ messageId: "fileNotInPrivateOrPublic" }]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 3: File naming conventions
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (file naming)", rule, {
    valid: [
        {
            name: "usePrivate*Query.ts in private/ — valid",
            code: VALID_PRIVATE_QUERY,
            filename: "src/hooks/queries/private/usePrivateInsightsQuery.ts"
        },
        {
            name: "usePublic*Query.ts in public/ — valid",
            code: VALID_PUBLIC_QUERY,
            filename: "src/hooks/queries/public/usePublicInterviewsQuery.ts"
        },
        {
            name: "folder-based hook with inline keys — valid name",
            code: [
                "export const privateCrosstabsQueryKeys = {",
                '    all: () => ["private", "crosstabs"] as const',
                "}",
                "export function usePrivateCrosstabsQuery() {",
                "    return useQuery({ queryKey: privateCrosstabsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateCrosstabsQuery/index.ts"
        },
        {
            name: "folder-based hook with re-exported keys — valid name",
            code: [
                "export { privateCrosstabsQueryKeys }",
                "export function usePrivateCrosstabsQuery() {",
                "    return useQuery({ queryKey: privateCrosstabsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateCrosstabsQuery/index.ts"
        },
        {
            name: "folder-based hook with re-export from source — valid name",
            code: [
                "export { privateCrosstabsQueryKeys } from './constants/privateCrosstabsQueryKeys'",
                "export function usePrivateCrosstabsQuery() {",
                "    return useQuery({ queryKey: privateCrosstabsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateCrosstabsQuery/index.ts"
        },
        {
            name: "supporting file in hook folder @types/ — completely skipped",
            code: "export interface IUsePrivateCrosstabsQueryOptions { enabled?: boolean }",
            filename: "src/hooks/queries/private/usePrivateCrosstabsQuery/@types/usePrivateCrosstabsQuery.ts"
        },
        {
            name: "supporting file in hook folder with non-keys name — completely skipped",
            code: "export const SOME_CONSTANT = 42",
            filename: "src/hooks/queries/private/usePrivateCrosstabsQuery/constants/helpers.ts"
        },
        {
            name: "usePrivate*FetchQuery.ts — matches usePrivate*Query pattern (FetchQuery ends with Query)",
            code: [
                "export const privateInsightsFetchQueryKeys = {",
                '    all: () => ["private", "insightsFetch"] as const',
                "}",
                "export function usePrivateInsightsFetchQuery() {",
                "    const fetchQuery = () => queryClient.fetchQuery({ queryKey: [] })",
                "    return { fetchQuery }",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInsightsFetchQuery.ts"
        }
    ],
    invalid: [
        {
            name: "file in private/ without usePrivate prefix — invalid name",
            code: "export const x = 1",
            filename: "src/hooks/queries/private/useInsightsQuery.ts",
            errors: [{ messageId: "invalidFileName" }]
        },
        {
            name: "file in private/ without Query suffix — invalid name",
            code: "export const x = 1",
            filename: "src/hooks/queries/private/usePrivateInsights.ts",
            errors: [{ messageId: "invalidFileName" }]
        },
        {
            name: "file in public/ without usePublic prefix — invalid name",
            code: "export const x = 1",
            filename: "src/hooks/queries/public/useInterviewsQuery.ts",
            errors: [{ messageId: "invalidFileName" }]
        },
        {
            name: "file in public/ without Query suffix — invalid name",
            code: "export const x = 1",
            filename: "src/hooks/queries/public/usePublicInterviews.ts",
            errors: [{ messageId: "invalidFileName" }]
        },
        {
            name: "file in private/ not starting with use — invalid name",
            code: "export const x = 1",
            filename: "src/hooks/queries/private/privateInsightsQuery.ts",
            errors: [{ messageId: "invalidFileName" }]
        },
        {
            name: "file in public/ not starting with use — invalid name",
            code: "export const x = 1",
            filename: "src/hooks/queries/public/publicInterviewsQuery.ts",
            errors: [{ messageId: "invalidFileName" }]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 4: Keys constant — presence
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (keys constant presence)", rule, {
    valid: [
        {
            name: "exported const with correct name and all property — valid",
            code: VALID_PRIVATE_QUERY,
            filename: PRIVATE_FILE
        },
        {
            name: "public query file with correct keys const — valid",
            code: VALID_PUBLIC_QUERY,
            filename: PUBLIC_FILE
        }
    ],
    invalid: [
        {
            name: "non-exported const with correct name — queryKeysConstantNotExported",
            code: [
                "const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "queryKeysConstantNotExported", data: { name: "privateInsightsQueryKeys" } }]
        },
        {
            name: "file has no keys constant at all — missingQueryKeysConstant",
            code: [
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: [], queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "missingQueryKeysConstant" }]
        },
        {
            name: "file has keys constant with wrong name (wrong entity) — missingQueryKeysConstant",
            code: [
                "export const privateWrongQueryKeys = {",
                '    all: () => ["private", "wrong"] as const',
                "}",
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: [], queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "missingQueryKeysConstant" }]
        },
        {
            name: "file has non-object keys constant — missingQueryKeysConstant (init is string, not object)",
            code: [
                'export const privateInsightsQueryKeys = "oops"',
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: [], queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "missingQueryKeysConstant" }]
        },
        {
            name: "public file missing public keys constant — missingQueryKeysConstant",
            code: [
                "export function usePublicInterviewsQuery() {",
                "    return useQuery({ queryKey: [], queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PUBLIC_FILE,
            errors: [{ messageId: "missingQueryKeysConstant" }]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 5: Keys constant — all property
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (keys constant all property)", rule, {
    valid: [
        {
            name: "keys constant has all property — valid",
            code: VALID_PRIVATE_QUERY,
            filename: PRIVATE_FILE
        },
        {
            name: "keys constant with all and extra properties — valid",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const,',
                "    list: (projectId: string) => [...privateInsightsQueryKeys.all(), projectId] as const",
                "}",
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        }
    ],
    invalid: [
        {
            name: "keys constant missing all property — queryKeysMissingAllProperty",
            code: [
                "export const privateInsightsQueryKeys = {",
                "    list: (projectId: string) => privateInsightsQueryKeys",
                "}",
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.list('p'), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "queryKeysMissingAllProperty" }]
        },
        {
            name: "public keys constant missing all property — queryKeysMissingAllProperty",
            code: [
                "export const publicInterviewsQueryKeys = {",
                "    detail: (id: string) => [id]",
                "}",
                "export function usePublicInterviewsQuery() {",
                "    return useQuery({ queryKey: publicInterviewsQueryKeys.detail('id'), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PUBLIC_FILE,
            errors: [{ messageId: "queryKeysMissingAllProperty" }]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 6: Top-level function validation (only hooks allowed)
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (only hooks at top level)", rule, {
    valid: [
        {
            name: "top-level hook ending with Query — valid",
            code: VALID_PRIVATE_QUERY,
            filename: PRIVATE_FILE
        },
        {
            name: "top-level hook ending with Mutation — valid",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsCreateMutation() {",
                "    return useMutation({ mutationFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        },
        {
            name: "top-level hook ending with Stream — valid",
            code: [
                "export const privateSessionsQueryKeys = {",
                '    all: () => ["private", "sessions"] as const',
                "}",
                "export function usePrivateSessionStream() {",
                "    const stream = useCallback(() => sessionsService.stream(), [sessionsService])",
                "    return { stream }",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateSessionsQuery.ts"
        },
        {
            name: "multiple hooks in one file — all valid",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}",
                "export function usePrivateInsightsCreateMutation() {",
                "    return useMutation({ mutationFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        },
        {
            name: "interface and type declarations alongside hooks — valid (non-function, ignored)",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "interface IOptions { enabled?: boolean }",
                "export function usePrivateInsightsQuery(options: IOptions = {}) {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        },
        {
            name: "nested helper inside a hook body — valid (not top-level)",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsQuery() {",
                "    function helperInsideHook() { return 1 }",
                "    return useQuery({ queryKey: [helperInsideHook()], queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        }
    ],
    invalid: [
        {
            name: "non-hook top-level function (no use prefix) — invalidTopLevelFunction",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "function calculateSomething() { return 42 }",
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "invalidTopLevelFunction", data: { name: "calculateSomething" } }]
        },
        {
            name: "function starting with use but wrong suffix — invalidTopLevelFunction",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function useHelperFunction() { return 1 }",
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "invalidTopLevelFunction", data: { name: "useHelperFunction" } }]
        },
        {
            name: "exported non-hook function — invalidTopLevelFunction",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function buildQueryOptions() { return {} }",
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "invalidTopLevelFunction", data: { name: "buildQueryOptions" } }]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 7: Hook content — *Query must call useQuery
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (hook content — Query)", rule, {
    valid: [
        {
            name: "hook ending with Query returns useQuery directly — valid",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        },
        {
            name: "hook ending with Query assigns useQuery result then returns — valid",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsQuery() {",
                "    const query = useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "    return { ...query, extra: true }",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        }
    ],
    invalid: [
        {
            name: "hook ending with Query has empty body — hookMissingUseQueryCall",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsQuery() {",
                "    return null",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "hookMissingUseQueryCall", data: { name: "usePrivateInsightsQuery" } }]
        },
        {
            name: "hook ending with Query calls useMutation — hookMissingUseQueryCall + forbiddenUseMutationInQueryHook",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsQuery() {",
                "    return useMutation({ mutationFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [
                { messageId: "hookMissingUseQueryCall", data: { name: "usePrivateInsightsQuery" } },
                { messageId: "forbiddenUseMutationInQueryHook", data: { name: "usePrivateInsightsQuery" } }
            ]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 8: Hook content — *Mutation must call useMutation
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (hook content — Mutation)", rule, {
    valid: [
        {
            name: "hook ending with Mutation returns useMutation — valid",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsCreateMutation() {",
                "    return useMutation({ mutationFn: (payload) => service.create(payload) })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        }
    ],
    invalid: [
        {
            name: "hook ending with Mutation has no useMutation call — hookMissingUseMutationCall",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsCreateMutation() {",
                "    return null",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "hookMissingUseMutationCall", data: { name: "usePrivateInsightsCreateMutation" } }]
        },
        {
            name: "hook ending with Mutation calls useQuery — hookMissingUseMutationCall + forbiddenUseQueryInMutationHook",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsCreateMutation() {",
                "    return useQuery({ queryKey: [], queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [
                { messageId: "hookMissingUseMutationCall", data: { name: "usePrivateInsightsCreateMutation" } },
                { messageId: "forbiddenUseQueryInMutationHook", data: { name: "usePrivateInsightsCreateMutation" } }
            ]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 9: Hook content — *InfiniteQuery must call useInfiniteQuery
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (hook content — InfiniteQuery)", rule, {
    valid: [
        {
            name: "hook ending with InfiniteQuery returns useInfiniteQuery — valid",
            code: [
                "export const privateInterviewsQueryKeys = {",
                '    all: () => ["private", "interviews"] as const',
                "}",
                "export function usePrivateInterviewsInfiniteQuery() {",
                "    return useInfiniteQuery({",
                "        queryKey: privateInterviewsQueryKeys.all(),",
                "        queryFn: ({ pageParam }) => service.list({ page: pageParam }),",
                "        initialPageParam: 0,",
                "        getNextPageParam: (last) => last.nextPage",
                "    })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInterviewsQuery.ts"
        }
    ],
    invalid: [
        {
            name: "hook ending with InfiniteQuery has no useInfiniteQuery call — hookMissingUseInfiniteQueryCall",
            code: [
                "export const privateInterviewsQueryKeys = {",
                '    all: () => ["private", "interviews"] as const',
                "}",
                "export function usePrivateInterviewsInfiniteQuery() {",
                "    return useQuery({ queryKey: [], queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInterviewsQuery.ts",
            errors: [
                {
                    messageId: "hookMissingUseInfiniteQueryCall",
                    data: { name: "usePrivateInterviewsInfiniteQuery" }
                }
            ]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 10: Hook content — *FetchQuery must return { fetchQuery }
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (hook content — FetchQuery)", rule, {
    valid: [
        {
            name: "hook ending with FetchQuery returns { fetchQuery } — valid",
            code: [
                "export const privateInsightsFetchQueryKeys = {",
                '    all: () => ["private", "insightsFetch"] as const',
                "}",
                "export function usePrivateInsightsFetchQuery() {",
                "    const fetchQuery = () => queryClient.fetchQuery({ queryKey: [] })",
                "    return { fetchQuery }",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInsightsFetchQuery.ts"
        },
        {
            name: "hook returning object with fetchQuery and other keys — valid",
            code: [
                "export const privateInsightsFetchQueryKeys = {",
                '    all: () => ["private", "insightsFetch"] as const',
                "}",
                "export function usePrivateInsightsFetchQuery() {",
                "    const fetchQuery = () => queryClient.fetchQuery({ queryKey: [] })",
                "    return { fetchQuery, extraUtil: true }",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInsightsFetchQuery.ts"
        },
        {
            name: "hook returning object with fetchQuery as named shorthand — valid",
            code: [
                "export const privateInsightsFetchQueryKeys = {",
                '    all: () => ["private", "insightsFetch"] as const',
                "}",
                "export function usePrivateInsightsFetchQuery() {",
                "    const fetchQuery = useCallback(",
                "        () => queryClient.fetchQuery({ queryKey: [] }),",
                "        [queryClient]",
                "    )",
                "    return { fetchQuery }",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInsightsFetchQuery.ts"
        }
    ],
    invalid: [
        {
            name: "hook ending with FetchQuery returns nothing — hookMissingFetchQueryReturn",
            code: [
                "export const privateInsightsFetchQueryKeys = {",
                '    all: () => ["private", "insightsFetch"] as const',
                "}",
                "export function usePrivateInsightsFetchQuery() {",
                "    queryClient.fetchQuery({ queryKey: [] })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInsightsFetchQuery.ts",
            errors: [{ messageId: "hookMissingFetchQueryReturn", data: { name: "usePrivateInsightsFetchQuery" } }]
        },
        {
            name: "hook ending with FetchQuery returns non-object — hookMissingFetchQueryReturn",
            code: [
                "export const privateInsightsFetchQueryKeys = {",
                '    all: () => ["private", "insightsFetch"] as const',
                "}",
                "export function usePrivateInsightsFetchQuery() {",
                "    return queryClient.fetchQuery({ queryKey: [] })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInsightsFetchQuery.ts",
            errors: [{ messageId: "hookMissingFetchQueryReturn", data: { name: "usePrivateInsightsFetchQuery" } }]
        },
        {
            name: "hook ending with FetchQuery returns object without fetchQuery key — hookMissingFetchQueryReturn",
            code: [
                "export const privateInsightsFetchQueryKeys = {",
                '    all: () => ["private", "insightsFetch"] as const',
                "}",
                "export function usePrivateInsightsFetchQuery() {",
                "    return { wrongKey: () => null }",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInsightsFetchQuery.ts",
            errors: [{ messageId: "hookMissingFetchQueryReturn", data: { name: "usePrivateInsightsFetchQuery" } }]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 11: Hook content — *PrefetchAdjacentPages must call usePrefetchAdjacentPages
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (hook content — PrefetchAdjacentPages)", rule, {
    valid: [
        {
            name: "hook ending with PrefetchAdjacentPages calls usePrefetchAdjacentPages — valid",
            code: [
                "export const privateInterviewsQueryKeys = {",
                '    all: () => ["private", "interviews"] as const',
                "}",
                "export function usePrivateInterviewsPrefetchAdjacentPages({ request, nPages, enabled }) {",
                "    usePrefetchAdjacentPages({ request, nPages, enabled, getQueryKey, queryFn })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInterviewsQuery.ts"
        }
    ],
    invalid: [
        {
            name: "hook ending with PrefetchAdjacentPages never calls usePrefetchAdjacentPages — error",
            code: [
                "export const privateInterviewsQueryKeys = {",
                '    all: () => ["private", "interviews"] as const',
                "}",
                "export function usePrivateInterviewsPrefetchAdjacentPages({ request, nPages, enabled }) {",
                "    useEffect(() => { prefetchSomething() }, [enabled])",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInterviewsQuery.ts",
            errors: [
                {
                    messageId: "hookMissingUsePrefetchAdjacentPagesCall",
                    data: { name: "usePrivateInterviewsPrefetchAdjacentPages" }
                }
            ]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 12: Hook content — *Stream (SSE stream factory hooks)
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (hook content — Stream)", rule, {
    valid: [
        {
            name: "hook ending with Stream returns stream callback — valid",
            code: [
                "export const privateSessionsQueryKeys = {",
                '    all: () => ["private", "sessions"] as const',
                "}",
                "export function usePrivateSessionStream() {",
                "    const stream = useCallback(() => sessionsService.stream(), [sessionsService])",
                "    return { stream }",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateSessionsQuery.ts"
        }
    ],
    invalid: []
})

// ---------------------------------------------------------------------------
// Suite 13: Combined valid file — mirrors real-world query files
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (combined real-world-like file)", rule, {
    valid: [
        {
            name: "file resembling usePrivateInsightsQuery.ts — fully valid",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const,',
                "    project: (projectId) => [...privateInsightsQueryKeys.all(), projectId] as const,",
                "    list: (projectId) => [...privateInsightsQueryKeys.project(projectId), 'list'] as const",
                "}",
                "export function usePrivateInsightsQuery(request = {}, options = {}) {",
                "    return useQuery({",
                "        queryKey: privateInsightsQueryKeys.list(request.projectId ?? ''),",
                "        queryFn: () => service.list(request),",
                "        enabled: !!request.projectId",
                "    })",
                "}",
                "export function usePrivateInsightsCreateMutation() {",
                "    return useMutation({",
                "        mutationFn: (payload) => service.create(payload)",
                "    })",
                "}",
                "export function usePrivateInsightsDeleteMutation() {",
                "    return useMutation({",
                "        mutationFn: (payload) => service.delete(payload)",
                "    })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        },
        {
            name: "file resembling usePublicInterviewsQuery.ts — fully valid",
            code: [
                "export const publicInterviewsQueryKeys = {",
                '    all: () => ["public", "interviews"] as const,',
                "    detail: (id) => [...publicInterviewsQueryKeys.all(), id] as const",
                "}",
                "export function usePublicInterviewsQuery(request = {}) {",
                "    return useQuery({",
                "        queryKey: publicInterviewsQueryKeys.all(),",
                "        queryFn: () => service.list(request)",
                "    })",
                "}",
                "export function usePublicInterviewsCreateMutation() {",
                "    return useMutation({",
                "        mutationFn: (payload) => service.create(payload)",
                "    })",
                "}"
            ].join("\n"),
            filename: PUBLIC_FILE
        },
        {
            name: "file with FetchQuery, PrefetchAdjacentPages, InfiniteQuery hooks — all valid",
            code: [
                "export const privateInterviewsQueryKeys = {",
                '    all: () => ["private", "interviews"] as const',
                "}",
                "export function usePrivateInterviewsFetchQuery() {",
                "    const fetchQuery = () => queryClient.fetchQuery({ queryKey: [] })",
                "    return { fetchQuery }",
                "}",
                "export function usePrivateInterviewsPrefetchAdjacentPages({ request, nPages, enabled }) {",
                "    usePrefetchAdjacentPages({ request, nPages, enabled, getQueryKey, queryFn })",
                "}",
                "export function usePrivateInterviewsInfiniteQuery() {",
                "    return useInfiniteQuery({",
                "        queryKey: privateInterviewsQueryKeys.all(),",
                "        queryFn: ({ pageParam }) => service.list({ page: pageParam }),",
                "        initialPageParam: 0,",
                "        getNextPageParam: () => undefined",
                "    })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInterviewsQuery.ts"
        }
    ],
    invalid: []
})

// ---------------------------------------------------------------------------
// Suite 14: Folder-based hook — keys file validation
// ---------------------------------------------------------------------------

const KEYS_FILE = "src/hooks/queries/private/usePrivateCrosstabsQuery/constants/privateCrosstabsQueryKeys.ts"

ruleTester.run("enforce-query-hooks-structure (folder keys file)", rule, {
    valid: [
        {
            name: "keys file with exported constant and all property — valid",
            code: [
                "export const privateCrosstabsQueryKeys = {",
                '    all: () => ["private", "crosstabs"] as const,',
                "    project: (id) => [...privateCrosstabsQueryKeys.all(), id] as const",
                "}"
            ].join("\n"),
            filename: KEYS_FILE
        }
    ],
    invalid: [
        {
            name: "keys file missing constant entirely — missingQueryKeysConstant",
            code: "export const OTHER = 42",
            filename: KEYS_FILE,
            errors: [
                {
                    messageId: "missingQueryKeysConstant",
                    data: { expectedName: "privateCrosstabsQueryKeys", folder: "private" }
                }
            ]
        },
        {
            name: "keys file with non-exported constant — queryKeysConstantNotExported",
            code: ["const privateCrosstabsQueryKeys = {", '    all: () => ["private", "crosstabs"] as const', "}"].join(
                "\n"
            ),
            filename: KEYS_FILE,
            errors: [{ messageId: "queryKeysConstantNotExported", data: { name: "privateCrosstabsQueryKeys" } }]
        },
        {
            name: "keys file missing all property — queryKeysMissingAllProperty",
            code: [
                "export const privateCrosstabsQueryKeys = {",
                '    project: (id) => ["private", "crosstabs", id] as const',
                "}"
            ].join("\n"),
            filename: KEYS_FILE,
            errors: [
                {
                    messageId: "queryKeysMissingAllProperty",
                    data: { name: "privateCrosstabsQueryKeys", folder: "private", entity: "crosstabs" }
                }
            ]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 15: Arrow-function hooks (export const useX = () => { ... })
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (arrow-function hooks)", rule, {
    valid: [
        // --- valid arrow-function Query hook (block body) ---
        {
            name: "arrow-function Query hook with block body calling useQuery — valid",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export const usePrivateInsightsQuery = () => {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        },
        // --- valid arrow-function Query hook (concise body) ---
        {
            name: "arrow-function Query hook with concise body — valid",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export const usePrivateInsightsQuery = () =>",
                "    useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })"
            ].join("\n"),
            filename: PRIVATE_FILE
        },
        // --- valid arrow-function Mutation hook ---
        {
            name: "arrow-function Mutation hook calling useMutation — valid",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export const usePrivateInsightsCreateMutation = () => {",
                "    return useMutation({ mutationFn: (payload) => service.create(payload) })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        },
        // --- valid arrow-function InfiniteQuery hook ---
        {
            name: "arrow-function InfiniteQuery hook calling useInfiniteQuery — valid",
            code: [
                "export const privateInterviewsQueryKeys = {",
                '    all: () => ["private", "interviews"] as const',
                "}",
                "export const usePrivateInterviewsInfiniteQuery = () => {",
                "    return useInfiniteQuery({",
                "        queryKey: privateInterviewsQueryKeys.all(),",
                "        queryFn: ({ pageParam }) => service.list({ page: pageParam }),",
                "        initialPageParam: 0,",
                "        getNextPageParam: (last) => last.nextPage",
                "    })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInterviewsQuery.ts"
        },
        // --- valid arrow-function FetchQuery hook (block body) ---
        {
            name: "arrow-function FetchQuery hook returning { fetchQuery } block body — valid",
            code: [
                "export const privateInsightsFetchQueryKeys = {",
                '    all: () => ["private", "insightsFetch"] as const',
                "}",
                "export const usePrivateInsightsFetchQuery = () => {",
                "    const fetchQuery = () => queryClient.fetchQuery({ queryKey: [] })",
                "    return { fetchQuery }",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInsightsFetchQuery.ts"
        },
        // --- valid arrow-function FetchQuery hook (concise body) ---
        {
            name: "arrow-function FetchQuery hook with concise object body — valid",
            code: [
                "export const privateInsightsFetchQueryKeys = {",
                '    all: () => ["private", "insightsFetch"] as const',
                "}",
                "export const usePrivateInsightsFetchQuery = () => ({ fetchQuery: () => null })"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInsightsFetchQuery.ts"
        },
        // --- valid arrow-function PrefetchAdjacentPages hook ---
        {
            name: "arrow-function PrefetchAdjacentPages hook calling usePrefetchAdjacentPages — valid",
            code: [
                "export const privateInterviewsQueryKeys = {",
                '    all: () => ["private", "interviews"] as const',
                "}",
                "export const usePrivateInterviewsPrefetchAdjacentPages = ({ request, nPages, enabled }) => {",
                "    usePrefetchAdjacentPages({ request, nPages, enabled, getQueryKey, queryFn })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInterviewsQuery.ts"
        },
        // --- valid function expression hook (var fn = function() {}) ---
        {
            name: "const function-expression Query hook — valid",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export const usePrivateInsightsQuery = function() {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE
        }
    ],
    invalid: [
        // --- Suite 6 equivalent: non-hook arrow function at top level ---
        {
            name: "non-hook top-level arrow function (no use prefix) — invalidTopLevelFunction",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export const buildQueryOptions = () => ({})",
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "invalidTopLevelFunction", data: { name: "buildQueryOptions" } }]
        },
        {
            name: "arrow function with use prefix but invalid suffix — invalidTopLevelFunction",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export const useHelperUtil = () => null",
                "export function usePrivateInsightsQuery() {",
                "    return useQuery({ queryKey: privateInsightsQueryKeys.all(), queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "invalidTopLevelFunction", data: { name: "useHelperUtil" } }]
        },
        // --- Suite 7 equivalent: *Query arrow hook without useQuery ---
        {
            name: "arrow-function Query hook missing useQuery call — hookMissingUseQueryCall",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export const usePrivateInsightsQuery = () => ({ data: null })"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "hookMissingUseQueryCall", data: { name: "usePrivateInsightsQuery" } }]
        },
        {
            name: "arrow-function Query hook block body returning null — hookMissingUseQueryCall",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export const usePrivateInsightsQuery = () => {",
                "    return null",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "hookMissingUseQueryCall", data: { name: "usePrivateInsightsQuery" } }]
        },
        {
            name: "arrow-function Query hook calling useMutation — hookMissingUseQueryCall + forbiddenUseMutationInQueryHook",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export const usePrivateInsightsQuery = () => {",
                "    return useMutation({ mutationFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [
                { messageId: "hookMissingUseQueryCall", data: { name: "usePrivateInsightsQuery" } },
                { messageId: "forbiddenUseMutationInQueryHook", data: { name: "usePrivateInsightsQuery" } }
            ]
        },
        // --- Suite 8 equivalent: *Mutation arrow hook without useMutation ---
        {
            name: "arrow-function Mutation hook missing useMutation call — hookMissingUseMutationCall",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export const usePrivateInsightsCreateMutation = () => {",
                "    return null",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "hookMissingUseMutationCall", data: { name: "usePrivateInsightsCreateMutation" } }]
        },
        {
            name: "arrow-function Mutation hook calling useQuery — hookMissingUseMutationCall + forbiddenUseQueryInMutationHook",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export const usePrivateInsightsCreateMutation = () => {",
                "    return useQuery({ queryKey: [], queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [
                { messageId: "hookMissingUseMutationCall", data: { name: "usePrivateInsightsCreateMutation" } },
                { messageId: "forbiddenUseQueryInMutationHook", data: { name: "usePrivateInsightsCreateMutation" } }
            ]
        },
        // --- Suite 9 equivalent: *InfiniteQuery arrow hook without useInfiniteQuery ---
        {
            name: "arrow-function InfiniteQuery hook missing useInfiniteQuery call — hookMissingUseInfiniteQueryCall",
            code: [
                "export const privateInterviewsQueryKeys = {",
                '    all: () => ["private", "interviews"] as const',
                "}",
                "export const usePrivateInterviewsInfiniteQuery = () => {",
                "    return useQuery({ queryKey: [], queryFn: () => null })",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInterviewsQuery.ts",
            errors: [
                {
                    messageId: "hookMissingUseInfiniteQueryCall",
                    data: { name: "usePrivateInterviewsInfiniteQuery" }
                }
            ]
        },
        // --- Suite 10 equivalent: *FetchQuery arrow hook without { fetchQuery } return ---
        {
            name: "arrow-function FetchQuery hook with concise body not returning { fetchQuery } — hookMissingFetchQueryReturn",
            code: [
                "export const privateInsightsFetchQueryKeys = {",
                '    all: () => ["private", "insightsFetch"] as const',
                "}",
                "export const usePrivateInsightsFetchQuery = () => queryClient.fetchQuery({ queryKey: [] })"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInsightsFetchQuery.ts",
            errors: [{ messageId: "hookMissingFetchQueryReturn", data: { name: "usePrivateInsightsFetchQuery" } }]
        },
        {
            name: "arrow-function FetchQuery hook with block body returning non-object — hookMissingFetchQueryReturn",
            code: [
                "export const privateInsightsFetchQueryKeys = {",
                '    all: () => ["private", "insightsFetch"] as const',
                "}",
                "export const usePrivateInsightsFetchQuery = () => {",
                "    return { wrongKey: () => null }",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInsightsFetchQuery.ts",
            errors: [{ messageId: "hookMissingFetchQueryReturn", data: { name: "usePrivateInsightsFetchQuery" } }]
        },
        // --- Suite 11 equivalent: *PrefetchAdjacentPages arrow hook without call ---
        {
            name: "arrow-function PrefetchAdjacentPages hook missing usePrefetchAdjacentPages call — error",
            code: [
                "export const privateInterviewsQueryKeys = {",
                '    all: () => ["private", "interviews"] as const',
                "}",
                "export const usePrivateInterviewsPrefetchAdjacentPages = ({ request, nPages, enabled }) => {",
                "    useEffect(() => { prefetchSomething() }, [enabled])",
                "}"
            ].join("\n"),
            filename: "src/hooks/queries/private/usePrivateInterviewsQuery.ts",
            errors: [
                {
                    messageId: "hookMissingUsePrefetchAdjacentPagesCall",
                    data: { name: "usePrivateInterviewsPrefetchAdjacentPages" }
                }
            ]
        }
    ]
})

// ---------------------------------------------------------------------------
// Suite 16: Edge cases
// ---------------------------------------------------------------------------

ruleTester.run("enforce-query-hooks-structure (edge cases)", rule, {
    valid: [
        {
            name: "useQueryClient inside a queries file — useQueryClient is not restricted",
            code: VALID_PRIVATE_QUERY,
            filename: PRIVATE_FILE
        }
    ],
    invalid: [
        {
            name: "useQuery inside @shared/ folder — invalidSharedFile (only queries.ts and mutations.ts allowed)",
            code: "export function useSomething() { return useQuery({ queryKey: [], queryFn: () => null }) }",
            filename: "src/hooks/queries/@shared/useSomethingQuery.ts",
            errors: [{ messageId: "invalidSharedFile" }]
        },
        {
            name: "empty file in private/ with valid name — missingQueryKeysConstant",
            code: "// empty file",
            filename: PRIVATE_FILE,
            errors: [{ messageId: "missingQueryKeysConstant" }]
        },
        {
            name: "useQuery and useMutation both used outside queries folder",
            code: [
                "const r = useQuery({ queryKey: [], queryFn: () => null })",
                "const m = useMutation({ mutationFn: () => null })"
            ].join("\n"),
            filename: "src/hooks/useCustomHook.ts",
            errors: [{ messageId: "useQueryOutsideQueriesFolder" }, { messageId: "useMutationOutsideQueriesFolder" }]
        },
        {
            name: "hook inside queries/private/ with valid name but missing useQuery call",
            code: [
                "export const privateInsightsQueryKeys = {",
                '    all: () => ["private", "insights"] as const',
                "}",
                "export function usePrivateInsightsQuery() {",
                "    return { data: null }",
                "}"
            ].join("\n"),
            filename: PRIVATE_FILE,
            errors: [{ messageId: "hookMissingUseQueryCall", data: { name: "usePrivateInsightsQuery" } }]
        }
    ]
})
