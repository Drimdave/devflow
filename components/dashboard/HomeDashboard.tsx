"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowUp, ArrowUpRight, Plus, MessageSquareText, MousePointerClick, Play } from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import { useSession } from "@/lib/auth-client";
import GraphThumb from "@/components/ui/graph-thumb";
import { graphFromSaved } from "@/lib/demo-graph";
import { TEMPLATES } from "@/lib/templates";

interface SavedWorkflow {
    id: string;
    name: string;
    description: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    node_count?: number;
    nodes_json?: any[];
    edges_json?: any[];
}

const featuredTemplates = TEMPLATES.filter((t) => t.featured);

const promptIdeas = [
    "Post new GitHub issues to Slack",
    "Summarize inbound emails with AI",
    "Sync form submissions to a sheet",
];

const steps = [
    { icon: MessageSquareText, title: "Describe it", body: "Say what you want in plain English." },
    { icon: MousePointerClick, title: "Tweak it", body: "Open any node and change its settings." },
    { icon: Play, title: "Run it", body: "Watch every node light up, step by step." },
];

function timeAgo(dateString: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
}

const rise = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.05 + i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
});

interface HomeDashboardProps {
    onLoadWorkflow: (id: string) => void;
    onNewWorkflow: () => void;
    onUseTemplate: (prompt: string) => void;
    onUseTemplateId: (id: string) => void;
    onViewAllTemplates?: () => void;
    refreshKey?: number;
}

