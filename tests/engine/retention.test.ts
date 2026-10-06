import test from "node:test";
import assert from "node:assert/strict";
import { RETENTION, shrinkSteps } from "../../lib/run-retention";

const step = (i: number, output?: unknown, extra: Record<string, unknown> = {}) => ({ nodeId: `n${i}`, label: `Step ${i}`, status: "success", durationMs: 5, startedAt: "2026-10-06T10:00:00Z", output, ...extra });
const size = (v: unknown) => JSON.stringify(v).length;

test("small runs are stored untouched", () => {
    const steps = [step(1, { ok: true }), step(2, "hello")];
    const r = shrinkSteps(steps);
    assert.equal(r.shrunk, false);
    assert.equal(r.steps, steps);
});

test("the biggest outputs are cut to a preview first, and everything else survives", () => {
    const big = { body: "x".repeat(150_000) };
    const steps = [step(1, { small: 1 }), step(2, big), step(3, { body: "y".repeat(120_000) }), step(4, "tiny")];
    const r = shrinkSteps(steps, 200_000);
    assert.equal(r.shrunk, true);
    assert.ok(size(r.steps) <= 200_000, `still ${size(r.steps)}`);
    assert.equal((r.steps[1].output as any).truncated, true);       // the largest went first
    assert.ok(((r.steps[1].output as any).preview as string).length <= RETENTION.previewChars);
    assert.deepEqual(r.steps[0].output, { small: 1 });              // untouched
    assert.equal(r.steps[3].output, "tiny");
    assert.deepEqual(r.steps.map((s) => s.label), steps.map((s) => s.label)); // labels, statuses and timings are never lost
    assert.deepEqual(r.steps.map((s) => s.status), steps.map((s) => s.status));
    assert.equal(size(steps[1]) > 150_000, true);                   // and the caller's data isn't mutated
});

test("only as many outputs are cut as needed", () => {
    const steps = [step(1, { a: "x".repeat(60_000) }), step(2, { b: "y".repeat(50_000) }), step(3, { c: "z".repeat(40_000) })];
    const r = shrinkSteps(steps, 130_000);
    const cut = r.steps.filter((s) => (s.output as any)?.truncated).length;
    assert.equal(cut, 1); // trimming the biggest one was enough
    assert.ok(size(r.steps) <= 130_000);
});

test("when outputs aren't the problem, long text is trimmed, and as a last resort output bodies are dropped but statuses stay", () => {
    const longNote = "n".repeat(5_000);
    const many = Array.from({ length: 60 }, (_, i) => step(i, { v: "q".repeat(1_200) }, { note: longNote, error: longNote }));
    const r = shrinkSteps(many, 40_000);
    assert.ok(size(r.steps) <= 40_000, `got ${size(r.steps)}`);
    assert.equal(r.steps.length, 60);
    assert.ok(r.steps.every((s) => s.status === "success" && typeof s.label === "string"));
    assert.ok(r.steps.every((s) => !s.note || (s.note as string).length <= RETENTION.maxTextChars + 1));
});

test("unserialisable outputs don't crash it", () => {
    const circular: any = { a: 1 }; circular.self = circular;
    const steps = [step(1, "x".repeat(250_000)), step(2, circular)];
    assert.doesNotThrow(() => shrinkSteps(steps, 200_000));
});

test("retention numbers are what the UI promises", () => {
    assert.equal(RETENTION.perWorkflow, 100);
    assert.equal(RETENTION.days, 30);
});
