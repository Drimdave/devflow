import test from "node:test";
import assert from "node:assert/strict";
import { executeScheduledRun, lostRunRecord, LOST_RUN_MESSAGE, type ScheduledRunRecord, type ScheduledRunDeps } from "../../lib/scheduled-run";
import { schedulerHealth, SCHEDULER_HEALTHY_WITHIN_MS } from "../../lib/schedule-health";
import type { RunSummary } from "../../lib/engine/types";

const wf = { id: 42, user_id: "user-1" };
const okSummary: RunSummary = { status: "success", startedAt: "2026-11-13T09:00:00.000Z", durationMs: 120, steps: [{ nodeId: "t", label: "Schedule", status: "success", startedAt: "2026-11-13T09:00:00.000Z", durationMs: 1 }] };

function deps(over: Partial<ScheduledRunDeps> = {}) {
    const saved: ScheduledRunRecord[] = [];
    const logs: string[] = [];
    const d: ScheduledRunDeps = {
        loadSecrets: async () => ({}),
        run: async () => okSummary,
        saveRun: async (r) => { saved.push(r); },
        log: (m) => { logs.push(m); },
        ...over,
    };
    return { d, saved, logs };
}

test("a normal run is saved as a schedule run", async () => {
    const { d, saved } = deps();
    assert.equal(await executeScheduledRun(wf, d), "ran");
    assert.equal(saved.length, 1);
    assert.equal(saved[0].mode, "schedule");
    assert.equal(saved[0].workflowId, "42");
    assert.equal(saved[0].status, "success");
});

test("a failure inside the engine is a result, not a loss", async () => {
    const failed: RunSummary = { ...okSummary, status: "failed", error: "HTTP 500", steps: [{ ...okSummary.steps[0], status: "failed", error: "HTTP 500" }] };
    const { d, saved } = deps({ run: async () => failed });
    assert.equal(await executeScheduledRun(wf, d), "ran");
    assert.equal(saved[0].status, "failed");
    assert.equal(saved[0].error, "HTTP 500");
});

test("a run that failed before any step started is still recorded", async () => {
    const early: RunSummary = { status: "failed", startedAt: "2026-11-13T09:00:00.000Z", durationMs: 0, steps: [], error: "This workflow has a loop. Connections must flow one way." };
    const { d, saved } = deps({ run: async () => early });
    assert.equal(await executeScheduledRun(wf, d), "ran");
    assert.equal(saved.length, 1);
    assert.match(saved[0].error!, /loop/);
});

test("an empty successful run is not recorded", async () => {
    const { d, saved } = deps({ run: async () => ({ ...okSummary, steps: [] }) });
    assert.equal(await executeScheduledRun(wf, d), "ran");
    assert.equal(saved.length, 0);
});

test("a database error while loading credentials leaves a failed run in history", async () => {
    const { d, saved, logs } = deps({ loadSecrets: async () => { throw new Error("connection terminated"); } });
    assert.equal(await executeScheduledRun(wf, d), "lost");
    assert.equal(saved.length, 1);
    assert.equal(saved[0].status, "failed");
    assert.equal(saved[0].mode, "schedule");
    assert.deepEqual(saved[0].steps, []);
    assert.equal(saved[0].error, LOST_RUN_MESSAGE);
    assert.equal(logs.length, 1);
});

test("a failure while saving the result is recorded as lost, without exposing the database error", async () => {
    let calls = 0;
    const { d, saved } = deps({
        saveRun: async (r) => { calls++; if (calls === 1) throw new Error("password authentication failed for user neondb_owner"); saved2.push(r); },
    });
    const saved2: ScheduledRunRecord[] = [];
    assert.equal(await executeScheduledRun(wf, d), "lost");
    assert.equal(saved2.length, 1);
    assert.equal(saved2[0].error, LOST_RUN_MESSAGE);
    assert.doesNotMatch(JSON.stringify(saved2[0]), /neondb_owner|password/);
    assert.equal(saved.length, 0);
});

test("if even the loss cannot be recorded, it still reports lost and does not throw", async () => {
    const { d, logs } = deps({
        run: async () => { throw new Error("boom"); },
        saveRun: async () => { throw new Error("database down"); },
    });
    assert.equal(await executeScheduledRun(wf, d), "lost");
    assert.equal(logs.length, 2);
});

test("the lost-run message does not claim nothing happened", () => {
    assert.match(LOST_RUN_MESSAGE, /may have run/);
    const r = lostRunRecord(wf, 1_000, 4_500);
    assert.equal(r.durationMs, 3_500);
    assert.equal(lostRunRecord(wf, 5_000, 1_000).durationMs, 0);
    assert.equal(r.startedAt, new Date(1_000).toISOString());
});

test("the scheduler is healthy through two missed 5-minute calls, and not after that", () => {
    const now = Date.parse("2026-11-13T12:00:00Z");
    const at = (minsAgo: number) => new Date(now - minsAgo * 60_000);
    assert.deepEqual(schedulerHealth(at(1), now), { running: true, minutesAgo: 1 });
    assert.deepEqual(schedulerHealth(at(7), now), { running: true, minutesAgo: 7 });
    assert.equal(schedulerHealth(at(11), now).running, true);
    assert.equal(schedulerHealth(at(13), now).running, false);
    assert.equal(SCHEDULER_HEALTHY_WITHIN_MS > 2 * 5 * 60_000, true);
});

test("a scheduler that never called, or a bad date, is not running", () => {
    assert.deepEqual(schedulerHealth(null, Date.now()), { running: false, minutesAgo: null });
    assert.deepEqual(schedulerHealth(new Date("nonsense"), Date.now()), { running: false, minutesAgo: null });
    const future = new Date(Date.now() + 60_000);
    assert.equal(schedulerHealth(future, Date.now()).minutesAgo, 0);
});
