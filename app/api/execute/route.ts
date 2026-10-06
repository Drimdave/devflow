import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { loadSecrets } from "@/lib/credentials";
import { emailGate } from "@/lib/email-quota";
import { rateLimit } from "@/lib/limits";
import { saveRun } from "@/lib/run-store";
import { runWorkflow } from "@/lib/engine/run";
import type { EngineEvent, RunSummary } from "@/lib/engine/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 1_000_000;

export async function POST(req: Request) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limit = await rateLimit(`run:${session.user.id}`, 30, 60_000);
    if (!limit.ok) {
        return NextResponse.json({ error: `Too many runs. Try again in ${limit.retryAfterSec}s.` }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Workflow is too large" }, { status: 413 });
    let body: any;
    try {
        body = JSON.parse(raw);
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { nodes, edges, nodeIdToRun, workflowId, input } = body ?? {};
    if (!Array.isArray(nodes) || nodes.length === 0) return NextResponse.json({ error: "No nodes provided" }, { status: 400 });
    if (edges !== undefined && !Array.isArray(edges)) return NextResponse.json({ error: "Invalid edges" }, { status: 400 });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            let closed = false;
            const send = (type: string, data: unknown) => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
                } catch {
                    closed = true; // client went away
                }
            };

            // Legacy event names are kept so the console and node badges keep working.
            const onEvent = (e: EngineEvent) => {
                if (e.type === "info") send("info", { message: e.message });
                else if (e.type === "log") send("log", { message: e.message, type: e.level, nodeId: e.nodeId });
                else if (e.type === "node-started") send("node-started", { nodeId: e.nodeId });
                else send("node-finished", { nodeId: e.result.nodeId, status: e.result.status, result: e.result });
            };

            let summary: RunSummary;
            try {
                const secrets = await loadSecrets(session.user.id);
                summary = await runWorkflow(nodes, edges, { input, secrets, emailGate: () => emailGate(session.user.id), onlyNodeId: typeof nodeIdToRun === "string" ? nodeIdToRun : undefined, onEvent });
            } catch (err: any) {
                console.error("Engine crashed:", err);
                summary = { status: "failed", steps: [], startedAt: new Date().toISOString(), durationMs: 0, error: "The engine hit an unexpected error" };
            }

            if (summary.status === "failed" && summary.error) send("error", { message: summary.error });
            else send("success", { message: `Run finished in ${(summary.durationMs / 1000).toFixed(1)}s` });

            // Save to run history (best effort; only for the owner's saved workflows)
            let runId: string | undefined;
            if (typeof workflowId === "string" && workflowId) {
                try {
                    const owned = await sql`SELECT id FROM workflows WHERE id::text = ${workflowId} AND user_id = ${session.user.id}`;
                    if (owned.length) {
                        runId = await saveRun({ workflowId, userId: session.user.id, status: summary.status, mode: typeof nodeIdToRun === "string" ? "node" : "full", startedAt: summary.startedAt, durationMs: summary.durationMs, error: summary.error, steps: summary.steps });
                    }
                } catch (err) {
                    console.error("Failed to save run:", err);
                }
            }

            send("workflow-complete", { status: summary.status, durationMs: summary.durationMs, error: summary.error, runId, steps: summary.steps.map((s) => ({ nodeId: s.nodeId, status: s.status })) });
            closed = true;
            try { controller.close(); } catch { /* already closed */ }
        },
    });

    return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
    });
}
