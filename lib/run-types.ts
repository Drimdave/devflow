// Shapes the editor shares with /api/execute's SSE events (kept free of server imports).
export type NodeRunStatus = "idle" | "running" | "success" | "simulated" | "skipped" | "failed";

export interface NodeRunResult {
    nodeId: string;
    label: string;
    status: Exclude<NodeRunStatus, "idle" | "running">;
    output?: unknown;
    error?: string;
    note?: string;
    startedAt: string;
    durationMs: number;
}
