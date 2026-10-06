import test from "node:test";
import assert from "node:assert/strict";
import { CronError, describeCron, minIntervalMinutes, nextRun, parseCron } from "../../lib/cron";
import { MIN_SCHEDULE_MINUTES, findSchedule, nextScheduledRun } from "../../lib/schedule";

const at = (iso: string) => new Date(iso);
const next = (expr: string, after: string) => nextRun(parseCron(expr), at(after))?.toISOString() ?? null;

test("next run for common schedules (UTC)", () => {
    const base = "2026-10-06T12:07:30Z"; // a Tuesday
    assert.equal(next("0 9 * * *", base), "2026-10-07T09:00:00.000Z");
    assert.equal(next("0 13 * * *", base), "2026-10-06T13:00:00.000Z");
    assert.equal(next("*/15 * * * *", base), "2026-10-06T12:15:00.000Z");
    assert.equal(next("* * * * *", base), "2026-10-06T12:08:00.000Z");
    assert.equal(next("0 * * * *", base), "2026-10-06T13:00:00.000Z");
    assert.equal(next("30 12 * * *", base), "2026-10-06T12:30:00.000Z");
    assert.equal(next("7 12 * * *", base), "2026-10-07T12:07:00.000Z"); // strictly after: 12:07 has already begun
    assert.equal(next("0 0 1 * *", base), "2026-11-01T00:00:00.000Z");
    assert.equal(next("0 9 * * 1", base), "2026-10-12T09:00:00.000Z"); // next Monday
    assert.equal(next("0 9 * * mon-fri", base), "2026-10-07T09:00:00.000Z");
    assert.equal(next("0 9 * * 1-5", "2026-10-09T10:00:00Z"), "2026-10-12T09:00:00.000Z"); // Friday after 9am -> Monday
    assert.equal(next("0 0 * * 0", base), "2026-10-11T00:00:00.000Z");
    assert.equal(next("0 0 * * 7", base), "2026-10-11T00:00:00.000Z"); // 7 is Sunday too
    assert.equal(next("0 0 1 jan *", base), "2027-01-01T00:00:00.000Z");
    assert.equal(next("@daily", base), "2026-10-07T00:00:00.000Z");
    assert.equal(next("@hourly", base), "2026-10-06T13:00:00.000Z");
    assert.equal(next("@weekly", base), "2026-10-11T00:00:00.000Z");
});

test("ranges, lists and steps", () => {
    assert.deepEqual(parseCron("0,15,30,45 * * * *").minutes, [0, 15, 30, 45]);
    assert.deepEqual(parseCron("10-20/5 * * * *").minutes, [10, 15, 20]);
    assert.deepEqual(parseCron("5/20 * * * *").minutes, [5, 25, 45]);
    assert.deepEqual(parseCron("*/20 * * * *").minutes, [0, 20, 40]);
    assert.deepEqual(parseCron("0 8-18/5 * * *").hours, [8, 13, 18]);
    assert.deepEqual(parseCron("0 0 * * 7").daysOfWeek, [0]);
    assert.deepEqual(parseCron("0 0 * * 0,6").daysOfWeek, [0, 6]);
    assert.deepEqual(parseCron("0 0 * * 5-7").daysOfWeek, [0, 5, 6]);
    assert.deepEqual(parseCron("0 0 * mar,sep *").months, [3, 9]);
});

test("day-of-month and day-of-week combine with OR when both are set", () => {
    // the 13th of any month, or any Friday
    assert.equal(next("0 0 13 * 5", "2026-10-06T00:00:00Z"), "2026-10-09T00:00:00.000Z"); // Friday first
    assert.equal(next("0 0 13 * 5", "2026-10-10T00:00:00Z"), "2026-10-13T00:00:00.000Z"); // then the 13th (a Tuesday)
});

test("impossible and rare dates", () => {
    assert.equal(next("0 0 31 2 *", "2026-01-01T00:00:00Z"), null);       // Feb 31 never happens
    assert.equal(next("0 0 29 2 *", "2026-10-06T00:00:00Z"), "2028-02-29T00:00:00.000Z"); // next leap day
    assert.equal(next("0 0 31 * *", "2026-11-05T00:00:00Z"), "2026-12-31T00:00:00.000Z"); // skips 30-day November
});

