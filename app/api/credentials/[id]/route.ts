import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/limits";
import { encryptSecret } from "@/lib/secrets-crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

// PUT /api/credentials/:id { value?, description? }: replace the value and/or the note (the name is fixed)
export async function PUT(req: Request, { params }: Ctx) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await rateLimit(`cred:${session.user.id}`, 30, 60_000)).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const value = typeof body?.value === "string" && body.value !== "" ? body.value : null;
    const description = typeof body?.description === "string" ? body.description.trim().slice(0, 200) : null;
    if (value !== null && (value.length < 6 || value.length > 4000)) return NextResponse.json({ error: "Value must be 6-4000 characters" }, { status: 400 });

    const rows = await sql`
        UPDATE credentials SET
            description = COALESCE(${description}, description),
            hint = COALESCE(${value ? value.slice(-4) : null}, hint),
            value_enc = COALESCE(${value ? encryptSecret(value) : null}, value_enc),
            updated_at = now()
        WHERE id = ${id} AND user_id = ${session.user.id}
        RETURNING id, name, description, hint, created_at, updated_at`;
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ credential: rows[0] });
}

// DELETE /api/credentials/:id
export async function DELETE(_req: Request, { params }: Ctx) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const rows = await sql`DELETE FROM credentials WHERE id = ${id} AND user_id = ${session.user.id} RETURNING id`;
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
