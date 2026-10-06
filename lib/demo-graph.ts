// Pure helpers for the public landing-page demo. No server or DOM dependencies, so the
// API route (sanitize) and the client (layout, run plan) share one definition of a graph.

export type DemoKind = "trigger" | "action" | "logic" | "data";

export interface DemoNode {
    id: string;
    type: DemoKind;
    label: string;
    description: string;
    provider?: string;
}

export interface DemoEdge {
    source: string;
    target: string;
    label?: "true" | "false";
}

export interface DemoGraph {
    title: string;
    nodes: DemoNode[];
    edges: DemoEdge[];
}

const KINDS: DemoKind[] = ["trigger", "action", "logic", "data"];
export const MAX_DEMO_NODES = 7;

function clip(value: unknown, max: number): string {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Turn whatever the model returned into a small, safe, renderable graph (or null). */
export function sanitizeDemoGraph(raw: any, fallbackTitle: string): DemoGraph | null {
    if (!raw || !Array.isArray(raw.nodes)) return null;
    const title = clip(raw.name ?? raw.title, 32) || fallbackTitle;

    const seen = new Set<string>();
    const nodes: DemoNode[] = [];
    for (const n of raw.nodes) {
        if (nodes.length >= MAX_DEMO_NODES) break;
        const id = clip(n?.id, 40);
        const label = clip(n?.label, 36);
        if (!id || !label || seen.has(id)) continue;
        seen.add(id);
        nodes.push({
            id,
            type: KINDS.includes(n?.type) ? n.type : "action",
            label,
            description: clip(n?.description, 60),
            provider: clip(n?.data?.provider ?? n?.provider, 24).toLowerCase() || undefined,
        });
    }
    if (nodes.length < 2) return null;

    const edges: DemoEdge[] = [];
    const edgeKeys = new Set<string>();
    for (const e of Array.isArray(raw.edges) ? raw.edges : []) {
        const source = clip(e?.source, 40);
        const target = clip(e?.target, 40);
        const key = `${source}>${target}`;
        if (!seen.has(source) || !seen.has(target) || source === target || edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        const l = clip(e?.label, 8).toLowerCase();
        edges.push({ source, target, label: l === "true" || l === "yes" ? "true" : l === "false" || l === "no" ? "false" : undefined });
        if (edges.length >= 12) break;
    }

    // No usable edges: chain the nodes in order so the demo still reads as a flow
    if (edges.length === 0) {
        for (let i = 0; i < nodes.length - 1; i++) edges.push({ source: nodes[i].id, target: nodes[i + 1].id });
    }

    return { title, nodes, edges };
}

// ── Layout ──────────────────────────────────────────────────────────────

export const NODE_W = 210;
export const NODE_H = 62;

export type Direction = "LR" | "TB";

export interface LaidOutNode extends DemoNode {
    x: number;
    y: number;
}

export interface Layout {
    direction: Direction;
    nodes: LaidOutNode[];
    width: number;
    height: number;
}

function depths(graph: DemoGraph): Map<string, number> {
    const depth = new Map(graph.nodes.map((n) => [n.id, 0]));
    // Longest-path relaxation, bounded so a cyclic graph can't loop forever
    for (let pass = 0; pass < graph.nodes.length; pass++) {
        let changed = false;
        for (const e of graph.edges) {
            const next = (depth.get(e.source) ?? 0) + 1;
            if (next > (depth.get(e.target) ?? 0) && next < graph.nodes.length) {
                depth.set(e.target, next);
                changed = true;
            }
        }
        if (!changed) break;
    }
    return depth;
}

export function layoutGraph(graph: DemoGraph, direction: Direction): Layout {
    const depth = depths(graph);
    const layers: DemoNode[][] = [];
    for (const n of graph.nodes) {
        const d = depth.get(n.id) ?? 0;
        (layers[d] ||= []).push(n);
    }

    const gapMain = direction === "LR" ? 64 : 40; // between layers
    const gapCross = direction === "LR" ? 26 : 28; // within a layer
    const mainSize = direction === "LR" ? NODE_W : NODE_H;
    const crossSize = direction === "LR" ? NODE_H : NODE_W;

    const crossExtent = (count: number) => count * crossSize + (count - 1) * gapCross;
    const maxCross = Math.max(...layers.filter(Boolean).map((l) => crossExtent(l.length)));

    const nodes: LaidOutNode[] = [];
    layers.forEach((layer, d) => {
        if (!layer) return;
        const offset = (maxCross - crossExtent(layer.length)) / 2;
        layer.forEach((n, i) => {
            const main = d * (mainSize + gapMain);
            const cross = offset + i * (crossSize + gapCross);
            nodes.push(direction === "LR" ? { ...n, x: main, y: cross } : { ...n, x: cross, y: main });
        });
    });

    const mainExtent = layers.length * mainSize + (layers.length - 1) * gapMain;
    return {
        direction,
        nodes,
        width: direction === "LR" ? mainExtent : maxCross,
        height: direction === "LR" ? maxCross : mainExtent,
    };
}

/**
 * Pick whichever direction lets the graph render larger in the given box.
 * Left-to-right reads as more "canvas-like", so it wins unless top-to-bottom is clearly bigger.
 */
export function bestLayout(graph: DemoGraph, boxW: number, boxH: number) {
    const fit = (direction: Direction) => {
        const layout = layoutGraph(graph, direction);
        return { layout, scale: Math.min(1, boxW / layout.width, boxH / layout.height) };
    };
    const lr = fit("LR");
    const tb = fit("TB");
    return tb.scale > lr.scale * 1.15 ? tb : lr;
}

// ── Run plan ────────────────────────────────────────────────────────────

/** Order nodes would execute in. Logic nodes only follow their "true" (or unlabeled) edges. */
export function runPlan(graph: DemoGraph): string[] {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const hasIncoming = new Set(graph.edges.map((e) => e.target));
    const roots = graph.nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);
    const queue = roots.length ? roots : [graph.nodes[0].id];
    const order: string[] = [];
    const visited = new Set<string>();

    while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        order.push(id);
        const isLogic = byId.get(id)?.type === "logic";
        for (const e of graph.edges) {
            if (e.source !== id) continue;
            if (isLogic && e.label === "false") continue;
            queue.push(e.target);
        }
    }
    return order;
}

