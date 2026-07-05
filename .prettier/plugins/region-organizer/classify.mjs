/**
 * Classify a top-level statement of a React component body into one of the
 * canonical regions. Classification is based on:
 *   - the *primary* hook call inside the statement (if any),
 *   - the import path that hook was imported from (for context-vs-custom).
 *
 * Returns one of:
 *   "params" | "contexts" | "services" | "customHooks" |
 *   "states" | "refs" | "memos" | "callbacks" |
 *   "elementMemos" | "elementCallbacks" | "effects" |
 *   null    (could not be classified — likely a plain const / expression)
 */

const PARAM_HOOK_NAMES = new Set([
    "useParams",
    "useNavigate",
    "useRouter",
    "useSearch",
    "useMatches",
    "useMatch",
    "useLocation",
    "useRouterState",
    "useLoaderData",
    "useSearchParams"
])

const STATE_HOOK_NAMES = new Set(["useState", "useReducer", "useTransition"])
const REF_HOOK_NAMES = new Set(["useRef", "useImperativeHandle"])
const MEMO_HOOK_NAMES = new Set(["useMemo"])
const CALLBACK_HOOK_NAMES = new Set(["useCallback", "useDebouncedCallback", "useThrottledCallback"])
const EFFECT_HOOK_NAMES = new Set([
    "useEffect",
    "useLayoutEffect",
    "useInsertionEffect",
    "useIsomorphicLayoutEffect"
])

const KNOWN_CUSTOM_HOOK_NAMES = new Set([
    "useTranslation",
    "useTrackEvent",
    "useToastDispatch",
    "useQueryClient"
])

const CONTEXT_HOOK_NAMES = new Set(["useContext"])

const SERVICE_HOOK_REGEXES = [
    /^use(Suspense)?(Infinite)?Query$/,
    /^useMutation$/,
    /^use(Private|Public)[A-Z][A-Za-z0-9]*(Query|Mutation|InfiniteQuery|Stream)$/,
    /^use[A-Z][A-Za-z0-9]*(Query|Mutation|InfiniteQuery|Stream)$/,
    /^use[A-Z][A-Za-z0-9]*Service$/
]

function isServiceHookName(name) {
    return SERVICE_HOOK_REGEXES.some(re => re.test(name))
}

/**
 * Find the *primary* CallExpression for a statement, defined as:
 *   - the first VariableDeclarator init that is a CallExpression, OR
 *   - the ExpressionStatement's expression if it's a CallExpression, OR
 *   - null if none.
 */
function findPrimaryCall(statement) {
    if (statement.type === "VariableDeclaration") {
        for (const declarator of statement.declarations) {
            if (!declarator.init) continue
            const call = unwrapCall(declarator.init)
            if (call) return call
        }
        return null
    }

    if (statement.type === "ExpressionStatement")
        return unwrapCall(statement.expression)


    return null
}

function unwrapCall(node) {
    if (!node) return null
    if (node.type === "CallExpression") return node
    if (node.type === "AwaitExpression") return unwrapCall(node.argument)
    if (node.type === "TSAsExpression" || node.type === "TSNonNullExpression") return unwrapCall(node.expression)
    return null
}

function getCalleeName(call) {
    if (!call) return null
    const callee = call.callee
    if (callee.type === "Identifier") return callee.name
    if (callee.type === "MemberExpression" && callee.property.type === "Identifier") return callee.property.name
    return null
}

/**
 * Detect whether the body of an arrow / function expression returns JSX
 * (used to distinguish `Memos` from `Element memos`, etc.).
 */
function bodyReturnsJsx(fnNode) {
    if (!fnNode) return false
    if (fnNode.type !== "ArrowFunctionExpression" && fnNode.type !== "FunctionExpression") return false

    const body = fnNode.body
    if (!body) return false

    if (body.type === "JSXElement" || body.type === "JSXFragment") return true

    if (body.type === "ConditionalExpression") return expressionLooksLikeJsx(body)
    if (body.type === "LogicalExpression") return expressionLooksLikeJsx(body)
    if (body.type === "CallExpression") return expressionLooksLikeJsx(body)
    if (body.type === "BlockStatement") return blockContainsJsxReturn(body)

    return false
}

/**
 * Recursively walk all return statements within a block, descending into
 * nested control-flow blocks (if/switch/try/loops) but NOT into nested
 * function expressions or arrow functions (their returns belong to the
 * inner function, not the outer one).
 */
