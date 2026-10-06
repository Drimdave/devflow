import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/runs/:id: one run with its step-by-step results (owner only)
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    try {
        const rows = await sql`
            SELECT r.id, r.workflow_id, w.name AS workflow_name, r.status, r.mode, r.started_at, r.duration_ms, r.error, r.steps_json
            FROM workflow_runs r
            LEFT JOIN workflows w ON w.id::text = r.workflow_id
            WHERE r.id = ${id} AND r.user_id = ${session.user.id}`;
        if (!rows.length) return NextResponse.json({ error: "Run not found" }, { status: 404 });
        return NextResponse.json({ run: rows[0] });
    } catch (err) {
        console.error("Failed to load run:", err);
        return NextResponse.json({ error: "Failed to load run" }, { status: 500 });
    }
}
