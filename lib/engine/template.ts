// {{variable}} templates. Reads values out of earlier nodes' outputs, e.g.
//   {{input.email}}  or  {{action_1.body.title}}  or  {{n2.items[0].id}}
// Never evaluates code: it only walks object paths.

const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const SINGLE_TOKEN = /^\{\{\s*([^{}]+?)\s*\}\}$/;
const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);

export function getPath(root: unknown, path: string): unknown {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").map((p) => p.trim()).filter(Boolean);
    let cur: any = root;
    for (const part of parts) {
        if (BLOCKED.has(part)) return undefined;
        if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
        cur = cur[part];
    }
    return cur;
}

function stringify(value: unknown): string {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/** Look a path up in the run's variables: node ids first, then the trigger input as a fallback. */
export function lookup(vars: Record<string, unknown>, path: string): unknown {
    const v = getPath(vars, path);
    if (v !== undefined) return v;
    // `payload.x` and bare `x` are friendly aliases for the trigger input
    if (path.startsWith("payload.")) return getPath(vars.input, path.slice("payload.".length));
    if (path === "payload") return vars.input;
    return getPath(vars.input, path);
}

/**
 * Resolve templates in a string. If the string is exactly one token, the raw value comes back
 * (so numbers and objects keep their type); otherwise tokens are spliced in as text.
 */
export function resolveString(input: string, vars: Record<string, unknown>, warnings?: string[]): unknown {
    const single = input.match(SINGLE_TOKEN);
    if (single) {
        const v = lookup(vars, single[1]);
        if (v === undefined) warnings?.push(`{{${single[1]}}} had no value`);
        return v;
    }
    return input.replace(TOKEN, (_, path: string) => {
        const v = lookup(vars, path);
        if (v === undefined) warnings?.push(`{{${path}}} had no value`);
        return stringify(v);
    });
}

/** Resolve templates anywhere inside strings, arrays and plain objects. */
export function resolveDeep<T = unknown>(value: T, vars: Record<string, unknown>, warnings?: string[]): T {
    if (typeof value === "string") return resolveString(value, vars, warnings) as T;
    if (Array.isArray(value)) return value.map((v) => resolveDeep(v, vars, warnings)) as T;
    if (value && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = resolveDeep(v, vars, warnings);
        return out as T;
    }
    return value;
}