function blockContainsJsxReturn(block) {
    for (const statement of block.body)
        if (statementContainsJsxReturn(statement)) return true

    return false
}

function statementContainsJsxReturn(node) {
    if (!node) return false

    if (node.type === "ReturnStatement") {
        if (!node.argument) return false
        return expressionLooksLikeJsx(node.argument)
    }

    if (node.type === "BlockStatement") return blockContainsJsxReturn(node)

    if (node.type === "IfStatement") {
        if (statementContainsJsxReturn(node.consequent)) return true
        if (node.alternate && statementContainsJsxReturn(node.alternate)) return true
        return false
    }

    if (node.type === "SwitchStatement") {
        for (const switchCase of node.cases)
            for (const stmt of switchCase.consequent)
                if (statementContainsJsxReturn(stmt)) return true

        return false
    }

    if (node.type === "TryStatement") {
        if (node.block && blockContainsJsxReturn(node.block)) return true
        if (node.handler && node.handler.body && blockContainsJsxReturn(node.handler.body)) return true
        if (node.finalizer && blockContainsJsxReturn(node.finalizer)) return true
        return false
    }

    if (
        node.type === "ForStatement" ||
        node.type === "ForInStatement" ||
        node.type === "ForOfStatement" ||
        node.type === "WhileStatement" ||
        node.type === "DoWhileStatement"
    )
        return statementContainsJsxReturn(node.body)

    return false
}

function expressionLooksLikeJsx(node) {
    if (!node) return false
    if (node.type === "JSXElement" || node.type === "JSXFragment") return true
    if (node.type === "ConditionalExpression")
        return expressionLooksLikeJsx(node.consequent) || expressionLooksLikeJsx(node.alternate)

    if (node.type === "LogicalExpression")
        return expressionLooksLikeJsx(node.left) || expressionLooksLikeJsx(node.right)

    if (node.type === "ParenthesizedExpression") return expressionLooksLikeJsx(node.expression)

    if (node.type === "CallExpression") {
        const callee = node.callee
        const isKnownRenderingCall =
            callee.type === "MemberExpression" &&
            callee.property.type === "Identifier" &&
            (callee.property.name === "map" || callee.property.name === "flatMap")
        if (isKnownRenderingCall)
            for (const arg of node.arguments)
                if (bodyReturnsJsx(arg)) return true
    }

    return false
}

/**
 * Classify a statement into a region key.
 *
 * @param {object} statement — TSESTree node
 * @param {Map<string, string>} importMap — identifier name → source string
 * @returns {string|null} region key, or null if unclassifiable
 */
export function classifyStatement(statement, importMap) {
    const primaryCall = findPrimaryCall(statement)
    const calleeName = getCalleeName(primaryCall)

    if (!calleeName) return null
    if (!calleeName.startsWith("use")) return null

    if (STATE_HOOK_NAMES.has(calleeName)) return "states"
    if (REF_HOOK_NAMES.has(calleeName)) return "refs"
    if (EFFECT_HOOK_NAMES.has(calleeName)) return "effects"

    if (MEMO_HOOK_NAMES.has(calleeName)) {
        const callback = primaryCall.arguments[0]
        return bodyReturnsJsx(callback) ? "elementMemos" : "memos"
    }

    if (CALLBACK_HOOK_NAMES.has(calleeName)) {
        const callback = primaryCall.arguments[0]
        return bodyReturnsJsx(callback) ? "elementCallbacks" : "callbacks"
    }

    if (CONTEXT_HOOK_NAMES.has(calleeName)) return "contexts"

    if (PARAM_HOOK_NAMES.has(calleeName)) return "params"

    if (isServiceHookName(calleeName)) return "services"

    // Feature-launcher hooks (e.g. `useFooEditorLauncher`) are technically backed
    // by a React context provider, but per the project's region rules they
    // belong in `Custom hooks`, not `Contexts`. Detect them by hook-name suffix
    // before falling through to the Provider/contexts path heuristics so that
    // `Launcher` hooks are not swept into the Contexts region.
    if (/Launcher$/.test(calleeName)) return "customHooks"

    const source = importMap.get(calleeName)
    if (source && source.includes("/contexts/")) return "contexts"
    if (source && /^@contexts(\/|$)/.test(source)) return "contexts"
    if (source && /Provider(\/|$)/.test(source)) return "contexts"

    if (KNOWN_CUSTOM_HOOK_NAMES.has(calleeName)) return "customHooks"

    return "customHooks"
}
