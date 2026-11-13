// Runs one due scheduled workflow and makes sure the outcome leaves a record, even when something outside the engine fails.
// Pure TypeScript with injected dependencies, so the failure paths are covered by the plain node test runner (no database).

import type { RunSummary, StepResult } from "./engine/types";

export interface ScheduledRunRecord {
    workflowId: string;
    userId: string;
    status: "success" | "failed";
    mode: "schedule";
    startedAt: string;
    durationMs: number;
    error?: string | null;
    steps: StepResult[];
}

/**
 * Shown in run history when the scheduler itself failed (database error while loading credentials or saving the result).
 * Steps may already have run (a message may have been sent), so the wording must not claim that nothing happened.
 */
export const LOST_RUN_MESSAGE =
    "The scheduler hit an internal error while running or recording this run. Some steps may have run, but the result was not saved. This run will not be retried; the next scheduled time is unaffected.";

export function lostRunRecord(wf: { id: unknown; user_id: string }, startedAtMs: number, nowMs: number): ScheduledRunRecord {
    return {
        workflowId: String(wf.id),
        userId: wf.user_id,
        status: "failed",
        mode: "schedule",
        startedAt: new Date(startedAtMs).toISOString(),
        durationMs: Math.max(0, nowMs - startedAtMs),
        error: LOST_RUN_MESSAGE,
        steps: [],
    };
}

export interface ScheduledRunDeps {
    loadSecrets: (userId: string) => Promise<Record<string, string>>;
    run: (secrets: Record<string, string>) => Promise<RunSummary>;
    saveRun: (record: ScheduledRunRecord) => Promise<unknown>;
    log: (message: string, err: unknown) => void;
    now?: () => number;
}

/**
 * "ran": the engine finished (its own failures are results, not losses) and the result was saved.
 * "lost": something outside the engine threw. A failed run is recorded in history so the loss is visible.
 */
export async function executeScheduledRun(wf: { id: unknown; user_id: string }, deps: ScheduledRunDeps): Promise<"ran" | "lost"> {
    const now = deps.now ?? Date.now;
    const started = now();
    try {
        const secrets = await deps.loadSecrets(wf.user_id);
        const summary = await deps.run(secrets);
        // A run that failed before any step started (a loop, duplicate ids, too many nodes) has no steps but is still a failure to show
        if (summary.steps.length > 0 || summary.status === "failed") {
            await deps.saveRun({
                workflowId: String(wf.id),
                userId: wf.user_id,
                status: summary.status,
                mode: "schedule",
                startedAt: summary.startedAt,
                durationMs: summary.durationMs,
                error: summary.error,
                steps: summary.steps,
            });
        }
        return "ran";
    } catch (err) {
        deps.log("Scheduled run crashed", err);
        try {
            await deps.saveRun(lostRunRecord(wf, started, now()));
        } catch (err2) {
            deps.log("Could not record the lost scheduled run", err2); // the database itself is probably down
        }
        return "lost";
    }
}
