import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/limits";
import { UUID_RE } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/runs?workflowId=&status=&limit=: the signed-in user's recent runs (no step payloads)
export async function GET(req: Request) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const workflowId = url.searchParams.get("workflowId");
    const status = url.searchParams.get("status");
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 100);

    try {
        const runs = await sql`
            SELECT r.id, r.workflow_id, w.name AS workflow_name, r.status, r.mode, r.started_at, r.duration_ms, r.error,
                   jsonb_array_length(r.steps_json) AS step_count,
                   (SELECT count(*)::int FROM jsonb_array_elements(r.steps_json) s WHERE s->>'status' = 'simulated') AS simulated_count
            FROM workflow_runs r
            LEFT JOIN workflows w ON w.id::text = r.workflow_id
            WHERE r.user_id = ${session.user.id}
              AND (${workflowId}::text IS NULL OR r.workflow_id = ${workflowId})
              AND (${status}::text IS NULL OR r.status = ${status})
            ORDER BY r.started_at DESC
            LIMIT ${limit}`;
        return NextResponse.json({ runs });
    } catch (err) {
        console.error("Failed to list runs:", err);
        return NextResponse.json({ error: "Failed to load runs" }, { status: 500 });
    }
}

// DELETE /api/runs[?workflowId=]: clear the signed-in user's run history (all of it, or one workflow's)
export async function DELETE(req: Request) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await rateLimit(`runs-clear:${session.user.id}`, 10, 60_000)).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const workflowId = new URL(req.url).searchParams.get("workflowId");
    if (workflowId !== null && !UUID_RE.test(workflowId)) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

    const rows = workflowId
        ? await sql`DELETE FROM workflow_runs WHERE user_id = ${session.user.id} AND workflow_id = ${workflowId} RETURNING id`
        : await sql`DELETE FROM workflow_runs WHERE user_id = ${session.user.id} RETURNING id`;
    return NextResponse.json({ deleted: rows.length });
}
