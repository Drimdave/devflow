"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, ArrowUpRight, Check, ChevronDown, Loader2, Play, RefreshCw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeRunResult } from "@/lib/run-types";
import { RETENTION } from "@/lib/run-retention";
import { showToast } from "@/components/ui/Toast";

interface RunRow {
    id: string;
    workflow_id: string;
    workflow_name: string | null;
    status: "success" | "failed";
    mode: "full" | "node" | "webhook";
    started_at: string;
    duration_ms: number;
    error: string | null;
    step_count: number;
    simulated_count: number;
}

interface RunDetail extends RunRow {
    steps_json: NodeRunResult[];
}

const MODE_LABEL: Record<RunRow["mode"], string> = { full: "Manual", node: "Single node", webhook: "Webhook" };

const STEP_STYLES: Record<NodeRunResult["status"], { label: string; dot: string; chip: string }> = {
    success: { label: "Succeeded", dot: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    simulated: { label: "Simulated", dot: "bg-amber-500", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    skipped: { label: "Skipped", dot: "bg-muted-foreground/40", chip: "bg-muted text-muted-foreground" },
    failed: { label: "Failed", dot: "bg-destructive", chip: "bg-destructive/10 text-destructive" },
};

function timeAgo(dateString: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const duration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

function StatusPill({ status }: { status: RunRow["status"] }) {
    return status === "success" ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" title="Succeeded"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
    ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-white" title="Failed"><X className="h-3.5 w-3.5" strokeWidth={3} /></span>
    );
}

function Steps({ runId }: { runId: string }) {
    const [steps, setSteps] = useState<NodeRunResult[] | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let live = true;
        fetch(`/api/runs/${runId}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d: { run: RunDetail }) => live && setSteps(d.run.steps_json ?? []))
            .catch(() => live && setError(true));
        return () => { live = false; };
    }, [runId]);

    if (error) return <p className="px-1 py-3 text-sm text-destructive">Couldn&apos;t load this run&apos;s steps.</p>;
    if (!steps) return <div className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading steps…</div>;

    return (
        <ol className="space-y-2">
            {steps.map((s, i) => {
                const st = STEP_STYLES[s.status];
                const hasOutput = s.output !== undefined && s.output !== null;
                return (
                    <li key={`${s.nodeId}-${i}`} className="rounded-2xl bg-muted/60 p-3.5">
                        <div className="flex items-center gap-3">
                            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", st.dot)} />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.label}</span>
                            {s.durationMs > 0 && <span className="text-xs text-muted-foreground">{duration(s.durationMs)}</span>}
                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", st.chip)}>{st.label}</span>
                        </div>
                        {s.error && <p className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{s.error}</p>}
                        {s.note && <p className="mt-2 text-xs text-muted-foreground">{s.note}</p>}
                        {hasOutput && (
                            <details className="mt-2 group">
                                <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">Output</summary>
                                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-card px-3 py-2.5 font-mono text-[11.5px] leading-relaxed">
                                    {typeof s.output === "string" ? s.output : JSON.stringify(s.output, null, 2)}
                                </pre>
                            </details>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

interface RunsPageProps {
    onOpenWorkflow: (id: string) => void;
    onBrowseWorkflows: () => void;
}

export default function RunsPage({ onOpenWorkflow, onBrowseWorkflows }: RunsPageProps) {
    const [runs, setRuns] = useState<RunRow[] | null>(null);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [status, setStatus] = useState<"all" | "success" | "failed">("all");
    const [workflow, setWorkflow] = useState("all");
    const [openId, setOpenId] = useState<string | null>(null);
    const [clearing, setClearing] = useState(false);
    const [clearBusy, setClearBusy] = useState(false);

    const load = useCallback(async () => {
        setRefreshing(true);
        setError(false);
        try {
            const r = await fetch("/api/runs?limit=100");
            if (!r.ok) throw new Error();
            setRuns((await r.json()).runs);
        } catch {
            setError(true);
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const workflows = useMemo(() => {
        const m = new Map<string, string>();
        (runs ?? []).forEach((r) => m.set(r.workflow_id, r.workflow_name ?? "Deleted workflow"));
        return [...m.entries()];
    }, [runs]);

    const visible = (runs ?? []).filter((r) => (status === "all" || r.status === status) && (workflow === "all" || r.workflow_id === workflow));
    const failedCount = (runs ?? []).filter((r) => r.status === "failed").length;
    // "Clear history" follows the workflow filter: one workflow's runs, or everything
    const scopeName = workflow === "all" ? null : workflows.find(([id]) => id === workflow)?.[1] ?? "this workflow";
    const scopeCount = (runs ?? []).filter((r) => workflow === "all" || r.workflow_id === workflow).length;

    const clearHistory = async () => {
        setClearBusy(true);
        try {
            const res = await fetch(`/api/runs${workflow === "all" ? "" : `?workflowId=${workflow}`}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            const { deleted } = await res.json();
            showToast(`Deleted ${deleted} run${deleted === 1 ? "" : "s"}`, "success");
            setClearing(false);
            setOpenId(null);
            setWorkflow("all");
            await load();
        } catch {
            showToast("Couldn't clear the history. Try again.", "error");
        } finally {
            setClearBusy(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-dots-fine">
            <div className="mx-auto max-w-4xl px-6 pb-20 pt-12 sm:px-10 sm:pt-14">
                <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="mb-8 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Runs</h1>
                        <p className="mt-3 text-lg text-muted-foreground">Every time a workflow ran, and exactly what happened.</p>
                        <p className="mt-1.5 text-sm text-muted-foreground">DevFlow keeps each workflow&apos;s latest {RETENTION.perWorkflow} runs for {RETENTION.days} days, then deletes them.</p>
                    </div>
                    <button onClick={load} disabled={refreshing} className="flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60">
                        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /> Refresh
                    </button>
                </motion.header>

                {runs && runs.length > 0 && (
                    <div className="mb-5 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1 rounded-full bg-muted p-1">
                            {([["all", "All"], ["success", "Succeeded"], ["failed", failedCount ? `Failed (${failedCount})` : "Failed"]] as const).map(([v, label]) => (
                                <button key={v} onClick={() => setStatus(v)} className={cn("h-8 rounded-full px-3.5 text-sm font-medium transition-colors", status === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        {workflows.length > 1 && (
                            <div className="relative">
                                <select value={workflow} onChange={(e) => setWorkflow(e.target.value)} aria-label="Filter by workflow" className="h-10 max-w-[240px] appearance-none truncate rounded-full border border-border bg-card pl-4 pr-10 text-sm font-medium outline-none focus:ring-2 focus:ring-foreground/20">
                                    <option value="all">All workflows</option>
                                    {workflows.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            </div>
                        )}
                        <button
                            onClick={() => setClearing(true)}
                            className="ml-auto flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4" /> {scopeName ? "Clear this workflow's history" : "Clear history"}
                        </button>
                    </div>
                )}

                {!runs && !error && (
                    <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-3xl bg-muted" />)}</div>
                )}

                {error && (
                    <div className="flex flex-col items-center gap-3 rounded-3xl border border-border/70 bg-card py-16 text-center shadow-card">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                        <p className="font-medium">Couldn&apos;t load your runs</p>
                        <button onClick={load} className="h-10 rounded-full bg-foreground px-5 text-sm font-semibold text-background">Try again</button>
                    </div>
                )}

                {runs && runs.length === 0 && (
                    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card py-20 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-volt text-volt-foreground"><Play className="h-5 w-5" /></span>
                        <p className="text-lg font-semibold">No runs yet</p>
                        <p className="max-w-sm text-sm text-muted-foreground">Open a saved workflow and press Run, or call its webhook URL. Each run shows up here with its results.</p>
                        <button onClick={onBrowseWorkflows} className="mt-2 h-10 rounded-full bg-foreground px-5 text-sm font-semibold text-background">Go to workflows</button>
                    </div>
                )}

                {runs && runs.length > 0 && visible.length === 0 && (
                    <p className="rounded-3xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">No runs match these filters.</p>
                )}

                <div className="space-y-3">
                    {visible.map((r) => {
                        const open = openId === r.id;
                        return (
                            <div key={r.id} className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card">
                                <button onClick={() => setOpenId(open ? null : r.id)} aria-expanded={open} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40 sm:px-5">
                                    <StatusPill status={r.status} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">{r.workflow_name ?? "Deleted workflow"}</p>
                                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                            {r.status === "failed" && r.error ? r.error : `${r.step_count} steps${r.simulated_count ? ` · ${r.simulated_count} simulated` : ""}`}
                                        </p>
                                    </div>
                                    <span className="hidden rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline">{MODE_LABEL[r.mode] ?? r.mode}</span>
                                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                                        <p title={new Date(r.started_at).toLocaleString()}>{timeAgo(r.started_at)}</p>
                                        <p className="mt-0.5">{duration(r.duration_ms)}</p>
                                    </div>
                                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                                </button>
                                {open && (
                                    <div className="border-t border-border/60 bg-card px-4 pb-4 pt-4 sm:px-5">
                                        <Steps runId={r.id} />
                                        {r.workflow_name && (
                                            <button onClick={() => onOpenWorkflow(r.workflow_id)} className="mt-4 flex h-9 items-center gap-1.5 rounded-full bg-muted px-4 text-sm font-medium transition-colors hover:bg-accent">
                                                Open workflow <ArrowUpRight className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <Dialog.Root open={clearing} onOpenChange={(o) => !o && !clearBusy && setClearing(false)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]" />
                    <Dialog.Content
                        className="fixed left-1/2 top-1/2 z-[61] w-[min(440px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-border bg-card p-6 shadow-2xl outline-none"
                        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>("[data-cancel]")?.focus(); }}
                    >
                        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></span>
                        <Dialog.Title className="font-display text-xl font-semibold">{scopeName ? "Clear this workflow's history?" : "Clear all run history?"}</Dialog.Title>
                        <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {scopeName
                                ? <><span className="font-medium text-foreground">{scopeCount} run{scopeCount === 1 ? "" : "s"}</span> of &ldquo;{scopeName}&rdquo; will be permanently deleted. The workflow itself is untouched.</>
                                : <><span className="font-medium text-foreground">{runs?.length ?? 0} run{(runs?.length ?? 0) === 1 ? "" : "s"}</span> across all your workflows will be permanently deleted. Your workflows are untouched.</>}
                            {" "}This can&apos;t be undone.
                        </Dialog.Description>
                        <div className="mt-6 flex justify-end gap-2">
                            <Dialog.Close data-cancel disabled={clearBusy} className="h-11 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50">Cancel</Dialog.Close>
                            <button onClick={clearHistory} disabled={clearBusy} className="flex h-11 items-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-destructive-foreground transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60">
                                {clearBusy && <Loader2 className="h-4 w-4 animate-spin" />} Delete runs
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