export default function HomeDashboard({ onLoadWorkflow, onNewWorkflow, onUseTemplate, onUseTemplateId, onViewAllTemplates, refreshKey }: HomeDashboardProps) {
    const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [prompt, setPrompt] = useState("");
    const { data: session } = useSession();
    const firstName = session?.user?.name?.split(" ")[0];

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            try {
                const res = await fetch("/api/workflows");
                if (res.ok && !cancelled) {
                    const data = await res.json();
                    setWorkflows(data.workflows || []);
                }
            } catch (error) {
                console.error("Failed to fetch workflows:", error);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [refreshKey]);

    const totalNodes = useMemo(
        () => workflows.reduce((sum, w) => sum + (w.node_count ?? (Array.isArray(w.nodes_json) ? w.nodes_json.length : 0)), 0),
        [workflows]
    );
    const recent = useMemo(
        () => workflows.slice(0, 5).map((w) => ({ ...w, graph: graphFromSaved(w.nodes_json, w.edges_json) })),
        [workflows]
    );
    const hasWorkflows = !isLoading && workflows.length > 0;

    const submitPrompt = (text: string) => {
        const t = text.trim();
        if (!t) return;
        onUseTemplate(t);
        setPrompt("");
        showToast("Building your workflow…", "success");
    };

    return (
        <div className="h-full overflow-y-auto bg-dots-fine">
            <div className="mx-auto max-w-5xl px-6 pb-20 pt-12 sm:px-10 sm:pt-14">
                {/* ── Hero ── */}
                <section className="mb-14 text-center">
                    <motion.p {...rise(0)} className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-volt ring-2 ring-volt/30" />
                        Ask DevFlow is ready
                    </motion.p>
                    <motion.h1 {...rise(1)} className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                        {greeting()}{firstName ? `, ${firstName}` : ""}.
                        <br />
                        <span className="text-muted-foreground">What should we </span>
                        <span className="highlight-volt">automate</span>
                        <span className="text-muted-foreground"> today?</span>
                    </motion.h1>

                    <motion.form
                        {...rise(2)}
                        onSubmit={(e) => { e.preventDefault(); submitPrompt(prompt); }}
                        className="mx-auto mt-9 max-w-2xl"
                    >
                        <div className="rounded-[28px] border border-border bg-card p-2 shadow-card transition-shadow focus-within:ring-4 focus-within:ring-foreground/5">
                            <div className="flex items-center gap-2">
                                <Sparkles className="ml-3 h-5 w-5 shrink-0 text-muted-foreground sm:ml-4" />
                                <div className="relative min-w-0 flex-1">
                                    <input
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        aria-label="Describe a workflow to generate"
                                        className="h-12 w-full min-w-0 truncate bg-transparent px-2 text-[15px] outline-none"
                                    />
                                    {/* Custom placeholder so phones get a short one that actually fits */}
                                    {!prompt && (
                                        <span className="pointer-events-none absolute inset-y-0 left-2 right-2 flex items-center truncate text-[15px] text-muted-foreground" aria-hidden>
                                            <span className="truncate sm:hidden">Describe a workflow…</span>
                                            <span className="hidden truncate sm:inline">Alert Slack when a payment fails…</span>
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={!prompt.trim()}
                                    aria-label="Generate workflow"
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 disabled:scale-100 disabled:opacity-25 sm:h-12 sm:w-12"
                                >
                                    <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            {promptIdeas.map((idea) => (
                                <button
                                    key={idea}
                                    type="button"
                                    onClick={() => submitPrompt(idea)}
                                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-foreground/30 hover:text-foreground"
                                >
                                    {idea}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={onNewWorkflow}
                                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                            >
                                <Plus className="h-3 w-3" /> Start blank
                            </button>
                        </div>
                    </motion.form>
                </section>

                {/* ── Loading skeleton ── */}
                {isLoading && (
                    <section className="mb-14" aria-busy="true">
                        <div className="mb-5 h-6 w-56 animate-pulse rounded-lg bg-muted" />
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="overflow-hidden rounded-3xl border border-border/70 bg-card">
                                    <div className="h-40 animate-pulse bg-muted/60" />
                                    <div className="space-y-2 p-4">
                                        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                                        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Pick up where you left off ── */}
                {hasWorkflows && (
                    <section className="mb-14">
                        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                            <h2 className="text-lg font-semibold tracking-tight">Pick up where you left off</h2>
                            <p className="text-sm text-muted-foreground">
                                {workflows.length} {workflows.length === 1 ? "workflow" : "workflows"} · {totalNodes} nodes
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {recent.map((wf, i) => (
                                <motion.button
                                    key={wf.id}
                                    {...rise(i)}
                                    onClick={() => onLoadWorkflow(wf.id)}
                                    className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20"
                                >
                                    <div className="relative h-40 bg-muted/50 bg-dots-fine">
                                        {wf.graph ? <GraphThumb graph={wf.graph} /> : null}
                                        <span className="absolute right-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                                            {wf.node_count ?? (Array.isArray(wf.nodes_json) ? wf.nodes_json.length : 0)} nodes
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 p-4">
                                        <div className="min-w-0">
                                            <p className="truncate font-display text-[15px] font-semibold text-foreground">{wf.name}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">Edited {timeAgo(wf.updated_at)}</p>
                                        </div>
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
                                            <ArrowUpRight className="h-4 w-4" />
                                        </span>
                                    </div>
                                </motion.button>
                            ))}

                            <motion.button
                                {...rise(recent.length)}
                                onClick={onNewWorkflow}
                                className="group flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border text-muted-foreground transition-all hover:border-foreground/30 hover:bg-card hover:text-foreground"
                            >
                                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted transition-colors group-hover:bg-volt group-hover:text-volt-foreground">
                                    <Plus className="h-5 w-5" />
                                </span>
                                <span className="text-sm font-medium">New workflow</span>
                            </motion.button>
                        </div>
                    </section>
                )}

                {/* ── First-time guide ── */}
                {!isLoading && workflows.length === 0 && (
                    <motion.section {...rise(3)} className="mb-14 grid gap-3 sm:grid-cols-3">
                        {steps.map((s, i) => (
                            <div key={s.title} className="flex items-start gap-4 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background">
                                    <s.icon className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Step {i + 1}</p>
                                    <p className="mt-0.5 font-display text-[15px] font-semibold">{s.title}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                                </div>
                            </div>
                        ))}
                    </motion.section>
                )}

                {/* ── Templates ── */}
                <section>
                    <div className="mb-5 flex items-baseline justify-between">
                        <h2 className="text-lg font-semibold tracking-tight">
                            {hasWorkflows ? "Start from a template" : "Try a template to see it work"}
                        </h2>
                        <button onClick={() => onViewAllTemplates?.()} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                            View all →
                        </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {featuredTemplates.map((t, i) => (
                            <motion.button
                                key={t.name}
                                {...rise(i + 2)}
                                onClick={() => onUseTemplateId(t.id)}
                                className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20"
                            >
                                <div className="relative h-32 bg-muted/50 bg-dots-fine">
                                    <GraphThumb graph={t.graph} />
                                </div>
                                <div className="flex flex-1 flex-col p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-display text-[15px] font-semibold text-foreground">{t.name}</h3>
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-volt group-hover:text-volt-foreground">
                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                        </span>
                                    </div>
                                    <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{t.description}</p>
                                    <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.category} · {t.graph.nodes.length} nodes</p>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
