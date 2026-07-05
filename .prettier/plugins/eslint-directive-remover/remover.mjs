/**
 * Remove all ESLint directive comments from source text.
 *
 * Handles both inline and block forms:
 *   - `// eslint-disable-next-line [rules]`
 *   - `/* eslint-disable [rules] *​/`
 *   - `/* eslint-enable [rules] *​/`
 *   - `// eslint-disable-line [rules]`
 *
 * Block comments on their own line are removed along with any trailing
 * newline. Inline block comments (e.g. a `/* eslint-disable *​/` sitting
 * between tokens on the same line) are removed in-place — the surrounding
 * code is left intact.
 *
 * When a line comment (`// eslint-…`) is the *only* content on a line
 * (ignoring leading whitespace), the entire line — including any trailing
 * newline — is deleted. When it appears after code on the same line,
 * only the comment (and any preceding whitespace gap) is removed so the
 * code itself stays put.
 */

/**
 * Block-comment directives on their own line (with optional leading
 * whitespace). The whole line including its trailing newline is removed.
 */
const BLOCK_OWN_LINE_RE = /^[ \t]*\/\*\s*eslint-(?:disable|enable)(?:-next-line|-line)?(?:\s[^*]*?)?\s*\*\/[ \t]*\r?\n?/gm

/**
 * Block-comment directives sitting *inline* among other tokens (not on
 * their own line). Only the comment itself (and any preceding whitespace
 * gap) is removed; the rest of the line is preserved.
 */
const BLOCK_INLINE_RE = /\s*\/\*\s*eslint-(?:disable|enable)(?:-next-line|-line)?(?:\s[^*]*?)?\s*\*\//g

/**
 * Line-comment directives (`// eslint-disable-next-line …`,
 * `// eslint-disable-line …`).
 *
 * Matched in two passes:
 *   1. Own-line: the comment is the only thing on the line → delete the
 *      entire line.
 *   2. Trailing: the comment follows code on the same line → delete only
 *      the comment (and whitespace gap before it).
 */
const LINE_OWN_LINE_RE = /^[ \t]*\/\/\s*eslint-(?:disable|enable)(?:-next-line|-line)?(?:[ \t][^\n]*)?\r?\n?/gm
const LINE_TRAILING_RE = /[ \t]*\/\/\s*eslint-(?:disable|enable)(?:-next-line|-line)?(?:[ \t][^\n]*)?$/gm

/**
 * Entry point used by the Prettier plugin (and by the unit tests).
 *
 * Returns a new string with every ESLint directive comment removed.
 * Never throws — returns the input unchanged on any unexpected error.
 */
export function removeEslintDirectives(text) {
    if (typeof text !== "string" || text.length === 0) return text

    let result = text

    result = result.replace(BLOCK_OWN_LINE_RE, "")
    result = result.replace(BLOCK_INLINE_RE, "")
    result = result.replace(LINE_OWN_LINE_RE, "")
    result = result.replace(LINE_TRAILING_RE, "")

    return result
}
