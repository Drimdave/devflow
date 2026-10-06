// Shared by the engine and the canvas: what a Switch node's outputs are.

export const SWITCH_DEFAULT = "default";
const MAX_CASES = 8;

/** "urgent, normal ; low" -> ["urgent", "normal", "low"] (trimmed, de-duplicated, capped). */
export function parseCases(raw: unknown): string[] {
    const list = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,;\n]/);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of list) {
        const c = String(item ?? "").trim();
        const k = c.toLowerCase();
        if (!c || k === SWITCH_DEFAULT || seen.has(k)) continue;
        seen.add(k);
        out.push(c);
        if (out.length >= MAX_CASES) break;
    }
    return out;
}

/** A logic node is a Switch when it's named like one or has a list of cases. */
export function isSwitchNode(label: string, config: Record<string, any> | undefined): boolean {
    const c = config ?? {};
    return /\bswitch\b/i.test(label) || c.cases !== undefined || c.parameters?.cases !== undefined;
}

export function switchCases(config: Record<string, any> | undefined): string[] {
    const c = config ?? {};
    return parseCases(c.cases ?? c.parameters?.cases);
}

const YES_NO = new Set(["true", "false", "yes", "no"]);

/**
 * Branch names a logic node's outgoing edges use that aren't just Yes/No, e.g. ["urgent", "normal"].
 * AI output and older workflows describe a multi-way branch this way, so the canvas can turn it into a Switch.
 */
export function namedBranches(edges: { source: string; sourceHandle?: string | null; label?: string | null }[], nodeId: string): string[] {
    const names: string[] = [];
    for (const e of edges) {
        if (e.source !== nodeId) continue;
        const h = String(e.sourceHandle ?? e.label ?? "").trim();
        if (!h || YES_NO.has(h.toLowerCase()) || h.toLowerCase() === SWITCH_DEFAULT) continue;
        if (!names.some((n) => n.toLowerCase() === h.toLowerCase())) names.push(h);
    }
    return names;
}

/** AI nodes arrive as { provider, resource, operation, parameters: {...} }; the editor works with flat fields. */
export function flattenConfig(raw: Record<string, any> | undefined): Record<string, any> {
    const c = raw ?? {};
    if (!c.parameters || typeof c.parameters !== "object" || Array.isArray(c.parameters)) return { ...c };
    const { parameters, resource, operation, ...rest } = c;
    return { ...rest, ...(resource ? { resource } : {}), ...(operation ? { operation } : {}), ...parameters };
}
