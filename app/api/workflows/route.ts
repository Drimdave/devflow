import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/limits";
import { LIMITS, parseWorkflowInput, readJson } from "@/lib/validate";
import { nextScheduledRun } from "@/lib/schedule";

// GET /api/workflows: the user's workflows. By default each graph is a small preview (first 12 nodes, labels only) so
// lists stay fast; pass ?full=1 to get complete graphs (used by "export everything").
export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const full = new URL(request.url).searchParams.get("full") === "1";

        const workflows = full
            ? await sql`
                SELECT id, name, description, is_active, created_at, updated_at, version, next_run_at, nodes_json, edges_json,
                       CASE WHEN jsonb_typeof(nodes_json) = 'array' THEN jsonb_array_length(nodes_json) ELSE 0 END AS node_count
                FROM workflows WHERE user_id = ${session.user.id} ORDER BY updated_at DESC`
            : await sql`
                SELECT id, name, description, is_active, created_at, updated_at, version, next_run_at,
                  CASE WHEN jsonb_typeof(nodes_json) = 'array' THEN jsonb_array_length(nodes_json) ELSE 0 END AS node_count,
                  CASE WHEN jsonb_typeof(nodes_json) = 'array' THEN (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'id', s.n->'id', 'type', s.n->'type',
                      'data', jsonb_build_object('type', s.n#>'{data,type}', 'label', left(COALESCE(s.n#>>'{data,label}', s.n->>'label', ''), 60))
                    ) ORDER BY s.i), '[]'::jsonb)
                    FROM (SELECT n, i FROM jsonb_array_elements(nodes_json) WITH ORDINALITY AS t(n, i) ORDER BY i LIMIT 12) s
                  ) ELSE '[]'::jsonb END AS nodes_json,
                  CASE WHEN jsonb_typeof(edges_json) = 'array' THEN (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object('source', s.e->'source', 'target', s.e->'target') ORDER BY s.i), '[]'::jsonb)
                    FROM (SELECT e, i FROM jsonb_array_elements(edges_json) WITH ORDINALITY AS t(e, i) ORDER BY i LIMIT 80) s
                  ) ELSE '[]'::jsonb END AS edges_json
                FROM workflows WHERE user_id = ${session.user.id} ORDER BY updated_at DESC`;
        return NextResponse.json({ workflows });
    } catch (error) {
        console.error("Failed to fetch workflows:", error);
        return NextResponse.json(
            { error: "Failed to fetch workflows" },
            { status: 500 }
        );
    }
}

// POST /api/workflows: save a new workflow
export async function POST(request: Request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!(await rateLimit(`wf-write:${session.user.id}`, 60, 60_000)).ok) {
            return NextResponse.json({ error: "You're saving too fast. Try again in a moment." }, { status: 429 });
        }

        const body = await readJson(request);
        if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
        const parsed = parseWorkflowInput(body.value);
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
        const { name, description, nodes, edges } = parsed.value;

        const [{ n }] = await sql`SELECT count(*)::int AS n FROM workflows WHERE user_id = ${session.user.id}`;
        if (n >= LIMITS.workflowsPerUser) {
            return NextResponse.json({ error: `You can keep up to ${LIMITS.workflowsPerUser} workflows. Delete some to make room.` }, { status: 400 });
        }

        const result = await sql`
      INSERT INTO workflows (name, description, nodes_json, edges_json, user_id, next_run_at)
      VALUES (
        ${name || "Untitled Workflow"},
        ${description || ""},
        ${JSON.stringify(nodes ?? [])}::jsonb,
        ${JSON.stringify(edges ?? [])}::jsonb,
        ${session.user.id},
        ${nextScheduledRun(nodes ?? [], true)?.toISOString() ?? null}
      )
      RETURNING id, name, description, is_active, created_at, updated_at, version
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
