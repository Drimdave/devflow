// Tiny in-memory sliding-window limiter. Good enough to protect a public demo endpoint
// on a single instance; on serverless each instance keeps its own counts, so treat it as
// best-effort and back it with a shared store (Redis/Upstash) before real traffic.
const hits = new Map<string, number[]>();
const MAX_KEYS = 5000;

export function rateLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= limit) {
        hits.set(key, recent);
        const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
        return { ok: false as const, remaining: 0, retryAfterSec };
    }

    recent.push(now);
    hits.set(key, recent);

    // Keep memory bounded: drop the oldest keys when the map grows too large
    if (hits.size > MAX_KEYS) {
        const overflow = hits.size - MAX_KEYS;
        let i = 0;
        for (const k of hits.keys()) {
            hits.delete(k);
            if (++i >= overflow) break;
        }
    }

    return { ok: true as const, remaining: limit - recent.length, retryAfterSec: 0 };
}

/**
 * Best-effort caller address for rate limiting. Prefers headers a trusted platform sets itself; for
 * X-Forwarded-For it uses the LAST entry, which is the one our own proxy appended (earlier entries are
 * client-supplied and can be forged to dodge per-IP limits).
 */
export function ipFromHeaders(h: Headers): string {
    const direct = h.get("x-vercel-forwarded-for") || h.get("cf-connecting-ip") || h.get("x-real-ip");
    if (direct) return direct.split(",")[0].trim();
    const xff = h.get("x-forwarded-for");
    if (xff) {
        const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
        if (parts.length) return parts[parts.length - 1];
    }
    return "unknown";
}

export function clientIp(req: Request): string {
    return ipFromHeaders(req.headers);
}
