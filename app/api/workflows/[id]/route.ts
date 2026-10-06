import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/limits";
import { UUID_RE, parseWorkflowInput, readJson } from "@/lib/validate";
import { nextScheduledRun } from "@/lib/schedule";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workflows/:id — Load a specific workflow
export async function GET(request: Request, context: RouteContext) {
    try {
        const reqHeaders = await headers();
        const session = await auth.api.getSession({ headers: reqHeaders });
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;
        if (!UUID_RE.test(id)) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        const result = await sql`
      SELECT id, name, description, nodes_json, edges_json, is_active, created_at, updated_at, version
      FROM workflows
      WHERE id = ${id} AND user_id = ${session.user.id}
    `;

        if (result.length === 0) {
            return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        }

        return NextResponse.json({ workflow: result[0] });
    } catch (error) {
        console.error("Failed to load workflow:", error);
        return NextResponse.json(
            { error: "Failed to load workflow" },
            { status: 500 }
        );
    }
}

// PUT /api/workflows/:id — Update a workflow
export async function PUT(request: Request, context: RouteContext) {
    try {
        const reqHeaders = await headers();
        const session = await auth.api.getSession({ headers: reqHeaders });
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;
        if (!UUID_RE.test(id)) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        if (!(await rateLimit(`wf-write:${session.user.id}`, 60, 60_000)).ok) {
            return NextResponse.json({ error: "You're saving too fast. Try again in a moment." }, { status: 429 });
        }
        const body = await readJson(request);
        if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
        const parsed = parseWorkflowInput(body.value);
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
        const { name, description, nodes, edges, is_active, base_version } = parsed.value;

        // Pausing or resuming isn't an edit: it doesn't bump the version, so it can't cause a save conflict
        const contentChanged = name !== undefined || description !== undefined || nodes !== undefined || edges !== undefined;
        const result = await sql`
      UPDATE workflows SET
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        nodes_json = COALESCE(${nodes !== undefined ? JSON.stringify(nodes) : null}::jsonb, nodes_json),
        edges_json = COALESCE(${edges !== undefined ? JSON.stringify(edges) : null}::jsonb, edges_json),
        is_active = COALESCE(${is_active}, is_active),
        version = version + ${contentChanged ? 1 : 0},
        updated_at = now()
      WHERE id = ${id} AND user_id = ${session.user.id}
        AND (${base_version ?? null}::int IS NULL OR version = ${base_version ?? null}::int)
      RETURNING id, name, description, is_active, created_at, updated_at, version, nodes_json AS _nodes
    `;

        if (result.length === 0) {
            // Either it doesn't exist (or isn't yours), or someone saved a newer version in the meantime
            const current = await sql`SELECT version FROM workflows WHERE id = ${id} AND user_id = ${session.user.id}`;
            if (current.length === 0) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
            return NextResponse.json(
                { error: "This workflow was changed somewhere else since you opened it.", code: "conflict", current_version: current[0].version },
                { status: 409 }
            );
        }

        // Keep the scheduler's "next run" in step with the schedule and the Live/Paused switch
        const { _nodes, ...workflow } = result[0];
        if (nodes !== undefined || is_active !== undefined) {
            const next = nextScheduledRun(_nodes, workflow.is_active !== false);
            await sql`UPDATE workflows SET next_run_at = ${next?.toISOString() ?? null} WHERE id = ${id} AND user_id = ${session.user.id}`;
        }
        return NextResponse.json({ workflow });
    } catch (error) {
        console.error("Failed to update workflow:", error);
        return NextResponse.json(
            { error: "Failed to update workflow" },
            { status: 500 }
        );
    }
}

// DELETE /api/workflows/:id — Delete a workflow
export async function DELETE(request: Request, context: RouteContext) {
    try {
        const reqHeaders = await headers();
        const session = await auth.api.getSession({ headers: reqHeaders });
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;
        if (!UUID_RE.test(id)) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        const result = await sql`
      DELETE FROM workflows
      WHERE id = ${id} AND user_id = ${session.user.id}
      RETURNING id
    `;

        if (result.length === 0) {
            return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        }

        // Its run history goes with it: outputs can contain personal data, so they shouldn't outlive the workflow
        await sql`DELETE FROM workflow_runs WHERE workflow_id = ${id} AND user_id = ${session.user.id}`;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete workflow:", error);
        return NextResponse.json(
            { error: "Failed to delete workflow" },
            { status: 500 }
        );
    }
}
