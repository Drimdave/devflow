import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/limits";
import { CREDENTIAL_NAME, encryptSecret } from "@/lib/secrets-crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CREDENTIALS = 50;
const MIN_VALUE = 6;
const MAX_VALUE = 4000;

// GET /api/credentials: names and hints only. Values never leave the server.
export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const credentials = await sql`
        SELECT id, name, description, hint, created_at, updated_at FROM credentials
        WHERE user_id = ${session.user.id} ORDER BY name`;
    return NextResponse.json({ credentials });
}

// POST /api/credentials { name, value, description? }
export async function POST(req: Request) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limit = await rateLimit(`cred:${session.user.id}`, 30, 60_000);
    if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const name = typeof body?.name === "string" ? body.name.trim().toUpperCase() : "";
    const value = typeof body?.value === "string" ? body.value : "";
    const description = typeof body?.description === "string" ? body.description.trim().slice(0, 200) : "";

    if (!CREDENTIAL_NAME.test(name)) return NextResponse.json({ error: "Name must be 2-40 characters: capital letters, numbers and underscores, starting with a letter (e.g. SLACK_WEBHOOK)" }, { status: 400 });
    if (value.length < MIN_VALUE) return NextResponse.json({ error: `Value must be at least ${MIN_VALUE} characters` }, { status: 400 });
    if (value.length > MAX_VALUE) return NextResponse.json({ error: "Value is too long" }, { status: 400 });

    const [{ n }] = await sql`SELECT count(*)::int AS n FROM credentials WHERE user_id = ${session.user.id}`;
    if (n >= MAX_CREDENTIALS) return NextResponse.json({ error: `You can save up to ${MAX_CREDENTIALS} credentials` }, { status: 400 });

    try {
        const rows = await sql`
            INSERT INTO credentials (user_id, name, description, hint, value_enc)
            VALUES (${session.user.id}, ${name}, ${description}, ${value.slice(-4)}, ${encryptSecret(value)})
            RETURNING id, name, description, hint, created_at, updated_at`;
        return NextResponse.json({ credential: rows[0] }, { status: 201 });
    } catch (e: any) {
        if (String(e?.message).includes("credentials_user_id_name_key") || e?.code === "23505") return NextResponse.json({ error: `You already have a credential named ${name}` }, { status: 409 });
        console.error("Failed to save credential:", e?.message);
        return NextResponse.json({ error: "Couldn't save the credential" }, { status: 500 });
    }
}
