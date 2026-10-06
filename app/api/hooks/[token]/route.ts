import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { loadSecrets } from "@/lib/credentials";
import { emailGate } from "@/lib/email-quota";
import { clientIp } from "@/lib/rate-limit";
import { rateLimit } from "@/lib/limits";
import { saveRun } from "@/lib/run-store";
import { runWorkflow } from "@/lib/engine/run";

// Public endpoint: anyone holding a workflow's secret URL can trigger it.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 100_000;
type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: Request, context: RouteContext) {
    const { token } = await context.params;
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Throttle by caller first (cheap, before touching the DB), then per workflow
    const ip = clientIp(req);
    const byIp = await rateLimit(`hook-ip:${ip}`, 60, 60_000);
    if (!byIp.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(byIp.retryAfterSec) } });

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large (100 KB max)" }, { status: 413 });

    const rows = await sql`SELECT id, user_id, is_active, nodes_json, edges_json FROM workflows WHERE webhook_token = ${token}`;
    const wf = rows[0];
    if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // A paused workflow doesn't respond to its webhook
    if (wf.is_active === false) return NextResponse.json({ error: "This workflow is paused. Turn it on to receive webhooks." }, { status: 409 });

    const byToken = await rateLimit(`hook:${token}`, 20, 60_000);
    if (!byToken.ok) return NextResponse.json({ error: "This webhook is being called too fast" }, { status: 429, headers: { "Retry-After": String(byToken.retryAfterSec) } });

    // JSON bodies become the trigger payload ({{input.field}}); anything else arrives as { body: "<text>" }
    let input: unknown = {};
    if (raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            input = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { body: parsed };
        } catch {
            input = { body: raw };
        }
    }

    let summary;
    try {
        summary = await runWorkflow(Array.isArray(wf.nodes_json) ? wf.nodes_json : [], Array.isArray(wf.edges_json) ? wf.edges_json : [], { start: "webhook", input, secrets: await loadSecrets(wf.user_id), emailGate: () => emailGate(wf.user_id) });
    } catch (err) {
        console.error("Webhook run crashed:", err);
        return NextResponse.json({ error: "The workflow couldn't run" }, { status: 500 });
    }

    let runId: string | undefined;
    try {
        if (summary.steps.length === 0) throw new Error("nothing ran"); // e.g. no Webhook trigger: don't record an empty run
        runId = await saveRun({ workflowId: String(wf.id), userId: wf.user_id, status: summary.status, mode: "webhook", startedAt: summary.startedAt, durationMs: summary.durationMs, error: summary.error, steps: summary.steps });
    } catch (err) {
        if ((err as Error).message !== "nothing ran") console.error("Failed to save webhook run:", err);
    }

    return NextResponse.json(
        {
            status: summary.status,
            runId,
            durationMs: summary.durationMs,
            ...(summary.error ? { error: summary.error } : {}),
            steps: summary.steps.map((s) => ({ node: s.label, status: s.status })),
        },
        { status: summary.status === "success" ? 200 : 422 }
    );
}

export async function GET() {
    return NextResponse.json({ error: "Send a POST request with a JSON body" }, { status: 405, headers: { Allow: "POST" } });
}
