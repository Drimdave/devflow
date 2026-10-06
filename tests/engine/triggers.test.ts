import test from "node:test";
import assert from "node:assert/strict";
import { runWorkflow } from "../../lib/engine/run";
import { triggerKindOf } from "../../lib/engine/triggers";

const N = (id: string, type: string, label: string, config: any = {}) => ({ id, data: { label, type, config } });
const two = [
    N("w", "trigger", "Webhook", { provider: "webhook", sample: { who: "webhook" } }),
    N("s", "trigger", "Every morning", { provider: "schedule", cron: "0 9 * * *", sample: { who: "schedule" } }),
    N("a", "data", "Act", { provider: "json", mapping: { saw: "{{input.who}}" } }),
    N("only", "data", "After schedule only", { provider: "json", mapping: { x: 1 } }),
];
const edges = [{ source: "w", target: "a" }, { source: "s", target: "a" }, { source: "s", target: "only" }];
const by = (r: any) => Object.fromEntries(r.steps.map((s: any) => [s.nodeId, s]));

test("trigger kinds are recognised from provider, source, cron or label", () => {
    assert.equal(triggerKindOf({ label: "New lead", config: { provider: "webhook" } }), "webhook");
    assert.equal(triggerKindOf({ label: "X", config: { source: "Webhook" } }), "webhook");
    assert.equal(triggerKindOf({ label: "Tick", config: { provider: "schedule" } }), "schedule");
    assert.equal(triggerKindOf({ label: "Tick", config: { cron: "* * * * *" } }), "schedule");
    assert.equal(triggerKindOf({ label: "Tick", config: { parameters: { cron: "* * * * *" } } }), "schedule");
    assert.equal(triggerKindOf({ label: "Run manually", config: { provider: "manual" } }), "manual");
    assert.equal(triggerKindOf({ label: "Every hour", config: {} }), "schedule");
    assert.equal(triggerKindOf({ label: "Payment failed", config: { provider: "stripe" } }), "other");
});

test("a webhook run starts only the webhook trigger", async () => {
    const r = await runWorkflow(two, edges, { start: "webhook", input: { who: "caller" } });
    const s = by(r);
    assert.equal(r.status, "success");
    assert.equal(s.w.status, "success");
    assert.equal(s.s.status, "skipped");
    assert.match(s.s.note, /started from "Webhook"/);
    assert.deepEqual(s.a.output, { saw: "caller" });          // the caller's payload, not the other trigger's sample
    assert.equal(s.only.status, "skipped");                    // only reachable from the schedule
    assert.match(s.only.note, /Not reached in this run/);
});

test("a schedule run starts only the schedule trigger", async () => {
    const r = await runWorkflow(two, edges, { start: "schedule" });
    const s = by(r);
    assert.equal(s.s.status, "success");
    assert.equal(s.w.status, "skipped");
    assert.deepEqual(s.a.output, { saw: "schedule" });
    assert.equal(s.only.status, "success");
});

test("a manual run uses the first trigger and doesn't let the others overwrite {{input}}", async () => {
    const r = await runWorkflow(two, edges);
    const s = by(r);
    assert.equal(s.w.status, "success");
    assert.equal(s.s.status, "skipped");
    assert.deepEqual(s.a.output, { saw: "webhook" });
});

test("a run that needs a trigger kind the workflow doesn't have fails clearly", async () => {
    const only = [N("m", "trigger", "Manual", { provider: "manual" }), N("a", "data", "A", { provider: "json", mapping: {} })];
    const w = await runWorkflow(only, [{ source: "m", target: "a" }], { start: "webhook" });
    assert.equal(w.status, "failed");
    assert.match(w.error!, /no Webhook trigger/);
    assert.equal(w.steps.length, 0);
    const sc = await runWorkflow(only, [{ source: "m", target: "a" }], { start: "schedule" });
    assert.match(sc.error!, /no Schedule trigger/);
});

test("single-node runs ignore trigger selection", async () => {
    const r = await runWorkflow(two, edges, { onlyNodeId: "a" });
    assert.equal(r.steps.length, 1);
    assert.equal(r.steps[0].status, "success");
});
