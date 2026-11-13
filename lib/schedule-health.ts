// Whether a scheduler is really calling in. Pure functions, covered by the node test runner.

/**
 * The bundled GitHub Actions caller runs every 5 minutes and GitHub is sometimes late, so one or two missed
 * calls are normal. Anything quieter than this is treated as "not running".
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
