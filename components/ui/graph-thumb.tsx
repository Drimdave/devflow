import { cn } from "@/lib/utils";
import { NODE_H, NODE_W, bestLayout, type DemoGraph, type DemoKind } from "@/lib/demo-graph";

const CHIP: Record<DemoKind, string> = {
    trigger: "fill-node-trigger/25",
    action: "fill-node-action",
    logic: "fill-node-logic/30",
    data: "fill-node-data/25",
};

type Placed = { id: string; type: DemoKind; x: number; y: number };
type Arrangement = { nodes: Placed[]; width: number; height: number };

/** A pure chain (a → b → c …) in order, or null if the graph branches or merges. */
function chainOrder(graph: DemoGraph): string[] | null {
    const n = graph.nodes.length;
    if (n < 4 || graph.edges.length !== n - 1) return null;
    const next = new Map<string, string>();
    const hasIn = new Set<string>();
    for (const e of graph.edges) {
        if (next.has(e.source) || hasIn.has(e.target)) return null; // branch or merge
        next.set(e.source, e.target);
        hasIn.add(e.target);
    }
    const start = graph.nodes.find((x) => !hasIn.has(x.id));
    if (!start) return null;
    const order = [start.id];
    while (next.has(order[order.length - 1]) && order.length <= n) order.push(next.get(order[order.length - 1])!);
    return order.length === n ? order : null;
}

/**
 * Long straight workflows turn into a tall skinny column that wastes the card. Instead,
 * wrap them into rows that snake back and forth, so a 6-step flow becomes a tidy 3x2 block.
 */
function snake(graph: DemoGraph, order: string[]): Arrangement {
    const n = order.length;
    const cols = n === 4 ? 2 : n <= 6 ? 3 : 4;
    const gapX = 56;
    const gapY = 36;
    const byId = new Map(graph.nodes.map((x) => [x.id, x]));
    const nodes: Placed[] = order.map((id, i) => {
        const row = Math.floor(i / cols);
        const colInRow = i % cols;
        const col = row % 2 === 0 ? colInRow : cols - 1 - colInRow; // odd rows run right-to-left
        return { id, type: byId.get(id)!.type, x: col * (NODE_W + gapX), y: row * (NODE_H + gapY) };
    });
    const rows = Math.ceil(n / cols);
    return { nodes, width: cols * NODE_W + (cols - 1) * gapX, height: rows * NODE_H + (rows - 1) * gapY };
}

function arrange(graph: DemoGraph): Arrangement {
    const order = chainOrder(graph);
    if (order) return snake(graph, order);
    const { layout } = bestLayout(graph, 640, 300);
    return { nodes: layout.nodes.map((nd) => ({ id: nd.id, type: nd.type, x: nd.x, y: nd.y })), width: layout.width, height: layout.height };
}

/** Curve between two placed nodes, leaving and entering from whichever sides face each other. */
function connect(a: Placed, b: Placed): string {
    const sameRow = Math.abs(a.y - b.y) < NODE_H / 2;
    if (sameRow) {
        const goingRight = b.x > a.x;
        const x1 = goingRight ? a.x + NODE_W : a.x;
        const x2 = goingRight ? b.x : b.x + NODE_W;
        const y1 = a.y + NODE_H / 2;
        const y2 = b.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
    }
    const goingDown = b.y > a.y;
    const x1 = a.x + NODE_W / 2;
    const x2 = b.x + NODE_W / 2;
    const y1 = goingDown ? a.y + NODE_H : a.y;
    const y2 = goingDown ? b.y : b.y + NODE_H;
    const my = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

/**
 * A tiny, text-free picture of a workflow: each node is a card with a colored chip, wired
 * together. Used on the dashboard so every template and saved workflow looks like the real thing.
 */
export default function GraphThumb({ graph, className }: { graph: DemoGraph; className?: string }) {
    const { nodes, width, height } = arrange(graph);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const pad = 32;

    return (
        <svg
            viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`}
            preserveAspectRatio="xMidYMid meet"
            className={cn("h-full w-full", className)}
            aria-hidden
        >
            {graph.edges.map((e) => {
                const a = byId.get(e.source);
                const b = byId.get(e.target);
                return a && b ? (
                    <path
                        key={`${e.source}-${e.target}`}
                        d={connect(a, b)}
                        fill="none"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        strokeWidth={1.6}
                        className="stroke-muted-foreground/40"
                    />
                ) : null;
            })}
            {nodes.map((n) => (
                <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
                    <rect width={NODE_W} height={NODE_H} rx={18} className="fill-card stroke-border" strokeWidth={2} />
                    <rect x={13} y={13} width={36} height={36} rx={11} className={CHIP[n.type]} />
                    <rect x={62} y={19} width={104} height={10} rx={5} className="fill-foreground/75" />
                    <rect x={62} y={37} width={74} height={8} rx={4} className="fill-muted-foreground/35" />
                </g>
            ))}
        </svg>
    );
}
