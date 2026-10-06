import test from "node:test";
import assert from "node:assert/strict";
import { LIMITS, UUID_RE, parseWorkflowInput, readJson } from "../../lib/validate";
import { clientIp, rateLimit } from "../../lib/rate-limit";
import { runWorkflow } from "../../lib/engine/run";

const node = (id: string) => ({ id, type: "pro", data: { label: id, type: "action" } });

test("workflow payloads: shapes, sizes and types are enforced", () => {
    const bad = (body: any) => { const r = parseWorkflowInput(body); assert.equal(r.ok, false, JSON.stringify(body).slice(0, 60)); return r as any; };
    bad({ nodes: "hi" });
    bad({ nodes: [null] });
    bad({ nodes: [{ label: "no id" }] });
    bad({ edges: {} });
    bad({ edges: [{ source: "a" }] });
    bad({ name: 5 });
    bad({ name: "N".repeat(LIMITS.name + 1) });
    bad({ description: "d".repeat(LIMITS.description + 1) });
    bad({ is_active: "yes" });
    bad({ nodes: Array.from({ length: LIMITS.nodes + 1 }, (_, i) => node("n" + i)) });
    assert.equal((bad({ nodes: [{ id: "a", data: { label: "x".repeat(LIMITS.graphChars) } }] })).status, 413);

    const ok = parseWorkflowInput({ name: "  My flow ", nodes: [node("a")], edges: [{ source: "a", target: "a" }], extra: "ignored" }) as any;
    assert.equal(ok.ok, true);
    assert.equal(ok.value.name, "My flow");
    assert.equal("extra" in ok.value, false);
    assert.equal((parseWorkflowInput({}) as any).ok, true); // partial updates are allowed
});

test("base_version must be a whole number when given", () => {
    for (const bad of ["3", 1.5, -1, {}, true]) assert.equal(parseWorkflowInput({ base_version: bad } as any).ok, false, String(bad));
    assert.equal((parseWorkflowInput({ base_version: 4 }) as any).value.base_version, 4);
    assert.equal(parseWorkflowInput({ base_version: null } as any).ok, true);
    assert.equal("base_version" in (parseWorkflowInput({}) as any).value, false);
});

test("readJson never throws and caps size", async () => {
    const mk = (body: string) => new Request("http://x.test", { method: "POST", body });
    assert.equal(((await readJson(mk("{bad"))) as any).status, 400);
    assert.equal(((await readJson(mk("[1,2]"))) as any).ok, false);
    assert.equal(((await readJson(mk("null"))) as any).ok, false);
    assert.equal(((await readJson(mk("x".repeat(50)), 10)) as any).status, 413);
    assert.equal((await readJson(mk('{"a":1}'))).ok, true);
});

test("UUID check rejects junk ids", () => {
    assert.ok(UUID_RE.test("01aa8a13-7a68-4197-bae5-358029e1b8a5"));
    for (const bad of ["not-a-uuid", "", "'; DROP TABLE x;--", "../../etc", "01aa8a13-7a68-4197-bae5-358029e1b8a5x"]) assert.equal(UUID_RE.test(bad), false, bad);
});

test("client IP can't be forged through the first X-Forwarded-For entry", () => {
    const req = (h: Record<string, string>) => new Request("http://x.test", { headers: h });
    assert.equal(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" })), "203.0.113.9"); // the proxy-appended one
    assert.equal(clientIp(req({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "198.51.100.4" })), "198.51.100.4");
    assert.equal(clientIp(req({ "x-vercel-forwarded-for": "198.51.100.5", "x-forwarded-for": "9.9.9.9" })), "198.51.100.5");
    assert.equal(clientIp(req({})), "unknown");
});

test("rate limiter blocks after the limit and reports when to retry", () => {
    const key = "qa:" + Math.random();
    for (let i = 0; i < 3; i++) assert.equal(rateLimit(key, 3, 60_000).ok, true);
    const blocked = rateLimit(key, 3, 60_000);
    assert.equal(blocked.ok, false);
    assert.ok(blocked.retryAfterSec >= 1);
});

test("engine survives junk entries and reports duplicate ids clearly", async () => {
    const trigger = { id: "t", data: { label: "T", type: "trigger" } };
    const r1 = await runWorkflow([null, 5, "x", trigger] as any, [null, 7, {}, { source: "t" }] as any);
    assert.equal(r1.status, "success");
    const r2 = await runWorkflow([trigger, trigger] as any, []);
    assert.equal(r2.status, "failed");
    assert.match(r2.error!, /share the same id/);
});
