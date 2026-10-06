import { executeNode, ExecError, kindOf } from "./executors";
import { makeRedactor } from "./redact";
import { pickTrigger, type RunStart } from "./triggers";
import {
    DEFAULT_LIMITS,
    type EngineEdge,
    type EngineEvent,
    type EngineNode,
    type NodeKind,
    type RunContext,
    type RunLimits,
    type RunSummary,
    type StepResult,
} from "./types";

export interface RunOptions {
    /** Payload for the trigger (otherwise its sample data is used). */
    input?: unknown;
    /** What started this run: picks which trigger fires. Defaults to a manual run (the Run button). */
    start?: RunStart;
    /** Run just this node, with an empty upstream. */
    onlyNodeId?: string;
    limits?: Partial<RunLimits>;
    /** Decrypted credentials for {{secrets.NAME}}. Values are scrubbed from everything the run reports. */
    secrets?: Record<string, string>;
    /** Account-level email quota; return a message to block sending, or null. */
    emailGate?: () => string | null | Promise<string | null>;
    onEvent?: (event: EngineEvent) => void;
}

const KINDS: NodeKind[] = ["trigger", "action", "logic", "data"];

/** Accepts React Flow nodes ({id, data:{label,type,config}}) or already-flat nodes. */
export function normalizeNodes(raw: any[]): EngineNode[] {
    return raw.filter((n) => n && typeof n === "object" && n.id !== undefined && n.id !== null).map((n) => {
        const d = n?.data ?? n ?? {};
        const type = KINDS.includes(d.type) ? d.type : KINDS.includes(n?.type) ? n.type : "action";
        return {
            id: String(n.id),
            type,
            label: String(d.label ?? n.label ?? n.id),
            config: d.config && typeof d.config === "object" ? d.config : {},
        };
    });
}

export function normalizeEdges(raw: any[] | undefined): EngineEdge[] {
    return (raw ?? []).filter((e) => e && typeof e === "object" && e.source !== undefined && e.target !== undefined).map((e) => {
        const h = String(e.sourceHandle ?? e.branch ?? e.label ?? "").toLowerCase();
        const branch = h === "true" || h === "yes" ? "true" : h === "false" || h === "no" ? "false" : null;
        const raw = e.sourceHandle ?? e.branch ?? e.label;
        return { source: String(e.source), target: String(e.target), branch, handle: raw === undefined || raw === null || raw === "" ? null : String(raw) };
    });
}

/** Kahn's algorithm over the nodes reachable from `starts`. Returns null if there is a cycle. */
function topoOrder(nodes: EngineNode[], edges: EngineEdge[]): string[] | null {
    const ids = new Set(nodes.map((n) => n.id));
    const indeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    for (const e of edges) if (ids.has(e.source) && ids.has(e.target)) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
    const order: string[] = [];
    while (queue.length) {
        const id = queue.shift()!;
        order.push(id);
        for (const e of edges) {
            if (e.source !== id || !ids.has(e.target)) continue;
            const left = (indeg.get(e.target) ?? 0) - 1;
            indeg.set(e.target, left);
            if (left === 0) queue.push(e.target);
        }
    }
    return order.length === nodes.length ? order : null;
}

const MAX_OUTPUT_CHARS = 20_000;

/** Keep what the UI/DB stores bounded. */
export function clipOutput(v: unknown): unknown {
    if (v === undefined) return undefined;
    let s: string;
    try { s = JSON.stringify(v); } catch { return String(v).slice(0, MAX_OUTPUT_CHARS); }
    if (s === undefined || s.length <= MAX_OUTPUT_CHARS) return v;
    return { truncated: true, preview: s.slice(0, MAX_OUTPUT_CHARS) };
}

