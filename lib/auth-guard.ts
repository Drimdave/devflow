import { sql } from "@/lib/db";
import { FAIL_WINDOW_MS, lockoutKey, lockoutStatus } from "@/lib/auth-lockout";

/** Seconds a sign-in for this email from this address is blocked, or 0 when it may proceed. */
export async function signInBlockedFor(email: string, ip: string): Promise<number> {
    const key = lockoutKey(email, ip);
    const rows = await sql`SELECT at FROM auth_failures WHERE key = ${key} AND at > now() - make_interval(secs => ${FAIL_WINDOW_MS / 1000}) ORDER BY at`;
    const status = lockoutStatus(rows.map((r) => new Date(r.at).getTime()), Date.now());
    return status.locked ? status.retryAfterSec : 0;
}

export async function recordSignInFailure(email: string, ip: string): Promise<void> {
    // One round trip: log this failure and, in the same statement, drop anything older than the window (housekeeping)
    await sql`
        WITH logged AS (INSERT INTO auth_failures (key) VALUES (${lockoutKey(email, ip)}))
        DELETE FROM auth_failures WHERE at < now() - interval '1 hour'`;
}

export async function clearSignInFailures(email: string, ip: string): Promise<void> {
    await sql`DELETE FROM auth_failures WHERE key = ${lockoutKey(email, ip)}`;
}
