import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";
import { UUID_RE } from "@/lib/validate";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

const newToken = () => randomBytes(24).toString("base64url");

async function owner(id: string) {
    if (!UUID_RE.test(id)) return null;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    const rows = await sql`SELECT webhook_token FROM workflows WHERE id::text = ${id} AND user_id = ${session.user.id}`;
    return rows[0] ?? null;
}

// GET /api/workflows/:id/webhook: this workflow's webhook path, created on first use
export async function GET(_req: Request, context: RouteContext) {
    const { id } = await context.params;
    const row = await owner(id);
    if (!row) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    let token: string | null = row.webhook_token;
    if (!token) {
        token = newToken();
        await sql`UPDATE workflows SET webhook_token = ${token} WHERE id::text = ${id}`;
    }
    return NextResponse.json({ path: `/api/hooks/${token}` });
}

// POST /api/workflows/:id/webhook: rotate the token (the old URL stops working immediately)
export async function POST(_req: Request, context: RouteContext) {
    const { id } = await context.params;
    const row = await owner(id);
    if (!row) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    const token = newToken();
    await sql`UPDATE workflows SET webhook_token = ${token} WHERE id::text = ${id}`;
    return NextResponse.json({ path: `/api/hooks/${token}` });
}
