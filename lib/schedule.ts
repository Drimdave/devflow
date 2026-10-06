// Finding and validating a workflow's schedule. Pure, so the editor, the API and the scheduler all agree.
import { CronError, minIntervalMinutes, nextRun, parseCron } from "./cron";
import { triggerKindOf } from "./engine/triggers";

/** The shortest gap allowed between scheduled runs: each run can send messages, emails and AI calls. */
export const MIN_SCHEDULE_MINUTES = 5;

export interface ScheduleInfo {
    nodeId: string;
    cron: string;
    /** Why this schedule can't run, if it can't. */
    error?: string;
}

const cronOf = (config: any): string => {
    const c = config ?? {};
    const raw = c.cron ?? c.schedule ?? c.parameters?.cron ?? c.parameters?.schedule;
    return typeof raw === "string" ? raw.trim() : "";
};

/** Why a schedule text can't be used, or undefined when it's fine. Shared by the editor and the server. */
export function checkCron(cron: string): string | undefined {
    try {
        const spec = parseCron(cron);
        if (nextRun(spec, new Date()) === null) return "This schedule never runs (the dates don't exist)";
        if (minIntervalMinutes(spec) < MIN_SCHEDULE_MINUTES) return `Scheduled runs must be at least ${MIN_SCHEDULE_MINUTES} minutes apart`;
        return undefined;
    } catch (e) {
        return e instanceof CronError ? e.message : "Invalid schedule";
    }
}

/** The workflow's schedule trigger, read from saved nodes (React Flow or flat shape), or null if it has none. */
export function findSchedule(nodes: unknown): ScheduleInfo | null {
    if (!Array.isArray(nodes)) return null;
    for (const n of nodes as any[]) {
        if (!n || typeof n !== "object") continue;
        const d = n.data ?? n;
        const type = d.type ?? n.type;
        if (type !== "trigger") continue;
        const config = d.config ?? d.data ?? {};
        if (triggerKindOf({ label: String(d.label ?? n.label ?? ""), config }) !== "schedule") continue;
        const cron = cronOf(config);
        const info: ScheduleInfo = { nodeId: String(n.id), cron };
        const error = checkCron(cron);
        if (error) info.error = error;
        return info;
    }
    return null;
}

/** When the scheduler should next run this workflow, or null when it shouldn't (no schedule, invalid, or paused). */
export function nextScheduledRun(nodes: unknown, active: boolean, after: Date = new Date()): Date | null {
    if (!active) return null;
    const s = findSchedule(nodes);
    if (!s || s.error) return null;
    return nextRun(parseCron(s.cron), after);
}