test("invalid schedules explain themselves", () => {
    for (const bad of ["", "   ", "* * * *", "* * * * * *", "60 * * * *", "* 24 * * *", "* * 0 * *", "* * 32 * *", "* * * 13 *", "* * * * 8", "*/0 * * * *", "5-1 * * * *", "a b c d e", "1-2-3 * * * *", "1/2/3 * * * *", ",5 * * * *", "every day"]) {
        assert.throws(() => parseCron(bad), (e: unknown) => e instanceof CronError, `"${bad}"`);
    }
});

test("minimum interval between runs", () => {
    assert.equal(minIntervalMinutes(parseCron("*/5 * * * *")), 5);
    assert.equal(minIntervalMinutes(parseCron("*/2 * * * *")), 2);
    assert.equal(minIntervalMinutes(parseCron("* * * * *")), 1);
    assert.equal(minIntervalMinutes(parseCron("0,3 * * * *")), 3);
    assert.equal(minIntervalMinutes(parseCron("0 9 * * *")), 1440);
    assert.equal(minIntervalMinutes(parseCron("0 * * * *")), 60);
});

test("plain-English descriptions", () => {
    assert.equal(describeCron("0 9 * * *"), "Every day at 09:00 UTC");
    assert.equal(describeCron("*/10 * * * *"), "Every 10 minutes");
    assert.equal(describeCron("0 * * * *"), "Every hour, on the hour");
    assert.equal(describeCron("30 * * * *"), "Every hour at :30");
    assert.equal(describeCron("0 9 * * 1"), "Every Monday at 09:00 UTC");
    assert.equal(describeCron("0 9 * * 1-5"), "Weekdays at 09:00 UTC");
    assert.equal(describeCron("0 8 1 * *"), "On day 1 of every month at 08:00 UTC");
    assert.match(describeCron("5,35 4-6 * * *"), /Custom schedule/);
    assert.equal(describeCron("nonsense"), "nonsense");
});

const node = (id: string, type: string, label: string, config: any) => ({ id, type: "pro", data: { type, label, config } });

test("finding a workflow's schedule", () => {
    const wf = [node("w", "trigger", "Webhook", { provider: "webhook" }), node("s", "trigger", "Every morning", { provider: "schedule", cron: "0 9 * * *" }), node("a", "action", "Act", {})];
    assert.deepEqual(findSchedule(wf), { nodeId: "s", cron: "0 9 * * *" });
    assert.equal(findSchedule([node("w", "trigger", "Webhook", { provider: "webhook" })]), null);
    assert.equal(findSchedule("junk"), null);
    assert.equal(findSchedule([null, 5]), null);
    // AI-style nested parameters
    assert.equal(findSchedule([node("s", "trigger", "Tick", { provider: "schedule", parameters: { cron: "*/30 * * * *" } })])!.cron, "*/30 * * * *");
    // invalid or too frequent
    assert.match(findSchedule([node("s", "trigger", "T", { provider: "schedule", cron: "nope" })])!.error!, /5 parts/);
    assert.match(findSchedule([node("s", "trigger", "T", { provider: "schedule", cron: "* * * * *" })])!.error!, new RegExp(`at least ${MIN_SCHEDULE_MINUTES} minutes`));
    assert.match(findSchedule([node("s", "trigger", "T", { provider: "schedule", cron: "0 0 31 2 *" })])!.error!, /never runs/);
    assert.match(findSchedule([node("s", "trigger", "T", { provider: "schedule" })])!.error!, /Enter a schedule/);
});

test("when the scheduler should next run a workflow", () => {
    const wf = [node("s", "trigger", "Daily", { provider: "schedule", cron: "0 9 * * *" })];
    const after = at("2026-10-06T12:00:00Z");
    assert.equal(nextScheduledRun(wf, true, after)?.toISOString(), "2026-10-07T09:00:00.000Z");
    assert.equal(nextScheduledRun(wf, false, after), null);                         // paused
    assert.equal(nextScheduledRun([node("w", "trigger", "W", { provider: "webhook" })], true, after), null); // no schedule
    assert.equal(nextScheduledRun([node("s", "trigger", "T", { provider: "schedule", cron: "* * * * *" })], true, after), null); // too frequent
});
