import { sql } from "@/lib/db";
import { rateLimit as memoryRateLimit } from "@/lib/rate-limit";

// DevFlow's own rate limits. Counters live in Postgres (table rate_limits), so every serverless instance sees the same
// numbers: the old in-memory limiter gave each instance its own allowance and reset on every cold start.
// One atomic statement per check; a fixed window that starts at the first request.

export interface LimitResult {
    ok: boolean;
    remaining: number;
    retryAfterSec: number;
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<LimitResult> {
    try {
        const secs = windowMs / 1000;
        const rows = await sql`
            INSERT INTO rate_limits (key, count, reset_at) VALUES (${key}, 1, now() + make_interval(secs => ${secs}))
            ON CONFLICT (key) DO UPDATE SET
                count    = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
                reset_at = CASE WHEN rate_limits.reset_at <= now() THEN now() + make_interval(secs => ${secs}) ELSE rate_limits.reset_at END
            RETURNING count, EXTRACT(EPOCH FROM (reset_at - now()))::float AS ttl`;
        // Housekeeping on about one call in a hundred: expired windows are dead weight
        if (Math.random() < 0.01) sql`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'`.catch(() => {});
        const { count, ttl } = rows[0] as { count: number; ttl: number };
        if (count > limit) return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil(ttl)) };
        return { ok: true, remaining: limit - count, retryAfterSec: 0 };
    } catch (err) {
        // If the database hiccups, keep limiting with this instance's own counters instead of failing open or closed
        console.error("Shared rate limit unavailable, using local counters:", (err as Error)?.message);
        return memoryRateLimit(key, limit, windowMs);
    }
}
