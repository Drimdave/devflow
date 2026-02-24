import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
        const result = await sql`
      SELECT id, name, description, nodes_json, edges_json, is_active, created_at, updated_at
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
        const body = await request.json();
        const { name, description, nodes, edges, is_active } = body;

        const result = await sql`
      UPDATE workflows SET
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        nodes_json = COALESCE(${nodes ? JSON.stringify(nodes) : null}::jsonb, nodes_json),
        edges_json = COALESCE(${edges ? JSON.stringify(edges) : null}::jsonb, edges_json),
        is_active = COALESCE(${is_active}, is_active),
        user_id = ${session.user.id},
        updated_at = now()
      WHERE id = ${id} AND user_id = ${session.user.id}
      RETURNING id, name, description, is_active, created_at, updated_at
    `;

        if (result.length === 0) {
            return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        }

        return NextResponse.json({ workflow: result[0] });
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
        const result = await sql`
      DELETE FROM workflows
      WHERE id = ${id} AND user_id = ${session.user.id}
      RETURNING id
    `;

        if (result.length === 0) {
            return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete workflow:", error);
        return NextResponse.json(
            { error: "Failed to delete workflow" },
            { status: 500 }
        );
    }
}
