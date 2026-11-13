import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";
import { schedulerHealth } from "@/lib/schedule-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/schedule/status: is anything actually triggering scheduled workflows on this server?
export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const configured = !!process.env.CRON_SECRET?.trim();
    const rows = await sql`SELECT last_tick_at, last_due, last_ran FROM scheduler_heartbeat WHERE id = 1`;
    const last = rows[0]?.last_tick_at ? new Date(rows[0].last_tick_at) : null;
    const health = schedulerHealth(last, Date.now());
    return NextResponse.json({
        configured,
        lastTickAt: last?.toISOString() ?? null,
        running: health.running,
        minutesAgo: health.minutesAgo,
        // What the last call found due and how many it ran. Fewer ran than due means a run was skipped, delayed or lost; see Runs.
        lastDue: rows[0] ? Number(rows[0].last_due) : null,
        lastRan: rows[0] ? Number(rows[0].last_ran) : null,
    });
}
