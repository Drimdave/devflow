import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEALTHY_WITHIN_MS = 3 * 60_000; // a scheduler calling once a minute should never be this quiet

// GET /api/schedule/status: is anything actually triggering scheduled workflows on this server?
export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const configured = !!process.env.CRON_SECRET?.trim();
    const rows = await sql`SELECT last_tick_at FROM scheduler_heartbeat WHERE id = 1`;
    const last = rows[0]?.last_tick_at ? new Date(rows[0].last_tick_at) : null;
    return NextResponse.json({
        configured,
        lastTickAt: last?.toISOString() ?? null,
        running: !!last && Date.now() - last.getTime() < HEALTHY_WITHIN_MS,
    });
}
