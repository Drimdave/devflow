import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";
import { runWorkflow } from "@/lib/engine/run";
import { loadSecrets } from "@/lib/credentials";
import { emailGate } from "@/lib/email-quota";
import { nextScheduledRun } from "@/lib/schedule";
import { purgeExpiredRuns, saveRun } from "@/lib/run-store";

// The scheduler. Something outside the app must call this about once a minute (Vercel Cron, GitHub Actions, cron-job.org,
// a server's crontab...) with  Authorization: Bearer $CRON_SECRET. Each call runs every Live workflow whose schedule is due.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PER_TICK = 10;      // runs started per call; anything left over is still due and goes in the next call
const TIME_BUDGET_MS = 40_000; // stop starting new runs after this, leaving room to finish within maxDuration

function authorised(req: Request): boolean {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) return false;
    const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    const a = Buffer.from(given);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
}

async function tick(req: Request) {
    if (!process.env.CRON_SECRET?.trim()) {
        return NextResponse.json({ error: "The scheduler isn't set up on this server (CRON_SECRET is missing)." }, { status: 503 });
    }
    if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const started = Date.now();
    const due = await sql`
        SELECT id, user_id, nodes_json, edges_json, next_run_at
        FROM workflows
        WHERE is_active AND next_run_at IS NOT NULL AND next_run_at <= now()
        ORDER BY next_run_at
        LIMIT ${MAX_PER_TICK}`;

    let ran = 0, skipped = 0;
    for (const wf of due) {
        if (Date.now() - started > TIME_BUDGET_MS) break;
        const nodes = Array.isArray(wf.nodes_json) ? wf.nodes_json : [];
        const upcoming = nextScheduledRun(nodes, true, new Date());

        // Claim it by moving its due time into the future. Row updates are atomic: if another call already did this, the row
        // is no longer due, nothing matches here, and we leave it alone. That is what stops two overlapping ticks double-running it.
        const claimed = await sql`
            UPDATE workflows SET last_run_at = now(), next_run_at = ${upcoming?.toISOString() ?? null}
            WHERE id = ${wf.id} AND is_active AND next_run_at IS NOT NULL AND next_run_at <= now()
            RETURNING id`;
        if (claimed.length === 0) { skipped++; continue; }
        if (!upcoming) { skipped++; continue; } // its schedule was removed or broke since it became due: nothing to run

        try {
            const secrets = await loadSecrets(wf.user_id);
            const summary = await runWorkflow(nodes, Array.isArray(wf.edges_json) ? wf.edges_json : [], {
                start: "schedule",
                secrets,
                emailGate: () => emailGate(wf.user_id),
            });
            if (summary.steps.length > 0) {
                await saveRun({ workflowId: String(wf.id), userId: wf.user_id, status: summary.status, mode: "schedule", startedAt: summary.startedAt, durationMs: summary.durationMs, error: summary.error, steps: summary.steps });
            }
            ran++;
        } catch (err) {
            console.error("Scheduled run crashed:", err);
        }
    }

    // About once an hour: delete runs past the retention age, and runs whose workflow no longer exists
    let purged: { expired: number; orphaned: number } | undefined;
    try {
        const claim = await sql`
            UPDATE scheduler_heartbeat SET last_purge_at = now()
            WHERE id = 1 AND (last_purge_at IS NULL OR last_purge_at < now() - interval '1 hour') RETURNING id`;
        if (claim.length) purged = await purgeExpiredRuns();
    } catch (err) {
        console.error("Run purge failed:", err);
    }

    // A heartbeat lets the editor say whether a scheduler is really calling in
    await sql`
        INSERT INTO scheduler_heartbeat (id, last_tick_at, last_due, last_ran) VALUES (1, now(), ${due.length}, ${ran})
        ON CONFLICT (id) DO UPDATE SET last_tick_at = now(), last_due = ${due.length}, last_ran = ${ran}`;

    return NextResponse.json({ due: due.length, ran, skipped, ...(purged ? { purged } : {}), durationMs: Date.now() - started });
}

export const GET = tick;
export const POST = tick;
