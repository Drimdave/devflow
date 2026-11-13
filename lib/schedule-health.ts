// Whether a scheduler is really calling in. Pure functions, covered by the node test runner.

/**
 * Assumes a caller that checks in every minute or every few minutes (cron-job.org, a crontab). Anything quieter than this is
 * treated as "not running". GitHub Actions alone does not meet it: its scheduled runs were hours apart on this project.
 */
export const SCHEDULER_HEALTHY_WITHIN_MS = 12 * 60_000;

export interface SchedulerHealth {
    running: boolean;
    /** Whole minutes since the last call, or null when it has never called. */
    minutesAgo: number | null;
}

export function schedulerHealth(lastTickAt: Date | null, nowMs: number): SchedulerHealth {
    if (!lastTickAt || Number.isNaN(lastTickAt.getTime())) return { running: false, minutesAgo: null };
    const age = Math.max(0, nowMs - lastTickAt.getTime());
    return { running: age < SCHEDULER_HEALTHY_WITHIN_MS, minutesAgo: Math.floor(age / 60_000) };
}
