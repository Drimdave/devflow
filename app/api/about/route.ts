import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { GROQ_MODEL } from "@/lib/workflow-ai";

export const dynamic = "force-dynamic";

// Facts shown on the Settings page. Deliberately minimal: a model id and a region name,
// never the connection string or any key.
export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let dbRegion: string | null = null;
    try {
        const host = new URL(process.env.DATABASE_URL ?? "").hostname;
        dbRegion = host.match(/\.([a-z]{2}-[a-z]+-\d)\./)?.[1] ?? null;
    } catch {
        /* unparsable URL: leave null */
    }

    return NextResponse.json({ aiModel: GROQ_MODEL, dbRegion });
}
