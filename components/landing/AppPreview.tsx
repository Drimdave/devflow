"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Play, Sparkles, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/ui/logo";
import { nodeKindStyles, type NodeKind } from "@/lib/node-visuals";
import { Webhook, Bot, SplitSquareVertical, MessageSquare, Table2, Handshake } from "./preview-icons";

const W = 1000;
const H = 560;
const HEADER = 60;
const NODE_W = 230;
const NODE_H = 66;

type PNode = { id: string; kind: NodeKind; title: string; sub: string; x: number; y: number; icon: React.ComponentType<{ className?: string }> };

const NODES: PNode[] = [
    { id: "n1", kind: "trigger", title: "New lead", sub: "Webhook · POST /leads", x: 30, y: 40, icon: Webhook },
    { id: "n2", kind: "action", title: "Enrich with AI", sub: "Clearbit + Llama 3.3", x: 378, y: 40, icon: Bot },
    { id: "n3", kind: "logic", title: "Enterprise?", sub: "employees > 500", x: 725, y: 40, icon: SplitSquareVertical },
    { id: "n4", kind: "action", title: "Notify sales", sub: "Slack · #enterprise", x: 490, y: 250, icon: MessageSquare },
    { id: "n5", kind: "data", title: "Add to nurture list", sub: "Google Sheets", x: 745, y: 250, icon: Table2 },
    { id: "n6", kind: "action", title: "Create CRM deal", sub: "HubSpot", x: 490, y: 400, icon: Handshake },
];

type PEdge = { from: string; to: string; fromX?: number; label?: string };
const EDGES: PEdge[] = [
    { from: "n1", to: "n2" },
    { from: "n2", to: "n3" },
    { from: "n3", to: "n4", fromX: 0.3, label: "Yes" },
    { from: "n3", to: "n5", fromX: 0.7, label: "No" },
    { from: "n4", to: "n6" },
];

const ORDER = ["n1", "n2", "n3", "n4", "n6"];

function byId(id: string) {
    return NODES.find((n) => n.id === id)!;
}

function edgePath(e: PEdge) {
    const a = byId(e.from);
    const b = byId(e.to);
    const horizontal = a.y === b.y;
    if (horizontal) {
        const x1 = a.x + NODE_W;
        const y1 = a.y + NODE_H / 2;
        const x2 = b.x;
        const y2 = b.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        return { d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`, lx: mx, ly: y1 };
    }
    const x1 = a.x + NODE_W * (e.fromX ?? 0.5);
    const y1 = a.y + NODE_H;
    const x2 = b.x + NODE_W / 2;
    const y2 = b.y;
    const my = (y1 + y2) / 2;
    return { d: `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`, lx: (x1 + x2) / 2, ly: my };
}

type Status = "idle" | "running" | "success";

export default function AppPreview({ className, animate = true }: { className?: string; animate?: boolean }) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [step, setStep] = useState(animate ? -1 : ORDER.length);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const update = () => setScale(el.clientWidth / W);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Cycle through the run: idle → each node running → all done → pause → repeat
    useEffect(() => {
        if (!animate) return;
        const t = setInterval(() => {
            setStep((s) => (s >= ORDER.length + 2 ? -1 : s + 1));
        }, 950);
        return () => clearInterval(t);
    }, [animate]);

    // The "No" branch (n5) is never taken, like a real If/Else.
    const statusOf = (id: string): Status => {
        const i = ORDER.indexOf(id);
        if (i < 0 || step < 0 || i > step) return "idle";
        return i === step ? "running" : "success";
    };

    return (
        <div
            ref={wrapRef}
            className={cn("relative w-full overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_30px_80px_-30px_hsl(0_0%_0%/0.35)]", className)}
            style={{ height: H * scale }}
            aria-hidden
        >
            <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }} className="absolute left-0 top-0">
                {/* App header */}
                <div className="flex items-center justify-between border-b border-border/70 bg-card px-5" style={{ height: HEADER }}>
                    <div className="flex items-center gap-3">
                        <LogoMark className="h-8 w-8" />
                        <div className="h-5 w-px bg-border" />
                        <span className="text-[15px] font-semibold tracking-tight">Lead routing</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Saved
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="flex h-9 items-center rounded-full bg-muted px-4 text-[13px] font-medium">Save</span>
                        <span className="flex h-9 items-center gap-2 rounded-full bg-foreground pl-3 pr-4 text-[13px] font-semibold text-background">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-volt text-volt-foreground">
                                <Play className="h-2 w-2 fill-current" />
                            </span>
                            Run
                        </span>
                    </div>
                </div>

                {/* Canvas */}
                <div className="bg-dots absolute inset-x-0 bottom-0 bg-muted/40" style={{ top: HEADER }}>
                    <svg width={W} height={H - HEADER} className="absolute inset-0 overflow-visible">
                        {EDGES.map((e) => {
                            const { d, lx, ly } = edgePath(e);
                            const src = statusOf(e.from);
                            const dst = statusOf(e.to);
                            const live = dst === "running";
                            const done = src === "success" && dst === "success";
                            return (
                                <g key={`${e.from}-${e.to}`}>
                                    <path
                                        d={d}
                                        fill="none"
                                        strokeWidth={live || done ? 2.5 : 2}
                                        strokeLinecap="round"
                                        className={cn("transition-colors duration-500", live && "edge-flow")}
                                        stroke={live ? "hsl(0 0% 8%)" : done ? "hsl(152 60% 42%)" : "hsl(0 0% 70%)"}
                                    />
                                    {e.label && (
                                        <foreignObject x={lx - 20} y={ly - 11} width={40} height={22}>
                                            <div
                                                className={cn(
                                                    "flex h-[22px] items-center justify-center rounded-full border bg-card text-[10px] font-semibold",
                                                    e.label === "Yes" ? "border-emerald-500/40 text-emerald-700" : "border-border text-muted-foreground"
                                                )}
                                            >
                                                {e.label}
                                            </div>
                                        </foreignObject>
                                    )}
                                </g>
                            );
                        })}
                    </svg>

                    {NODES.map((n) => {
                        const st = statusOf(n.id);
                        const style = nodeKindStyles[n.kind];
                        return (
                            <div
                                key={n.id}
                                className={cn(
                                    "absolute flex items-center gap-3 rounded-2xl border bg-card px-3.5 shadow-card transition-all duration-300",
                                    st === "running" ? "border-volt ring-4 ring-volt/40 animate-ring-pulse" : st === "success" ? "border-emerald-500/60" : "border-border"
                                )}
                                style={{ left: n.x, top: n.y - 0, width: NODE_W, height: NODE_H }}
                            >
                                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", style.chip)}>
                                    <n.icon className="h-[18px] w-[18px]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold leading-tight">{n.title}</p>
                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.sub}</p>
                                </div>
                                {st === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
                                {st === "success" && (
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                                        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                                    </span>
                                )}
                            </div>
                        );
                    })}

                    {/* Floating copilot bar */}
                    <div className="absolute bottom-5 left-5 flex w-[400px] items-center gap-2.5 rounded-full border border-border bg-card py-2 pl-4 pr-2 shadow-card">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate text-[13px] text-muted-foreground">Route enterprise leads to Slack…</span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
                            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
