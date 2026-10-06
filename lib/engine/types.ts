// Core types for the DevFlow execution engine. Pure TypeScript, no framework imports,
// so it can be tested on its own and run anywhere Node runs.

export type NodeKind = "trigger" | "action" | "logic" | "data";

export interface EngineNode {
    id: string;
    type: NodeKind;
    label: string;
    config: Record<string, any>;
}

export interface EngineEdge {
    source: string;
    target: string;
    /** Which output of a logic node this edge leaves from: "true"/"false" for If/Else, a case name for Switch. */
    branch: string | null;
    /** The raw handle or label the edge was saved with. */
    handle?: string | null;
}

/**
 * success   - really did what it says
 * simulated - no real integration exists for this node yet; nothing external happened
 * skipped   - not reached (other branch, or not connected to a trigger)
 * failed    - threw or returned an error
 */
export type StepStatus = "success" | "simulated" | "skipped" | "failed";

export interface StepResult {
    nodeId: string;
    label: string;
    status: StepStatus;
    output?: unknown;
    error?: string;
    /** Human explanation (why simulated / skipped, or what a node did). */
    note?: string;
    startedAt: string;
    durationMs: number;
}

export type RunStatus = "success" | "failed";

export interface RunSummary {
    status: RunStatus;
    steps: StepResult[];
    startedAt: string;
    durationMs: number;
    error?: string;
}

export type EngineEvent =
    | { type: "info"; message: string }
    | { type: "log"; message: string; level: "info" | "success" | "warning" | "error"; nodeId?: string }
    | { type: "node-started"; nodeId: string }
    | { type: "node-finished"; result: StepResult };

export interface RunLimits {
    maxNodes: number;
    totalTimeoutMs: number;
    maxHttpCalls: number;
    maxLlmCalls: number;
    maxEmails: number;
}

export const DEFAULT_LIMITS: RunLimits = {
    maxNodes: 50,
    totalTimeoutMs: 30_000,
    maxHttpCalls: 10,
    maxLlmCalls: 5,
    maxEmails: 3,
};

/** What an executor hands back to the runner. */
export interface ExecResult {
    output: unknown;
    status?: "success" | "simulated";
    note?: string;
    /** Logic nodes: which way to go. */
    branch?: string;
}

/** Everything an executor can see while a run is in progress. */
export interface RunContext {
    /** Output of the first trigger (also reachable as {{input}}). */
    input: unknown;
    /** Payload the user supplied for this run, if any (a trigger outputs this instead of its sample). */
    triggerInput?: unknown;
    /** Output of the node that fed this one. */
    previous?: unknown;
    /** Outputs of finished nodes, keyed by node id. */
    outputs: Record<string, unknown>;
    deadline: number;
    limits: RunLimits;
    counters: { http: number; llm: number; email: number };
    /** Account-level gate checked before each real email. Returns a reason to refuse, or null to allow. */
    emailGate?: () => string | null | Promise<string | null>;
    /** The user's saved credentials, referenced as {{secrets.NAME}}. Never shown, logged or stored. */
    secrets: Record<string, string>;
    warnings: string[];
    log: (message: string, level?: "info" | "success" | "warning" | "error") => void;
}
