import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public liveness check for uptime monitors and deploy smoke tests. Says only whether the app and its database answer:
// no versions, no configuration, nothing an outsider could learn from.
export async function GET() {
    try {
        await Promise.race([sql`SELECT 1`, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5_000))]);
        return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
    } catch {
        return NextResponse.json({ status: "degraded" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
}

export const HEAD = async () => (await GET()).status === 200 ? new Response(null, { status: 200 }) : new Response(null, { status: 503 });
