/**
 * Canonical region order. Mirrors `.eslint/rules/region-ordering.ts`.
 *
 * `customHooks` may appear twice in the timeline:
 *   - slot 1 (after Services, before States) for hooks that depend only on
 *     contexts/services/params, e.g. `useTranslation`, `useNavigate`.
 *   - slot 2 (after Callbacks, before Element memos) for hooks that depend on
 *     states/refs/memos/callbacks declared in the same component.
 */

export const REGION_LABELS = {
    params: "Params",
    contexts: "Contexts",
    services: "Services",
    customHooks: "Custom hooks",
    states: "States",
    refs: "Refs",
    memos: "Memos",
    callbacks: "Callbacks",
    customHooks2: "Custom hooks",
    elementMemos: "Element memos",
    elementCallbacks: "Element callbacks",
    effects: "Effects"
}

export const REGION_ORDER = [
    "params",
    "contexts",
    "services",
    "customHooks",
    "states",
    "refs",
    "memos",
    "callbacks",
    "customHooks2",
    "elementMemos",
    "elementCallbacks",
    "effects"
]

export function regionIndex(key) {
    return REGION_ORDER.indexOf(key)
}
