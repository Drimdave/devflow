import test from "node:test";
import assert from "node:assert/strict";
import { FAIL_WINDOW_MS, MAX_FAILURES, lockoutKey, lockoutMessage, lockoutStatus } from "../../lib/auth-lockout";

const now = 1_800_000_000_000;
const failures = (n: number, agoMs: number) => Array.from({ length: n }, (_, i) => now - agoMs + i * 1000);

test("keys are per email AND address, case-insensitive, and don't expose either", () => {
    assert.equal(lockoutKey("Ada@Example.com", "1.2.3.4"), lockoutKey(" ada@example.com ", "1.2.3.4"));
    assert.notEqual(lockoutKey("ada@example.com", "1.2.3.4"), lockoutKey("ada@example.com", "5.6.7.8")); // an attacker elsewhere can't lock the owner out
    assert.notEqual(lockoutKey("ada@example.com", "1.2.3.4"), lockoutKey("bob@example.com", "1.2.3.4"));
    assert.match(lockoutKey("ada@example.com", "1.2.3.4"), /^[0-9a-f]{64}$/);
});

test("blocked only after the limit, and for as long as it takes failures to age out", () => {
    assert.equal(lockoutStatus(failures(MAX_FAILURES - 1, 60_000), now).locked, false);
    const s = lockoutStatus(failures(MAX_FAILURES, 60_000), now);
    assert.equal(s.locked, true);
    assert.ok(s.retryAfterSec > 13 * 60 && s.retryAfterSec <= 15 * 60);
    // old failures don't count
    assert.equal(lockoutStatus(failures(20, FAIL_WINDOW_MS + 60_000), now).locked, false);
    // a mix: only the recent ones are counted
    assert.equal(lockoutStatus([...failures(MAX_FAILURES - 1, 60_000), ...failures(10, FAIL_WINDOW_MS + 60_000)], now).locked, false);
});

test("more failures than the limit wait for enough of them to expire", () => {
    const many = [...failures(MAX_FAILURES, 14 * 60_000), now - 5_000, now - 4_000];  // 8 old (about to expire) + 2 new
    const s = lockoutStatus(many, now);
    assert.equal(s.locked, true);
    assert.ok(s.retryAfterSec <= 180, `should unlock soon, got ${s.retryAfterSec}s`); // the oldest ones expire in about a minute
});

test("the message is human", () => {
    assert.match(lockoutMessage(45), /45 seconds/);
    assert.match(lockoutMessage(600), /10 minutes/);
});
