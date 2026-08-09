/**
 * Recursive record whose leaf values are of type `T`.
 * Used for nested translation catalogs and similar tree-shaped JSON.
 */
export type INestedRecord<T> = {
    [key: string]: T | INestedRecord<T>
}
