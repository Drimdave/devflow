// Request validation shared by the workflow routes. Plain functions, no framework imports.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LIMITS = {
    name: 120,
    description: 500,
    nodes: 200,
    edges: 1000,
    graphChars: 1_000_000,   // nodes + edges, serialized
    bodyChars: 1_200_000,
    workflowsPerUser: 200,
};

export type WorkflowInput = { name?: string; description?: string; nodes?: unknown[]; edges?: unknown[]; is_active?: boolean; base_version?: number };
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; status: 400 | 413 };

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Parse a JSON request body without throwing, with a size cap. */
export async function readJson(req: Request, maxChars = LIMITS.bodyChars): Promise<Parsed<Record<string, unknown>>> {
    const text = await req.text();
    if (text.length > maxChars) return { ok: false, status: 413, error: "That request is too large" };
    try {
        const v = JSON.parse(text);
        return isObject(v) ? { ok: true, value: v } : { ok: false, status: 400, error: "Expected a JSON object" };
    } catch {
        return { ok: false, status: 400, error: "Invalid JSON" };
    }
}

/** Check and normalise a workflow payload. Unknown fields are dropped; absent fields stay absent. */
export function parseWorkflowInput(body: Record<string, unknown>): Parsed<WorkflowInput> {
    const out: WorkflowInput = {};

    if (body.name !== undefined) {
        if (typeof body.name !== "string") return { ok: false, status: 400, error: "name must be text" };
        const name = body.name.trim();
        if (name.length > LIMITS.name) return { ok: false, status: 400, error: `name can be at most ${LIMITS.name} characters` };
        if (name) out.name = name;
    }
    if (body.description !== undefined) {
        if (typeof body.description !== "string") return { ok: false, status: 400, error: "description must be text" };
        if (body.description.length > LIMITS.description) return { ok: false, status: 400, error: `description can be at most ${LIMITS.description} characters` };
        out.description = body.description;
    }
    if (body.is_active !== undefined) {
        if (typeof body.is_active !== "boolean") return { ok: false, status: 400, error: "is_active must be true or false" };
        out.is_active = body.is_active;
    }
    if (body.base_version !== undefined && body.base_version !== null) {
        if (typeof body.base_version !== "number" || !Number.isInteger(body.base_version) || body.base_version < 0) return { ok: false, status: 400, error: "base_version must be a whole number" };
        out.base_version = body.base_version;
    }
    if (body.nodes !== undefined) {
        if (!Array.isArray(body.nodes)) return { ok: false, status: 400, error: "nodes must be a list" };
        if (body.nodes.length > LIMITS.nodes) return { ok: false, status: 400, error: `A workflow can have at most ${LIMITS.nodes} nodes` };
        if (!body.nodes.every((n) => isObject(n) && (typeof n.id === "string" || typeof n.id === "number"))) return { ok: false, status: 400, error: "Every node needs an id" };
        out.nodes = body.nodes;
    }
    if (body.edges !== undefined) {
        if (!Array.isArray(body.edges)) return { ok: false, status: 400, error: "edges must be a list" };
        if (body.edges.length > LIMITS.edges) return { ok: false, status: 400, error: `A workflow can have at most ${LIMITS.edges} connections` };
        if (!body.edges.every((e) => isObject(e) && e.source !== undefined && e.target !== undefined)) return { ok: false, status: 400, error: "Every connection needs a source and a target" };
        out.edges = body.edges;
    }
    if (out.nodes || out.edges) {
        const size = JSON.stringify(out.nodes ?? []).length + JSON.stringify(out.edges ?? []).length;
        if (size > LIMITS.graphChars) return { ok: false, status: 413, error: "This workflow is too large to save" };
    }
    return { ok: true, value: out };
}
