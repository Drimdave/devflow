import { lookup, resolveString } from "./template";

// A small, safe condition evaluator for If/Else and Filter nodes. No eval, no code execution.
// It understands comparisons, combined with && (and), || (or), ! (not) and ( ) grouping:
//   {{input.amount}} > 500        amount > 500        status == "paid"
//   labels contains bug           email endsWith @acme.com
//   amount > 500 && status == paid        !{{input.archived}}        (a > 1 || b > 1) && c == x
// Anything it can't make sense of throws a ConditionError, because silently answering "yes" would route data wrongly.

export class ConditionError extends Error {}

const OPERATORS = ["!=", "==", ">=", "<=", ">", "<", "=", "!contains", "contains", "startsWith", "endsWith"] as const;
type Operator = (typeof OPERATORS)[number];

// Symbol operators first (longest first so ">=" isn't read as ">"), then word operators.
const OP_PATTERN = /^(.+?)\s*(!=|==|>=|<=|>|<|=)\s*(.+)$|^(.+?)\s+(!contains|contains|startsWith|endsWith)\s+(.+)$/i;

function toOperand(token: string, vars: Record<string, unknown>): unknown {
    const t = token.trim();
    if (!t) return undefined;
    // {{template}} → real value
    if (t.includes("{{")) return resolveString(t, vars);
    // quoted → string literal
    const quoted = t.match(/^(['"])(.*)\1$/);
    if (quoted) return quoted[2];
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    if (/^true$/i.test(t)) return true;
    if (/^false$/i.test(t)) return false;
    if (/^null$/i.test(t)) return null;
    // bare word: a variable if it resolves, otherwise a plain string ("urgent", "bug")
    const v = lookup(vars, t.replace(/^\$/, ""));
    return v !== undefined ? v : t;
}

const num = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    return null;
};

const str = (v: unknown) => (v === undefined || v === null ? "" : typeof v === "string" ? v : JSON.stringify(v)).toLowerCase();

function compare(left: unknown, op: Operator, right: unknown): boolean {
    // "missing" and null are the same thing to a person: x == null is true when x isn't there
    if ((op === "==" || op === "=" || op === "!=") && (right === null || left === null)) {
        const bothNull = (left === null || left === undefined) && (right === null || right === undefined);
        return op === "!=" ? !bothNull : bothNull;
    }
    if (left === undefined && op !== "!=" && op !== "!contains") return false; // missing data never satisfies a condition
    switch (op) {
        case "==":
        case "=": {
            const a = num(left), b = num(right);
            return a !== null && b !== null ? a === b : str(left) === str(right);
        }
        case "!=": {
            const a = num(left), b = num(right);
            return a !== null && b !== null ? a !== b : str(left) !== str(right);
        }
        case ">": case "<": case ">=": case "<=": {
            const a = num(left), b = num(right);
            if (a === null || b === null) return false;
            return op === ">" ? a > b : op === "<" ? a < b : op === ">=" ? a >= b : a <= b;
        }
        case "contains":
        case "!contains": {
            const has = Array.isArray(left)
                ? left.some((item) => str(item) === str(right) || str(item).includes(str(right)))
                : str(left).includes(str(right));
            return op === "contains" ? has : !has;
        }
        case "startsWith": return str(left).startsWith(str(right));
        case "endsWith": return str(left).endsWith(str(right));
    }
}

/** Split on a top-level separator, ignoring anything inside quotes, {{ }} templates or parentheses. */
function splitTop(expr: string, sep: "&&" | "||"): string[] {
    const parts: string[] = [];
    let depth = 0, brace = 0, quote: string | null = null, last = 0;
    for (let i = 0; i < expr.length; i++) {
        const c = expr[i];
        if (quote) { if (c === quote) quote = null; continue; }
        if (c === "'" || c === '"') { quote = c; continue; }
        if (c === "{" && expr[i + 1] === "{") { brace++; i++; continue; }
        if (c === "}" && expr[i + 1] === "}") { brace = Math.max(0, brace - 1); i++; continue; }
        if (brace) continue;
        if (c === "(") depth++;
        else if (c === ")") depth--;
        else if (depth === 0 && expr.startsWith(sep, i)) { parts.push(expr.slice(last, i)); last = i + 2; i++; }
    }
    parts.push(expr.slice(last));
    return parts;
}

/** Quotes, {{ }} and ( ) must all be closed. */
function assertBalanced(expr: string) {
    let depth = 0, brace = 0, quote: string | null = null;
    for (let i = 0; i < expr.length; i++) {
        const c = expr[i];
        if (quote) { if (c === quote) quote = null; continue; }
        if (c === "'" || c === '"') { quote = c; continue; }
        if (c === "{" && expr[i + 1] === "{") { brace++; i++; continue; }
        if (c === "}" && expr[i + 1] === "}") { brace--; i++; continue; }
        if (brace > 0) continue;
        if (c === "(") depth++;
        else if (c === ")") { depth--; if (depth < 0) throw new ConditionError(`Unmatched ")" in "${expr}"`); }
    }
    if (quote) throw new ConditionError(`Unclosed quote in "${expr}"`);
    if (brace !== 0) throw new ConditionError(`Unclosed {{ }} in "${expr}"`);
    if (depth !== 0) throw new ConditionError(`Unclosed "(" in "${expr}"`);
}

/** True when the whole string is wrapped in one matching pair of parentheses. */
function wrappedInParens(expr: string): boolean {
    if (!expr.startsWith("(") || !expr.endsWith(")")) return false;
    let depth = 0, brace = 0, quote: string | null = null;
    for (let i = 0; i < expr.length; i++) {
        const c = expr[i];
        if (quote) { if (c === quote) quote = null; continue; }
        if (c === "'" || c === '"') { quote = c; continue; }
        if (c === "{" && expr[i + 1] === "{") { brace++; i++; continue; }
        if (c === "}" && expr[i + 1] === "}") { brace--; i++; continue; }
        if (brace > 0) continue;
        if (c === "(") depth++;
        else if (c === ")") { depth--; if (depth === 0 && i < expr.length - 1) return false; }
    }
    return depth === 0;
}

const SINGLE_TEMPLATE = /^\{\{[^{}]*\}\}$/;
const IDENTIFIER = /^[A-Za-z_$][\w$.\[\]-]*$/;

function evalExpr(raw: string, vars: Record<string, unknown>): boolean {
    const expr = raw.trim();
    if (!expr) throw new ConditionError("The condition is empty");
    if (wrappedInParens(expr)) return evalExpr(expr.slice(1, -1), vars);

    const ors = splitTop(expr, "||");
    if (ors.length > 1) return ors.some((p) => evalExpr(p, vars));
    const ands = splitTop(expr, "&&");
    if (ands.length > 1) return ands.every((p) => evalExpr(p, vars));

    if (expr.startsWith("!") && !expr.startsWith("!=")) return !evalExpr(expr.slice(1), vars);

    const m = expr.match(OP_PATTERN);
    if (m) {
        const leftText = (m[1] ?? m[4] ?? "").trim();
        const rightText = (m[3] ?? m[6] ?? "").trim();
        if (!leftText || !rightText) throw new ConditionError(`"${expr}" is missing a value on one side of the comparison`);
        const left = toOperand(leftText, vars);
        const op = (m[2] ?? m[5]) as Operator;
        const right = toOperand(rightText, vars);
        return compare(left, (OPERATORS.find((o) => o.toLowerCase() === op.toLowerCase()) ?? "==") as Operator, right);
    }

    // No operator: only a single value is allowed (a field, a {{template}} or a literal), tested for truthiness
    if (SINGLE_TEMPLATE.test(expr)) return truthy(toOperand(expr, vars));
    if (/^(true|false|null)$/i.test(expr) || /^-?\d+(\.\d+)?$/.test(expr) || /^(['"]).*\1$/.test(expr)) return truthy(toOperand(expr, vars));
    if (IDENTIFIER.test(expr)) {
        const v = lookup(vars, expr.replace(/^\$/, ""));
        return v === undefined ? false : truthy(v); // a field that isn't there is simply "no"
    }
    throw new ConditionError(`Couldn't understand "${expr}". Use a comparison like {{input.amount}} > 500, and combine them with && , || or !`);
}

function truthy(v: unknown): boolean {
    if (typeof v === "string") return v.trim() !== "" && !/^(false|0|null|undefined|no)$/i.test(v.trim());
    return Boolean(v);
}

export function evaluateCondition(expression: unknown, vars: Record<string, unknown>): boolean {
    if (typeof expression === "boolean") return expression;
    if (typeof expression === "number") return expression !== 0;
    if (typeof expression !== "string" || !expression.trim()) return false;
    assertBalanced(expression);
    return evalExpr(expression, vars);
}
