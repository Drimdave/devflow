import { rateLimit } from "@/lib/limits";

/** Real emails per account per hour, counted across manual and webhook runs. Returns a reason to refuse, or null. */
export async function emailGate(userId: string): Promise<string | null> {
    const r = await rateLimit(`email:${userId}`, 20, 60 * 60_000);
    return r.ok ? null : `Email limit reached (20 per hour). Try again in ${Math.ceil(r.retryAfterSec / 60)} min.`;
}
