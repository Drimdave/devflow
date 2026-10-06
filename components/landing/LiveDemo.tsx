"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUp, Check, Loader2, Play, RotateCcw, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/ui/logo";
import { iconForNode, nodeKindStyles, normalizeKind } from "@/lib/node-visuals";
import { NODE_H, NODE_W, bestLayout, runPlan, type DemoGraph } from "@/lib/demo-graph";
import { DEMO_PRESETS, findPreset } from "@/lib/demo-presets";

const STEP_MS = 850;

type Status = "ready" | "loading" | "error";

export default function LiveDemo({ className }: { className?: string }) {
    const [prompt, setPrompt] = useState(DEMO_PRESETS[0].prompt);
    const [graph, setGraph] = useState<DemoGraph>(DEMO_PRESETS[0].graph);
    const [graphKey, setGraphKey] = useState(0);
    const [status, setStatus] = useState<Status>("ready");
    const [error, setError] = useState<{ message: string; limited: boolean } | null>(null);
    const [loop, setLoop] = useState(true); // autoplay until the visitor takes over
    const [runKey, setRunKey] = useState(0);
    const [step, setStep] = useState(-1);

    const canvasRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ w: 900, h: 400 });

    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const plan = useMemo(() => runPlan(graph), [graph]);
    const fit = useMemo(() => bestLayout(graph, Math.max(box.w - 56, 120), Math.max(box.h - 56, 120)), [graph, box]);
    const { layout, scale } = fit;
    const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);

    // Reveal the graph, then run it node by node
    useEffect(() => {
        if (status !== "ready") return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        let i = -1;
        setStep(-1);

        const advance = () => {
            if (cancelled) return;
            i++;
            setStep(i);
            if (i < plan.length) {
                timer = setTimeout(advance, STEP_MS);
            } else if (loop) {
                timer = setTimeout(() => {
                    i = -1;
                    setStep(-1);
                    timer = setTimeout(advance, 700);
                }, 2800);
            }
        };

        timer = setTimeout(advance, graph.nodes.length * 110 + 450);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [graph, plan, runKey, loop, status]);

    const nodeStatus = (id: string): "idle" | "running" | "success" => {
        const idx = plan.indexOf(id);
        if (idx < 0 || step < 0 || idx > step) return "idle";
        return idx === step ? "running" : "success";
    };

    const show = (g: DemoGraph) => {
        setGraph(g);
        setGraphKey((k) => k + 1);
        setStatus("ready");
        setError(null);
    };

    const generate = async (text: string) => {
        const t = text.trim();
        if (t.length < 8 || status === "loading") return;
        setLoop(false);

        const preset = findPreset(t);
        if (preset) {
            show(preset.graph);
            return;
        }

        setStatus("loading");
        setError(null);
        try {
            const res = await fetch("/api/demo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: t }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.graph) {
                setError({ message: data.message || "Something went wrong. Please try again.", limited: res.status === 429 });
                setStatus("error");
                return;
            }
            show(data.graph as DemoGraph);
        } catch {
            setError({ message: "Couldn't reach the server. Please try again.", limited: false });
            setStatus("error");
        }
    };

    // Other sections (use cases) can push a prompt into the demo via a window event
    const generateRef = useRef(generate);
    generateRef.current = generate;
    const rootRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onTry = (e: Event) => {
            const text = (e as CustomEvent<string>).detail;
            if (typeof text !== "string") return;
            setPrompt(text);
            rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            generateRef.current(text);
        };
        window.addEventListener("devflow:try", onTry);
        return () => window.removeEventListener("devflow:try", onTry);
    }, []);

    const finished = step >= plan.length;
    const running = step >= 0 && step < plan.length;

    return (
        <div ref={rootRef} className={cn("w-full overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_30px_80px_-30px_hsl(0_0%_0%/0.35)]", className)}>
            {/* App header */}
            <div className="flex h-[60px] items-center justify-between gap-3 border-b border-border/70 px-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                    <LogoMark className="h-8 w-8" />
                    <div className="hidden h-5 w-px bg-border sm:block" />
                    <span className="truncate text-[15px] font-semibold tracking-tight">{graph.title}</span>
                    <span
                        aria-live="polite"
                        className={cn(
                            "hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex",
                            finished
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : running
                                    ? "bg-volt text-volt-foreground"
                                    : "bg-muted text-muted-foreground"
                        )}
                    >
                        {running && <Loader2 className="h-3 w-3 animate-spin" />}
                        {finished && <Check className="h-3 w-3" strokeWidth={3} />}
                        {finished ? "Ran successfully" : running ? "Running" : "Draft"}
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Link
                        href="/login"
                        className="hidden h-9 items-center rounded-full bg-muted px-4 text-[13px] font-medium transition-colors hover:bg-accent sm:flex"
                    >
                        Save &amp; edit
                    </Link>
                    <button
                        onClick={() => {
                            setLoop(false);
                            setRunKey((k) => k + 1);
                        }}
                        disabled={status === "loading"}
                        className="flex h-9 items-center gap-2 rounded-full bg-foreground pl-3 pr-4 text-[13px] font-semibold text-background transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
                    >
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-volt text-volt-foreground">
                            {finished ? <RotateCcw className="h-2.5 w-2.5" strokeWidth={3} /> : <Play className="h-2 w-2 fill-current" />}
                        </span>
                        {finished ? "Replay" : "Run"}
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div ref={canvasRef} className="bg-dots relative h-[340px] overflow-hidden bg-muted/40 sm:h-[400px]">
                <div
                    key={graphKey}
                    className="absolute left-0 top-0"
                    style={{
                        width: layout.width,
                        height: layout.height,
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                        left: (box.w - layout.width * scale) / 2,
                        top: (box.h - layout.height * scale) / 2,
                    }}
                >
                    {/* Edges */}
                    <motion.svg
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: graph.nodes.length * 0.08, duration: 0.4 }}
                        width={layout.width}
                        height={layout.height}
                        className="pointer-events-none absolute inset-0 overflow-visible"
                    >
                        {graph.edges.map((e) => {
                            const a = byId.get(e.source);
                            const b = byId.get(e.target);
                            if (!a || !b) return null;
                            const lr = layout.direction === "LR";
                            const x1 = lr ? a.x + NODE_W : a.x + NODE_W / 2;
                            const y1 = lr ? a.y + NODE_H / 2 : a.y + NODE_H;
                            const x2 = lr ? b.x : b.x + NODE_W / 2;
                            const y2 = lr ? b.y + NODE_H / 2 : b.y;
                            const d = lr
                                ? `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`
                                : `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`;
                            const src = nodeStatus(e.source);
                            const dst = nodeStatus(e.target);
                            const live = dst === "running";
                            const done = src === "success" && dst === "success";
                            return (
                                <path
                                    key={`${e.source}-${e.target}`}
                                    d={d}
                                    fill="none"
                                    strokeWidth={live || done ? 2.5 : 2}
                                    strokeLinecap="round"
                                    vectorEffect="non-scaling-stroke"
                                    className={cn("transition-colors duration-500", live && "edge-flow")}
                                    stroke={live ? "hsl(var(--foreground))" : done ? "hsl(152 60% 42%)" : "hsl(var(--muted-foreground) / 0.5)"}
                                />
                            );
                        })}
                    </motion.svg>

                    {/* Branch labels */}
                    {graph.edges.map((e) => {
                        if (!e.label) return null;
                        const a = byId.get(e.source);
                        const b = byId.get(e.target);
                        if (!a || !b) return null;
                        const lr = layout.direction === "LR";
                        const mx = lr ? (a.x + NODE_W + b.x) / 2 : (a.x + b.x) / 2 + NODE_W / 2;
                        const my = lr ? (a.y + b.y) / 2 + NODE_H / 2 : (a.y + NODE_H + b.y) / 2;
                        const yes = e.label === "true";
                        return (
                            <span
                                key={`l-${e.source}-${e.target}`}
                                className={cn(
                                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border bg-card px-2 py-0.5 text-[10px] font-semibold",
                                    yes ? "border-emerald-500/40 text-emerald-700" : "border-border text-muted-foreground"
                                )}
                                style={{ left: mx, top: my }}
                            >
                                {yes ? "Yes" : "No"}
                            </span>
                        );
                    })}

                    {/* Nodes */}
                    {layout.nodes.map((n, i) => {
                        const kind = normalizeKind(n.type);
                        const style = nodeKindStyles[kind];
                        const Icon = iconForNode(n.label, kind, { provider: n.provider });
                        const st = nodeStatus(n.id);
                        return (
                            <div key={n.id} className="absolute" style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.88, y: 8 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ delay: i * 0.1, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                    className={cn(
                                        "flex h-full w-full items-center gap-3 rounded-2xl border bg-card px-3.5 shadow-card transition-colors duration-300",
                                        st === "running" ? "border-volt ring-4 ring-volt/40 animate-ring-pulse" : st === "success" ? "border-emerald-500/60" : "border-border"
                                    )}
                                >
                                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", style.chip)}>
                                        <Icon className="h-[18px] w-[18px]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold leading-tight">{n.label}</p>
                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.description || style.label}</p>
                                    </div>
                                    {st === "running" && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                                    {st === "success" && (
                                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                                            <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                                        </span>
                                    )}
                                </motion.div>
                            </div>
                        );
                    })}
                </div>

                {/* Loading */}
                {status === "loading" && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-card/80 backdrop-blur-sm" role="status">
                        <div className="flex items-center gap-3">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.95, 1.05, 0.95] }}
                                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                                    className={cn("h-12 w-12 rounded-2xl border border-border", i === 0 ? "bg-node-trigger/15" : i === 1 ? "bg-node-logic/15" : "bg-foreground/10")}
                                />
                            ))}
                        </div>
                        <p className="text-sm font-medium">Drafting your workflow…</p>
                    </div>
                )}

                {/* Error / limit */}
                {status === "error" && error && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-card/90 px-6 text-center backdrop-blur-sm" role="alert">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                            <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        </span>
                        <p className="max-w-sm text-sm text-muted-foreground">{error.message}</p>
                        {error.limited ? (
                            <Link href="/login" className="flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">
                                Sign up free
                            </Link>
                        ) : (
                            <button
                                onClick={() => setStatus("ready")}
                                className="flex h-10 items-center rounded-full bg-muted px-5 text-sm font-medium transition-colors hover:bg-accent"
                            >
                                Dismiss
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Prompt */}
            <div className="border-t border-border/70 bg-card p-3 sm:p-4">
                <div className="mb-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                    <span className="flex shrink-0 items-center text-xs font-medium text-muted-foreground">Try:</span>
                    {DEMO_PRESETS.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                                setPrompt(p.prompt);
                                setLoop(false);
                                show(p.graph);
                            }}
                            className={cn(
                                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-all",
                                graph === p.graph ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                            )}
                        >
                            {p.prompt}
                        </button>
                    ))}
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        generate(prompt);
                    }}
                    className="flex items-center gap-2 rounded-full border border-border bg-muted/50 py-1.5 pl-4 pr-1.5 transition-shadow focus-within:border-foreground/30 focus-within:ring-4 focus-within:ring-foreground/5"
                >
                    <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        maxLength={240}
                        placeholder="Describe anything you'd like to automate…"
                        aria-label="Describe a workflow to generate"
                        className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <button
                        type="submit"
                        disabled={prompt.trim().length < 8 || status === "loading"}
                        aria-label="Generate workflow"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 disabled:scale-100 disabled:opacity-30"
                    >
                        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
                    </button>
                </form>
            </div>
        </div>
    );
}
