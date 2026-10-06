import type { Node } from "@xyflow/react";
import { ProNodeData } from "./nodes/ProNode";
import { X, Trash2, Save, Plus, Copy, Check, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/Toast";
import type { NodeRunResult } from "@/lib/run-types";
import { describeCron, nextRun, parseCron } from "@/lib/cron";
import { checkCron } from "@/lib/schedule";
import { triggerKindOf } from "@/lib/engine/triggers";
import { iconForNode, nodeKindStyles, normalizeKind } from "@/lib/node-visuals";

interface NodeConfigPanelProps {
    node: Node<ProNodeData> | null;
    /** What this node did the last time the workflow ran. */
    result?: NodeRunResult;
    /** Saved workflow id; webhook URLs only exist for saved workflows. */
    workflowId?: string | null;
    /** The Live/Paused switch of this workflow. */
    isLive?: boolean;
    onClose: () => void;
    onUpdateNode: (id: string, data: Partial<ProNodeData>) => void;
    onDeleteNode: (id: string) => void;
}

export default function NodeConfigPanel({ node, result, workflowId, isLive, onClose, onUpdateNode, onDeleteNode }: NodeConfigPanelProps) {
    const [label, setLabel] = useState("");
    const [description, setDescription] = useState("");
    const [config, setConfig] = useState<Record<string, any>>({});
    const [secretNames, setSecretNames] = useState<string[]>([]);
    const [focusKey, setFocusKey] = useState<string | null>(null);

    // Saved credentials, offered as one-click {{secrets.NAME}} references
    useEffect(() => {
        let live = true;
        fetch("/api/credentials")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => live && setSecretNames((d.credentials ?? []).map((c: { name: string }) => c.name)))
            .catch(() => {});
        return () => { live = false; };
    }, []);

    // Sync state when selected node changes
    useEffect(() => {
        if (node) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- resync the form when a different node is selected
            setLabel(node.data.label || "");
            setDescription(node.data.description || "");
            setConfig(node.data.config ? { ...node.data.config } : {});
        }
    }, [node]);

    if (!node) return null;

    const kind = normalizeKind(node.data.type);
    const kindStyle = nodeKindStyles[kind];
    const NodeIcon = iconForNode(node.data.label, kind, node.data.config);

    const handleSave = () => {
        onUpdateNode(node.id, {
            ...node.data,
            label,
            description,
            config,
        });
        showToast("Node settings saved", "success");
    };

    const updateConfigField = (key: string, value: string) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const removeConfigField = (key: string) => {
        setConfig(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleAddField = () => {
        const key = window.prompt("Enter new field name (e.g. 'timeout', 'headers'):");
        if (key && key.trim()) {
            const safeKey = key.trim().replace(/\s+/g, '_').toLowerCase();
            if (!config[safeKey]) {
                updateConfigField(safeKey, "");
            } else {
                showToast("Field already exists", "error");
            }
        }
    };

    return (
        <div className="absolute right-4 top-4 bottom-4 z-50 flex w-[min(320px,calc(100%-32px))] flex-col overflow-hidden rounded-[22px] border border-border bg-card shadow-2xl animate-in slide-in-from-right-8 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", kindStyle.chip)}>
                        {/* eslint-disable-next-line react-hooks/static-components -- iconForNode returns a stable icon from a lookup table */}
                        <NodeIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-foreground">{node.data.label || "Node"}</h3>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{kindStyle.label} node</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                    aria-label="Close"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">

                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                            Node Name
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="w-full rounded-xl bg-muted px-3.5 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/15"
                            placeholder="e.g. Fetch Users"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full resize-none rounded-xl bg-muted px-3.5 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/15"
                            placeholder="What does this node do?"
                        />
                    </div>
                </div>

                {isWebhookTrigger(node.data) && <WebhookUrl workflowId={workflowId} isLive={isLive} />}

                {node.data.type === "trigger" && triggerKindOf({ label: node.data.label, config }) === "other" && (
                    <div className="space-y-1.5 border-t border-border/50 pt-4">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">How this starts</span>
                        <p className="rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                            DevFlow can&apos;t listen for this kind of event yet, so it won&apos;t start the workflow on its own. It does run when you press Run (using the sample data below). To start it automatically, use a Webhook (have the app POST to it) or a Schedule trigger.
                        </p>
                    </div>
                )}

                {node.data.type === "trigger" && triggerKindOf({ label: node.data.label, config }) === "schedule" && <ScheduleSection cron={String(config.cron ?? config.schedule ?? "")} timezone={config.timezone} workflowId={workflowId} isLive={isLive} />}

                {result && <LastRun result={result} />}

                {/* Configuration Fields */}
                <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                            Configuration
                        </label>
                    </div>

                    {Object.keys(config).length === 0 ? (
                        <div className="text-center py-4 bg-muted/40 rounded-xl border border-dashed border-border flex items-center justify-center">
                            <button
                                onClick={handleAddField}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add first field
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(config).map(([key, value]) => (
                                <div key={key} className="group relative">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[11px] font-medium text-muted-foreground capitalize">
                                            {key.replace(/_/g, ' ')}
                                        </label>
                                        <button
                                            onClick={() => removeConfigField(key)}
                                            className="text-muted-foreground/0 group-hover:text-red-500/70 hover:!text-red-500 transition-all"
                                            title="Remove Field"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        onChange={(e) => updateConfigField(key, e.target.value)}
                                        onFocus={() => setFocusKey(key)}
                                        className="w-full rounded-xl bg-muted px-3.5 py-2 font-mono text-[13px] outline-none transition-shadow focus:ring-2 focus:ring-foreground/15"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {secretNames.length > 0 && Object.keys(config).length > 0 && (
                        <div className="rounded-xl bg-muted/60 p-3">
                            <p className="mb-2 text-[11px] text-muted-foreground">
                                {focusKey && focusKey in config ? <>Insert a credential into <span className="font-medium text-foreground">{focusKey.replace(/_/g, " ")}</span>:</> : "Click a field, then pick a credential to insert:"}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {secretNames.map((n) => (
                                    <button
                                        key={n}
                                        disabled={!focusKey || !(focusKey in config)}
                                        onClick={() => focusKey && updateConfigField(focusKey, `${typeof config[focusKey] === "object" ? JSON.stringify(config[focusKey]) : String(config[focusKey] ?? "")}{{secrets.${n}}}`)}
                                        className="rounded-full bg-card px-2.5 py-1 font-mono text-[11px] font-medium shadow-sm transition-colors hover:bg-foreground hover:text-background disabled:opacity-50 disabled:hover:bg-card disabled:hover:text-foreground"
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {Object.keys(config).length > 0 && (
                        <button
                            onClick={handleAddField}
                            className="w-full mt-2 py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Field
                        </button>
                    )}
                </div>

                {/* System Info */}
                <div className="pt-4 border-t border-border/50">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Node Type: <span className="uppercase text-muted-foreground">{node.data.type}</span></span>
                        <span>ID: {node.id.substring(0, 8)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border/60 bg-muted/30 flex items-center justify-between gap-2">
                <button
                    onClick={() => onDeleteNode(node.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Delete Node"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="h-10 px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="h-10 px-5 flex items-center gap-1.5 bg-foreground text-background rounded-full text-sm font-semibold transition-transform hover:scale-[1.03] active:scale-95"
                    >
                        <Save className="h-3.5 w-3.5" />
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

const RUN_STYLES: Record<NodeRunResult["status"], { label: string; cls: string }> = {
    success: { label: "Succeeded", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    simulated: { label: "Simulated", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    skipped: { label: "Skipped", cls: "bg-muted text-muted-foreground" },
    failed: { label: "Failed", cls: "bg-destructive/10 text-destructive" },
};

function LastRun({ result }: { result: NodeRunResult }) {
    const st = RUN_STYLES[result.status];
    const hasOutput = result.output !== undefined && result.output !== null;
    return (
        <div className="space-y-2 border-t border-border/50 pt-4">
            <div className="flex items-center justify-between">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last run</span>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {result.durationMs > 0 && <span>{result.durationMs}ms</span>}
                    <span className={cn("rounded-full px-2 py-0.5 font-semibold", st.cls)}>{st.label}</span>
                </span>
            </div>
            {result.error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{result.error}</p>}
            {result.note && <p className="text-xs text-muted-foreground">{result.note}</p>}
            {hasOutput && (
                <pre className="max-h-56 overflow-auto rounded-xl bg-muted px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-foreground">
                    {typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2)}
                </pre>
            )}
        </div>
    );
}

function isWebhookTrigger(d: ProNodeData) {
    if (d.type !== "trigger") return false;
    const c = d.config ?? {};
    return /webhook/i.test(`${d.label} ${c.provider ?? ""} ${c.source ?? ""}`);
}

function WebhookUrl({ workflowId, isLive }: { workflowId?: string | null; isLive?: boolean }) {
    const [url, setUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setUrl(null);
        if (!workflowId) return;
        let live = true;
        fetch(`/api/workflows/${workflowId}/webhook`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => live && setUrl(`${window.location.origin}${d.path}`))
            .catch(() => {});
        return () => { live = false; };
    }, [workflowId]);

    const copy = async () => {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            showToast("Couldn't copy. Select the URL and copy it manually.", "error");
        }
    };

    const rotate = async () => {
        if (!workflowId || busy) return;
        if (!window.confirm("Generate a new URL? The current one will stop working immediately.")) return;
        setBusy(true);
        try {
            const r = await fetch(`/api/workflows/${workflowId}/webhook`, { method: "POST" });
            if (!r.ok) throw new Error();
            setUrl(`${window.location.origin}${(await r.json()).path}`);
            showToast("New webhook URL generated", "success");
        } catch {
            showToast("Couldn't generate a new URL", "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-2 border-t border-border/50 pt-4">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Webhook URL</span>
            {!workflowId ? (
                <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">Save this workflow to get its webhook URL.</p>
            ) : !url ? (
                <div className="h-9 animate-pulse rounded-xl bg-muted" />
            ) : (
                <>
                    <div className="flex items-center gap-1.5">
                        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Webhook URL" className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2 font-mono text-[11.5px] outline-none focus:ring-2 focus:ring-foreground/15" />
                        <button onClick={copy} aria-label="Copy webhook URL" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground">
                            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button onClick={rotate} disabled={busy} aria-label="Generate a new URL" title="Generate a new URL" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">
                            <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
                        </button>
                    </div>
                    {isLive === false && <p className="rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">This workflow is paused, so the URL refuses calls until you turn it on (the Live switch in the header).</p>}
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Send a POST with a JSON body to run the <em>saved</em> version. Fields arrive as <code className="font-mono">{"{{input.field}}"}</code>. Keep this URL secret: anyone with it can trigger the workflow.
                    </p>
                </>
            )}
        </div>
    );
}

const fmtUtc = (d: Date) => d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }) + " UTC";
const fmtLocal = (d: Date) => d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });

/** What a Schedule trigger will really do, including whether anything is actually triggering schedules on this server. */
function ScheduleSection({ cron, timezone, workflowId, isLive }: { cron: string; timezone?: unknown; workflowId?: string | null; isLive?: boolean }) {
    const [status, setStatus] = useState<{ configured: boolean; lastTickAt: string | null; running: boolean } | null>(null);
    const [nowMs] = useState(() => Date.now());
    useEffect(() => {
        let live = true;
        fetch("/api/schedule/status")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => live && setStatus(d))
            .catch(() => {});
        return () => { live = false; };
    }, []);

    const error = checkCron(cron);
    const upcoming: Date[] = [];
    if (!error) {
        const spec = parseCron(cron);
        let at: Date | null = new Date();
        for (let i = 0; i < 3 && at; i++) { at = nextRun(spec, at); if (at) upcoming.push(at); }
    }
    const tz = typeof timezone === "string" ? timezone.trim() : "";
    const ago = status?.lastTickAt ? Math.max(0, Math.round((nowMs - new Date(status.lastTickAt).getTime()) / 60000)) : null;

    // The one honest sentence about whether this will fire
    let state: { tone: "ok" | "warn" | "bad"; text: string };
    if (error) state = { tone: "bad", text: error };
    else if (!workflowId) state = { tone: "warn", text: "Save this workflow to put it on this schedule." };
    else if (isLive === false) state = { tone: "warn", text: "Paused. Turn the workflow on (the Live switch in the header) to run on this schedule." };
    else if (!status) state = { tone: "warn", text: "Checking the scheduler…" };
    else if (!status.configured) state = { tone: "bad", text: "Not running: this server has no scheduler set up yet (CRON_SECRET is missing). See Scheduling in the README." };
    else if (!status.running) state = { tone: "bad", text: status.lastTickAt ? `Not running: the scheduler last checked in ${ago} min ago. Something needs to call /api/cron/tick every minute.` : "Not running: nothing has called the scheduler yet. Something needs to call /api/cron/tick every minute." };
    else state = { tone: "ok", text: `Active. The scheduler checked in ${ago === 0 ? "just now" : `${ago} min ago`}.` };

    const toneCls = { ok: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300", warn: "bg-amber-500/15 text-amber-800 dark:text-amber-300", bad: "bg-destructive/10 text-destructive" }[state.tone];

    return (
        <div className="space-y-2 border-t border-border/50 pt-4">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Schedule</span>
            <p className="text-sm font-medium">{error ? "Not a valid schedule" : describeCron(cron)}</p>
            {upcoming.length > 0 && (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {upcoming.map((d) => <li key={d.toISOString()}>{fmtUtc(d)} <span className="opacity-70">({fmtLocal(d)} your time)</span></li>)}
                </ul>
            )}
            <p className={cn("rounded-xl px-3 py-2 text-xs", toneCls)}>{state.text}</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
                Times are always UTC{tz && !/^(utc|gmt|z)$/i.test(tz) ? `, so the "${tz}" time zone setting is ignored` : ""}. Runs are at least 5 minutes apart. Each run uses the <em>saved</em> version.
            </p>
        </div>
    );
}
