/**
 * Core logic for the useeffect-comment-lifter Prettier plugin.
 *
 * Identifies `useEffect` calls that have plain `// line comments` immediately
 * above them and converts those comments to JSDoc (`/** ... *​/`) format so they
 * satisfy the `custom/useeffect` ESLint rule automatically on save.
 *
 * Transformation rules:
 *   - Only `//` line comments are candidates.
 *   - `// #region` and `// #endregion` markers are never converted; they act
 *     as hard boundaries when collecting comments.
 *   - `useEffect` calls with no plain comment directly above → left untouched.
 *   - `useEffect` calls already preceded by a JSDoc (`/** ... *​/`) → untouched.
 *   - A blank line between a comment and `useEffect` breaks the association.
 *
 * Single comment:  `// text`       → `/** text *​/`
 * Multiple comments:
 *   `// a`
 *   `// b`
 *   ↓
 *   `/**`
 *    ` * a`
 *    ` * b`
 *    ` *​/`
 */

/** Matches a line where `useEffect(` appears at the start (after whitespace). */
const USE_EFFECT_LINE_RE = /^\s*useEffect\s*\(/

/** Matches `// #region ...` and `// #endregion ...` markers. */
const REGION_COMMENT_RE = /^\s*\/\/\s*#(?:region|endregion)\b/

/** Matches any `// ...` line comment. */
const LINE_COMMENT_RE = /^\s*\/\//

function isUseEffectLine(line) {
    return USE_EFFECT_LINE_RE.test(line)
}

function isRegionComment(line) {
    return REGION_COMMENT_RE.test(line)
}

/** Returns true for plain `//` comments that are not region markers. */
function isPlainLineComment(line) {
    return LINE_COMMENT_RE.test(line) && !isRegionComment(line)
}

/** Strips the leading whitespace and `//` prefix (plus one optional space). */
function extractCommentText(line) {
    return line.replace(/^\s*\/\/\s?/, "").trimEnd()
}

/** Returns the leading whitespace of a line. */
function getIndent(line) {
    const match = line.match(/^(\s*)/)
    return match ? match[1] : ""
}

/**
 * Builds JSDoc lines from an array of comment-text strings.
 *
 * Single entry:  `["text"]`     → `["<indent>/** text *​/"]`
 * Multiple:      `["a", "b"]`  → `["<indent>/**", "<indent> * a", "<indent> * b", "<indent> *​/"]`
 */
function buildJsDoc(indent, commentTexts) {
    if (commentTexts.length === 1)
        return [`${indent}/** ${commentTexts[0]} */`]

    return [
        `${indent}/**`,
        ...commentTexts.map(t => `${indent} * ${t}`),
        `${indent} */`
    ]
}

/**
 * Transforms plain `//` comments immediately above `useEffect` calls into
 * JSDoc comments. Returns the modified source string.
 *
 * Never throws — returns the input unchanged on any unexpected input.
 */
export function liftUseEffectComments(text) {
    if (typeof text !== "string" || text.length === 0) return text

    const lines = text.split("\n")

    // Iterate bottom-to-top so that splicing comment lines above the current
    // position never invalidates the index of the useEffect line itself or
    // any useEffect lines further up in the file.
    for (let i = lines.length - 1; i >= 0; i--) {
        if (!isUseEffectLine(lines[i])) continue

        // Collect consecutive plain // comments that sit directly above this
        // useEffect line. Stop as soon as we hit a region marker, a
        // non-comment line, or a blank line.
        const collectedIndices = []
        let j = i - 1
        while (j >= 0) {
            const line = lines[j]
            if (isRegionComment(line)) break
            if (!isPlainLineComment(line)) break
            collectedIndices.unshift(j) // maintain top-to-bottom order
            j--
        }

        if (collectedIndices.length === 0) continue

        const indent = getIndent(lines[i])
        const commentTexts = collectedIndices.map(idx => extractCommentText(lines[idx]))
        const jsdocLines = buildJsDoc(indent, commentTexts)

        // Replace the collected comment lines with the generated JSDoc lines.
        lines.splice(collectedIndices[0], collectedIndices.length, ...jsdocLines)
    }

    return lines.join("\n")
}
