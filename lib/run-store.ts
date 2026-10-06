import { sql } from "@/lib/db";
import { RETENTION, shrinkSteps } from "@/lib/run-retention";
import type { StepResult } from "@/lib/engine/types";

export interface RunRecord {
    workflowId: string;
    userId: string;
    status: "success" | "failed";
    mode: "full" | "node" | "webhook" | "schedule";
    startedAt: string;
    durationMs: number;
    error?: string | null;
    steps: StepResult[];
}

/** Drop a workflow's runs that are too old or beyond the newest N. */
export async function pruneWorkflowRuns(workflowId: string): Promise<number> {
    const rows = await sql`
        DELETE FROM workflow_runs
        WHERE workflow_id = ${workflowId}
          AND (
            started_at < now() - make_interval(days => ${RETENTION.days})
            OR id IN (
                SELECT id FROM workflow_runs WHERE workflow_id = ${workflowId}
                ORDER BY started_at DESC OFFSET ${RETENTION.perWorkflow}
            )
          )
        RETURNING id`;
    return rows.length;
}

/**
 * Save a run (capped in size) and keep history bounded. Pruning costs a database round trip, so it runs on about one
 * save in five: history can briefly exceed the limit by a few runs, but can never grow without bound.
 */
export async function saveRun(run: RunRecord, pruneOdds = 0.2): Promise<string | undefined> {
    const { steps } = shrinkSteps(run.steps as any[]);
    const rows = await sql`
        INSERT INTO workflow_runs (workflow_id, user_id, status, mode, started_at, duration_ms, error, steps_json)
        VALUES (${run.workflowId}, ${run.userId}, ${run.status}, ${run.mode}, ${run.startedAt}, ${run.durationMs}, ${run.error ?? null}, ${JSON.stringify(steps)}::jsonb)
        RETURNING id`;
    if (Math.random() < pruneOdds) pruneWorkflowRuns(run.workflowId).catch((e) => console.error("Run pruning failed:", e?.message));
    return rows[0] ? String(rows[0].id) : undefined;
}

/** Everything the age limit or a deleted workflow makes obsolete, across all users. Called by the scheduler about hourly. */
export async function purgeExpiredRuns(): Promise<{ expired: number; orphaned: number }> {
    const expired = await sql`DELETE FROM workflow_runs WHERE started_at < now() - make_interval(days => ${RETENTION.days}) RETURNING id`;
    const orphaned = await sql`DELETE FROM workflow_runs r WHERE NOT EXISTS (SELECT 1 FROM workflows w WHERE w.id::text = r.workflow_id) RETURNING id`;
    return { expired: expired.length, orphaned: orphaned.length };
}
