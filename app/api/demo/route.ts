import { NextRequest, NextResponse } from "next/server";
import { generateWorkflowJSON } from "@/lib/workflow-ai";
import { sanitizeDemoGraph } from "@/lib/demo-graph";
import { clientIp } from "@/lib/rate-limit";
import { rateLimit } from "@/lib/limits";

export const dynamic = "force-dynamic";

const MIN_PROMPT = 8;
const MAX_PROMPT = 240;
const PER_IP_LIMIT = 6; // generations per IP per hour
const GLOBAL_LIMIT = 400; // generations per day across all visitors

function titleFrom(prompt: string): string {
    const t = prompt.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
    const cut = t.length > 34 ? `${t.slice(0, 33).trimEnd()}…` : t;
    return cut.charAt(0).toUpperCase() + cut.slice(1);
}

// Public, unauthenticated. Everything here is about keeping it cheap and safe:
// tight input limits, per-IP and global rate limits, a capped output budget, and the
// model's reply is reduced to a tiny sanitized graph before it leaves the server.
export async function POST(req: NextRequest) {
    if (!process.env.GROQ_API_KEY) {
        return NextResponse.json({ error: "unavailable", message: "The live demo is offline right now." }, { status: 503 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "bad_request", message: "Invalid request." }, { status: 400 });
    }

    const prompt = typeof body?.prompt === "string" ? body.prompt.replace(/\s+/g, " ").trim() : "";
    if (prompt.length < MIN_PROMPT) {
        return NextResponse.json({ error: "bad_request", message: "Describe what you want to automate in a few words." }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT) {
        return NextResponse.json({ error: "bad_request", message: `Keep it under ${MAX_PROMPT} characters for the demo.` }, { status: 400 });
    }

    const ip = await rateLimit(`demo:ip:${clientIp(req)}`, PER_IP_LIMIT, 60 * 60 * 1000);
    if (!ip.ok) {
        return NextResponse.json(
            { error: "rate_limited", message: "You've used the demo's free tries for now. Sign up to keep building." },
            { status: 429, headers: { "Retry-After": String(ip.retryAfterSec) } }
        );
    }
    const all = await rateLimit("demo:global", GLOBAL_LIMIT, 24 * 60 * 60 * 1000);
    if (!all.ok) {
        return NextResponse.json(
            { error: "rate_limited", message: "The demo is busy today. Sign up to build your own." },
            { status: 429, headers: { "Retry-After": String(all.retryAfterSec) } }
        );
    }

    try {
        const raw = await generateWorkflowJSON(
            `DEMO MODE. Build a small workflow of 3 to 5 nodes, with exactly one trigger as the first node. ` +
            `Use short labels (max 4 words) and short descriptions (max 8 words). ` +
            `Also add a top-level "name" field: a title for the workflow, max 4 words. ` +
            `Set data.provider to the lowercase service name when there is one (slack, gmail, github, openai, http, sheets, discord, stripe, schedule, webhook).\n\n` +
            `USER REQUEST: ${prompt}`,
            { maxTokens: 4096 }
        );

        const graph = sanitizeDemoGraph(raw, titleFrom(prompt));
        if (!graph) {
            return NextResponse.json({ error: "bad_output", message: "That one didn't come out right. Try rephrasing it." }, { status: 502 });
        }
        return NextResponse.json({ graph });
    } catch (err) {
        console.error("Demo generation failed:", err);
        return NextResponse.json({ error: "failed", message: "Couldn't draft that one. Please try again." }, { status: 502 });
    }
}
