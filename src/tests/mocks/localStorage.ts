/**
 * Ensure Storage APIs exist for unit tests.
 * Node 25+ experimental Web Storage leaves `localStorage` undefined without `--localstorage-file`,
 * which breaks jsdom tests and Paraglide's `localStorage` strategy.
 */
export function ensureLocalStorage() {
    const store = new Map<string, string>()

    const storage: Storage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, String(value))
        },
        removeItem: (key: string) => {
            store.delete(key)
        },
        clear: () => {
            store.clear()
        },
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
            return store.size
        }
    }

    const needsPolyfill = (value: unknown): value is undefined | null =>
        value == null || typeof (value as Storage).getItem !== "function"

    if (typeof globalThis !== "undefined" && needsPolyfill(globalThis.localStorage)) {
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            writable: true,
            value: storage
        })
    }

    if (typeof window !== "undefined" && needsPolyfill(window.localStorage)) {
        Object.defineProperty(window, "localStorage", {
            configurable: true,
            writable: true,
            value: storage
        })
    }
}