// ── Thumbnails ──────────────────────────────────────────────────────────

/** Curve between two laid-out nodes, plus where its midpoint is. */
export function edgeGeometry(layout: Layout, sourceId: string, targetId: string, fromX?: number) {
    const a = layout.nodes.find((n) => n.id === sourceId);
    const b = layout.nodes.find((n) => n.id === targetId);
    if (!a || !b) return null;
    const lr = layout.direction === "LR";
    const x1 = lr ? a.x + NODE_W : a.x + NODE_W * (fromX ?? 0.5);
    const y1 = lr ? a.y + NODE_H / 2 : a.y + NODE_H;
    const x2 = lr ? b.x : b.x + NODE_W / 2;
    const y2 = lr ? b.y + NODE_H / 2 : b.y;
    const d = lr
        ? `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`;
    return { d, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
}

/**
 * Turn a saved workflow (React Flow format from the DB, or the flat format the AI returns)
 * into a graph the thumbnail can lay out. Tolerant: anything unusable is skipped.
 */
export function graphFromSaved(rawNodes: unknown, rawEdges: unknown): DemoGraph | null {
    if (!Array.isArray(rawNodes) || rawNodes.length === 0) return null;
    const nodes: DemoNode[] = [];
    const ids = new Set<string>();
    for (const n of rawNodes.slice(0, 12)) {
        const id = typeof n?.id === "string" ? n.id : "";
        if (!id || ids.has(id)) continue;
        ids.add(id);
        const rawType = n?.data?.type ?? n?.type;
        nodes.push({
            id,
            type: KINDS.includes(rawType) ? rawType : "action",
            label: clip(n?.data?.label ?? n?.label, 36) || "Node",
            description: "",
        });
    }
    const edges: DemoEdge[] = [];
    for (const e of Array.isArray(rawEdges) ? rawEdges : []) {
        if (ids.has(e?.source) && ids.has(e?.target) && e.source !== e.target) edges.push({ source: e.source, target: e.target });
    }
    return { title: "", nodes, edges };
}

// ── Editor positions ────────────────────────────────────────────────────

/**
 * Top-to-bottom positions for the real editor (cards are ~260px wide, ~100px tall):
 * one layer per row, each row centered, branches fanned out sideways.
 */
export function editorPositions(graph: DemoGraph, stepX = 330, stepY = 170): Map<string, { x: number; y: number }> {
    const depth = depths(graph);
    const layers: DemoNode[][] = [];
    for (const n of graph.nodes) (layers[depth.get(n.id) ?? 0] ||= []).push(n);
    const widest = Math.max(...layers.filter(Boolean).map((l) => l.length));
    const out = new Map<string, { x: number; y: number }>();
    layers.forEach((layer, d) => {
        if (!layer) return;
        const offset = ((widest - layer.length) * stepX) / 2;
        layer.forEach((n, i) => out.set(n.id, { x: 350 + offset + i * stepX, y: d * stepY }));
    });
    return out;
}
