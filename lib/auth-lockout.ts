// Slowing down password guessing for ONE account from ONE place. Pure rules here; storage lives in auth-guard.ts.
// Keyed by email + IP, so an attacker can't lock a real owner out of their own account from somewhere else.
import { createHash } from "node:crypto";

export const FAIL_WINDOW_MS = 15 * 60_000;
export const MAX_FAILURES = 8;

export function lockoutKey(email: string, ip: string): string {
    return createHash("sha256").update(`${String(email).trim().toLowerCase()}|${ip}`).digest("hex");
}

/** Given the times (ms) of recent failures, are further attempts blocked, and for how long? */
export function lockoutStatus(failureTimes: number[], now: number): { locked: boolean; retryAfterSec: number } {
    const recent = failureTimes.filter((t) => now - t < FAIL_WINDOW_MS).sort((a, b) => a - b);
    if (recent.length < MAX_FAILURES) return { locked: false, retryAfterSec: 0 };
    // Attempts are allowed again once enough old failures age out to drop below the limit
    const unlocksAt = recent[recent.length - MAX_FAILURES] + FAIL_WINDOW_MS;
    return { locked: true, retryAfterSec: Math.max(1, Math.ceil((unlocksAt - now) / 1000)) };
}

export const lockoutMessage = (retryAfterSec: number) =>
    `Too many failed sign-in attempts. Try again in ${retryAfterSec >= 90 ? `${Math.ceil(retryAfterSec / 60)} minutes` : `${retryAfterSec} seconds`}, or reset your password.`;
