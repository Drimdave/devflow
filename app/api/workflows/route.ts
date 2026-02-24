import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// GET /api/workflows — List all workflows
export async function GET() {
    try {
        const reqHeaders = await headers();
        const session = await auth.api.getSession({
            headers: reqHeaders
        });

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const workflows = await sql`
      SELECT id, name, description, is_active, created_at, updated_at, nodes_json
      FROM workflows
      WHERE user_id = ${session.user.id}
      ORDER BY updated_at DESC
    `;
        return NextResponse.json({ workflows });
    } catch (error) {
        console.error("Failed to fetch workflows:", error);
        return NextResponse.json(
            { error: "Failed to fetch workflows" },
            { status: 500 }
        );
    }
}

// POST /api/workflows — Save a new workflow
export async function POST(request: Request) {
    try {
        const reqHeaders = await headers();
        const session = await auth.api.getSession({
            headers: reqHeaders
        });

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, nodes, edges } = body;

        const result = await sql`
      INSERT INTO workflows (name, description, nodes_json, edges_json, user_id)
      VALUES (
        ${name || "Untitled Workflow"},
        ${description || ""},
        ${JSON.stringify(nodes)}::jsonb,
        ${JSON.stringify(edges)}::jsonb,
        ${session.user.id}
      )
      RETURNING id, name, description, is_active, created_at, updated_at
    `;

        return NextResponse.json({ workflow: result[0] }, { status: 201 });
    } catch (error) {
        console.error("Failed to save workflow:", error);
        return NextResponse.json(
            { error: "Failed to save workflow" },
            { status: 500 }
        );
    }
}
