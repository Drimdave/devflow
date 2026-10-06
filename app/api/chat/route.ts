import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateWorkflowJSON } from "@/lib/workflow-ai";
import { rateLimit } from "@/lib/limits";
import { readJson } from "@/lib/validate";

const MAX_MESSAGE_CHARS = 2000;
const MAX_CONTEXT_CHARS = 300_000; // the current workflow sent along for edits
const MAX_CONTEXT_NODES = 200;

export async function POST(request: NextRequest) {
    try {
        const reqHeaders = await headers();
        const session = await auth.api.getSession({ headers: reqHeaders });
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Each call spends model credits, so cap how fast one account can go
        const perMinute = await rateLimit(`chat:min:${session.user.id}`, 12, 60_000);
        const perHour = await rateLimit(`chat:hour:${session.user.id}`, 120, 60 * 60_000);
        if (!perMinute.ok || !perHour.ok) {
            const wait = Math.max(perMinute.retryAfterSec, perHour.retryAfterSec);
            return NextResponse.json({ error: `You're going a bit fast. Try again in ${wait}s.` }, { status: 429, headers: { "Retry-After": String(wait) } });
        }

        const body = await readJson(request, MAX_CONTEXT_CHARS + MAX_MESSAGE_CHARS + 1000);
        if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
        const { message, currentWorkflow } = body.value as { message?: unknown; currentWorkflow?: any };

        if (!message || typeof message !== "string" || !message.trim()) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }
        if (message.length > MAX_MESSAGE_CHARS) {
            return NextResponse.json({ error: `Keep your message under ${MAX_MESSAGE_CHARS} characters.` }, { status: 400 });
        }
        if (currentWorkflow !== undefined && currentWorkflow !== null) {
            if (!Array.isArray(currentWorkflow.nodes) || !Array.isArray(currentWorkflow.edges)) {
                return NextResponse.json({ error: "The workflow sent with this message isn't valid." }, { status: 400 });
            }
            if (currentWorkflow.nodes.length > MAX_CONTEXT_NODES || JSON.stringify(currentWorkflow).length > MAX_CONTEXT_CHARS) {
                return NextResponse.json({ error: "This workflow is too large to edit with chat." }, { status: 413 });
            }
        }

        const isEditMode = currentWorkflow && currentWorkflow.nodes && currentWorkflow.nodes.length > 0;

        // Build the user prompt — include existing workflow context if editing
        let userPrompt = message;
        if (isEditMode) {
            // Send full node data so the AI can faithfully preserve existing nodes
            const cleanNodes = currentWorkflow.nodes.map((n: any) => ({
                id: n.id,
                type: n.data?.type || n.data?.nodeType || n.type,
                label: n.data?.label || n.label,
                description: n.data?.description || n.description || "",
                position: n.position,
                data: n.data?.provider ? {
                    provider: n.data.provider,
                    resource: n.data.resource,
                    operation: n.data.operation,
                    parameters: n.data.parameters || {},
                } : (n.data?.config ?? n.data ?? {}),
            }));
            const cleanEdges = currentWorkflow.edges.map((e: any) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label || e.sourceHandle || null,
            }));

            userPrompt = `CURRENT WORKFLOW (you MUST include ALL of these nodes in your output, plus any new ones):\n${JSON.stringify({ nodes: cleanNodes, edges: cleanEdges }, null, 2)}\n\nUSER REQUEST: ${message}`;
        }

        const workflow = await generateWorkflowJSON(userPrompt);

        // SERVER-SIDE MERGE: If editing, ensure all original nodes are preserved
        if (isEditMode) {
            const aiNodeIds = new Set(workflow.nodes.map((n: any) => n.id));
            const originalNodes = currentWorkflow.nodes.map((n: any) => ({
                id: n.id,
                type: n.data?.type || n.data?.nodeType || n.type,
                label: n.data?.label || n.label,
                description: n.data?.description || n.description || "",
                position: n.position,
                data: n.data?.provider ? {
                    provider: n.data.provider,
                    resource: n.data.resource,
                    operation: n.data.operation,
                    parameters: n.data.parameters || {},
                } : (n.data?.config ?? n.data ?? {}),
            }));

            // Add back any original nodes the AI dropped
            for (const origNode of originalNodes) {
                if (!aiNodeIds.has(origNode.id)) {
                    workflow.nodes.push(origNode);
                }
            }

            // Preserve original edges that are still valid
            const aiEdgeKeys = new Set(workflow.edges.map((e: any) => `${e.source}->${e.target}`));
            const allNodeIds = new Set(workflow.nodes.map((n: any) => n.id));
            for (const origEdge of currentWorkflow.edges) {
                const key = `${origEdge.source}->${origEdge.target}`;
                if (!aiEdgeKeys.has(key) && allNodeIds.has(origEdge.source) && allNodeIds.has(origEdge.target)) {
                    workflow.edges.push({
                        id: origEdge.id,
                        source: origEdge.source,
                        target: origEdge.target,
                        label: origEdge.label || null,
                    });
                }
            }
        }

        return NextResponse.json({
            workflow,
            message: "Workflow generated successfully",
        });
    } catch (error: any) {
        console.error("Groq API Error:", error?.status, error?.message);
        // Never pass upstream error text to the browser: it can name the provider, the model and our limits
        const status = error?.status;
        if (status === 429) return NextResponse.json({ error: "The AI is busy right now. Please try again in a moment." }, { status: 503 });
        if (status === 413 || status === 400) return NextResponse.json({ error: "That request was too large or couldn't be understood. Try a shorter description." }, { status: 400 });
        return NextResponse.json({ error: "Couldn't generate that workflow. Please try again." }, { status: 500 });
    }
}