export async function runWorkflow(rawNodes: any[], rawEdges: any[] | undefined, opts: RunOptions = {}): Promise<RunSummary> {
    const redact = makeRedactor(opts.secrets ?? {});
    const emitRaw = opts.onEvent ?? (() => {});
    const emit = (e: EngineEvent) => emitRaw(redact.any(e));
    const limits: RunLimits = { ...DEFAULT_LIMITS, ...opts.limits };
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const fail = (error: string, steps: StepResult[] = []): RunSummary => ({ status: "failed", steps, startedAt, durationMs: Date.now() - started, error });

    const all = normalizeNodes(rawNodes);
    const byKind = new Map(all.map((n) => [n.id, kindOf(n)]));
    // Edges leaving a Switch carry their case name; for everything else only Yes/No mean a branch
    const edges = normalizeEdges(rawEdges).map((e) => (byKind.get(e.source) === "switch" ? { ...e, branch: e.handle ?? null } : e));
    if (all.length === 0) return fail("There are no nodes to run");
    if (all.length > limits.maxNodes) return fail(`A workflow can have at most ${limits.maxNodes} nodes`);

    const byId = new Map(all.map((n) => [n.id, n]));
    const warnings: string[] = [];
    const ctx: RunContext = {
        input: opts.input ?? {},
        triggerInput: opts.input,
        outputs: {},
        deadline: started + limits.totalTimeoutMs,
        limits,
        counters: { http: 0, llm: 0, email: 0 },
        emailGate: opts.emailGate,
        secrets: opts.secrets ?? {},
        warnings,
        log: (message, level = "info") => emit({ type: "log", message, level }),
    };

    let nodes = all;
    let runEdges = edges;
    let starterId: string | undefined;
    if (opts.onlyNodeId) {
        const only = byId.get(opts.onlyNodeId);
        if (!only) return fail(`Node ${opts.onlyNodeId} not found`);
        nodes = [only];
        runEdges = [];
        emit({ type: "info", message: `Running just "${only.label}"` });
    } else {
        const triggers = all.filter((n) => n.type === "trigger");
        if (triggers.length === 0) return fail("This workflow has no trigger node. Add one to start it.");
        const chosen = pickTrigger(triggers, opts.start ?? "manual");
        if (!chosen) return fail(`This workflow has no ${opts.start === "schedule" ? "Schedule" : "Webhook"} trigger to start it.`);
        starterId = chosen.id;
        emit({ type: "info", message: triggers.length > 1 ? `Starting run from "${chosen.label}"` : "Starting run" });
    }

    if (new Set(nodes.map((n) => n.id)).size !== nodes.length) return fail("Two nodes share the same id. Remove or re-add one of them.");
    const order = topoOrder(nodes, runEdges);
    if (!order) return fail("This workflow has a loop. Connections must flow one way.");

    const incoming = new Map<string, EngineEdge[]>();
    for (const e of runEdges) incoming.set(e.target, [...(incoming.get(e.target) ?? []), e]);
    const chosen = new Map<string, string>(); // logic node -> branch it took
    const reached = new Set<string>();
    const steps: StepResult[] = [];
    let failure: string | undefined;

    const record = (r: StepResult) => {
        const safe = redact.any(r);
        steps.push(safe);
        emit({ type: "node-finished", result: safe });
    };

    for (const id of order) {
        const node = byId.get(id)!;
        const t0 = Date.now();
        const base = { nodeId: id, label: node.label, startedAt: new Date(t0).toISOString() };

        // Is this node live? Triggers (and the isolated node) always are; others need a live parent edge.
        const isOtherTrigger = node.type === "trigger" && !opts.onlyNodeId && node.id !== starterId;
        const parentEdges = incoming.get(id) ?? [];
        const live = isOtherTrigger
            ? false
            : node.type === "trigger" || !!opts.onlyNodeId
            ? true
            : parentEdges.some((e) => {
                if (!reached.has(e.source)) return false;
                const src = byId.get(e.source)!;
                if (src.type !== "logic" || e.branch === null) return true;
                return chosen.get(e.source)?.toLowerCase() === e.branch.toLowerCase();
            });

        if (!live || failure) {
            // Say WHY it didn't run: a branch not taken reads differently from a path that no trigger of this run reaches
            const branchNotTaken = parentEdges.some((e) => reached.has(e.source) && byId.get(e.source)?.type === "logic" && e.branch !== null);
            const note = failure
                ? "Not run because an earlier step failed"
                : isOtherTrigger
                ? `Not the trigger that started this run${starterId ? ` (it started from "${byId.get(starterId)?.label}")` : ""}`
                : !parentEdges.length
                ? "Not connected to a trigger"
                : branchNotTaken
                ? "Skipped: the other branch was taken"
                : "Not reached in this run";
            record({ ...base, status: "skipped", note, durationMs: 0 });
            continue;
        }

        emit({ type: "node-started", nodeId: id });
        const parents = (incoming.get(id) ?? []).filter((e) => reached.has(e.source));
        ctx.previous = parents.length ? ctx.outputs[parents[parents.length - 1].source] : undefined;
        if (node.type === "trigger" && ctx.input && typeof ctx.input === "object" && !Object.keys(ctx.input as object).length) ctx.input = {};

        try {
            if (Date.now() >= ctx.deadline) throw new ExecError(`The run exceeded ${Math.round(limits.totalTimeoutMs / 1000)}s`);
            const res = await executeNode(node, ctx);
            // Later nodes only ever see scrubbed data, so a remote service echoing a credential back can't smuggle it onward
            const safeOutput = redact.any(res.output);
            ctx.outputs[id] = safeOutput;
            if (node.type === "trigger" && !opts.onlyNodeId) ctx.input = safeOutput;
            if (res.branch) chosen.set(id, res.branch);
            reached.add(id);
            const status = res.status ?? "success";
            record({ ...base, status, output: clipOutput(res.output), note: res.note, durationMs: Date.now() - t0 });
            emit({ type: "log", nodeId: id, level: status === "simulated" ? "warning" : "success", message: `${node.label}: ${res.note ?? (status === "success" ? "done" : status)}` });
        } catch (e: any) {
            const message = e?.message || "Step failed";
            failure = `${node.label}: ${message}`;
            const output = e instanceof ExecError ? clipOutput(e.output) : undefined;
            record({ ...base, status: "failed", error: message, output, durationMs: Date.now() - t0 });
            emit({ type: "log", nodeId: id, level: "error", message: failure });
        }
    }

    for (const w of new Set(warnings)) emit({ type: "log", level: "warning", message: w });
    return { status: failure ? "failed" : "success", steps, startedAt, durationMs: Date.now() - started, ...(failure ? { error: redact.str(failure) } : {}) };
}
