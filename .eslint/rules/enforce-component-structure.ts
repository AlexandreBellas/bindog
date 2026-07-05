import type { TSESLint } from "@typescript-eslint/utils"
import { existsSync } from "node:fs"
import { join, sep } from "node:path"

type IMessageIds = "invalidFolder"

/**
 * Normalises a filesystem path to use forward slashes so comparisons
 * work consistently on every OS.
 */
function normalize(filename: string): string {
    return filename.replace(/\\/g, "/")
}

/**
 * Allowed subfolder names within a component structure root.
 *
 * Any subdirectory of a component root that is not in this set is invalid.
 */
const ALLOWED_SUBFOLDERS = new Set([
    "utils",
    "components",
    "hooks",
    "contexts",
    "constants",
    "@types",
    "docs",
    "stores"
])

/**
 * Top-level "anchor" directories that introduce a component-structure scope.
 * Only directories directly under these (and their recursive children following
 * `components/`, `hooks/`, or `contexts/`) are treated as component roots.
 */
const ANCHOR_CONTAINERS = new Set(["components", "pages"])

/**
 * Allowed subfolders that themselves act as containers for nested component
 * structure roots.  Their immediate children are treated as new roots.
 */
const RECURSIVE_CONTAINERS = new Set(["components", "hooks", "contexts"])

/**
 * Returns true when the given directory path is a component structure root —
 * i.e., it contains an `index.tsx` or `index.ts` file.
 *
 * No result caching is performed intentionally: a module-level cache would
 * become stale in long-lived ESLint processes (IDE integrations, eslint_d)
 * when `index.ts(x)` files are added or removed while the process stays alive,
 * leading to incorrect lint results. Correctness is preferred over performance.
 */
function isComponentRoot(dirPath: string): boolean {
    return existsSync(join(dirPath, "index.tsx")) || existsSync(join(dirPath, "index.ts"))
}

/**
 * Returns the index within `parts` where the "src" segment appears, or -1.
 */
function findSrcIndex(parts: string[]): number {
    return parts.lastIndexOf("src")
}

/**
 * Validates that a file at `normalizedPath` lives in a valid subfolder within
 * its nearest component structure ancestor.
 *
 * Algorithm:
 *   1. Locate the `src/components/` or `src/pages/` anchor in the path.
 *   2. From that anchor, the next segment is a "component root candidate".
 *   3. Walk forward through the path.  Whenever we enter a component root
 *      (a directory containing `index.tsx` or `index.ts`), the *next* directory
 *      segment must be in {@link ALLOWED_SUBFOLDERS}.
 *   4. Whenever we enter a `components/`, `hooks/`, or `contexts/` subfolder,
 *      the *next* segment begins a new component root.
 *
 * @param normalizedPath  - The file path with forward-slash separators
 * @param checkRoot       - Returns true when the given native OS dir is a root
 * @returns The name of the first invalid folder found, or null if all valid.
 */
function getInvalidFolderInPath(
    normalizedPath: string,
    checkRoot: (nativeDir: string) => boolean
): string | null {
    const parts = normalizedPath.split("/")
    const srcIdx = findSrcIndex(parts)
    if (srcIdx === -1) return null

    // We look for `src/components/` or `src/pages/` in the path.
    // The segment right after these containers is the first "component root".
    let anchorIdx = -1
    for (let i = srcIdx + 1; i < parts.length - 1; i++) 
        if (ANCHOR_CONTAINERS.has(parts[i])) {
            anchorIdx = i
            break
        }
    

    if (anchorIdx === -1) return null

    // Start validation from the component root candidate (segment after anchor).
    let cursor = anchorIdx + 1 // index of the component root name
    const lastIdx = parts.length - 1 // index of the file name

    while (cursor <= lastIdx) {
        // `parts[cursor]` is potentially a component root directory name.
        // Build its native OS path and check if it's actually a root.
        const rootDir = parts.slice(0, cursor + 1).join("/").replace(/\//g, sep)

        if (cursor === lastIdx) 
            // We've reached the file itself — nothing left to validate.
            break
        

        if (!checkRoot(rootDir)) {
            // This directory is not a component root; advance.
            cursor++
            continue
        }

        // `parts[cursor]` IS a component root.
        // Its direct child (cursor+1) must be in ALLOWED_SUBFOLDERS.
        const childSegment = parts[cursor + 1]
        if (!childSegment) break // no child — file is directly in root, valid

        const isFile = cursor + 1 === lastIdx
        if (isFile) break // file directly in root — valid

        if (!ALLOWED_SUBFOLDERS.has(childSegment)) 
            return childSegment
        

        // childSegment is valid. If it's a recursive container, the next segment
        // starts a new component root — cursor advances by 2 (skip the container name).
        // Otherwise (leaf folder like utils/, constants/, etc.) — no further
        // component roots to validate within it.
        if (RECURSIVE_CONTAINERS.has(childSegment)) 
            cursor = cursor + 2 // skip root + allowed container, land on next root
         else 
            break // leaf folder — all remaining segments are valid inside it
        
    }

    return null
}

const rule: TSESLint.RuleModule<IMessageIds> = {
    meta: {
        type: "problem",
        docs: {
            description:
                "enforce that files within component structures live only in allowed subfolders " +
                "(utils, components, hooks, contexts, constants, @types, docs, stores)"
        },
        messages: {
            invalidFolder:
                'File is inside an invalid folder "{{ folder }}". ' +
                "Within a component structure, only these subfolders are allowed: " +
                "utils/, components/, hooks/, contexts/, constants/, @types/, docs/, stores/. " +
                "Move the file to the correct location."
        },
        schema: []
    },
    defaultOptions: [],
    create(context) {
        const normalized = normalize(context.filename)
        const invalidFolder = getInvalidFolderInPath(normalized, isComponentRoot)

        if (!invalidFolder) return {}

        return {
            Program(node) {
                context.report({
                    node,
                    messageId: "invalidFolder",
                    data: { folder: invalidFolder }
                })
            }
        }
    }
}

export default rule
export { getInvalidFolderInPath, ALLOWED_SUBFOLDERS }
