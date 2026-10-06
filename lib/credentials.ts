import { sql } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets-crypto";

/** All of a user's saved credentials, decrypted, as { NAME: value }. Server-side only; used to run workflows. */
export async function loadSecrets(userId: string): Promise<Record<string, string>> {
    const rows = await sql`SELECT name, value_enc FROM credentials WHERE user_id = ${userId}`;
    const out: Record<string, string> = {};
    for (const r of rows) {
        try {
            out[r.name] = decryptSecret(r.value_enc);
        } catch {
            console.error(`Could not decrypt credential ${r.name}`); // wrong/rotated key; the node will report it as not saved
        }
    }
    return out;
}
