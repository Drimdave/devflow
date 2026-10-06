// Standard 5-field cron ("minute hour day-of-month month day-of-week"), evaluated in UTC.
// Supports  *  lists (1,15)  ranges (1-5)  steps (*/10, 0-30/5)  month/weekday names  and  @hourly @daily @weekly @monthly @yearly.
// When both day-of-month and day-of-week are restricted, a day matches if EITHER does (classic cron behaviour).

export class CronError extends Error {}

export interface CronSpec {
    minutes: number[];
    hours: number[];
    daysOfMonth: number[];
    months: number[];
    daysOfWeek: number[];   // 0 = Sunday
    domAny: boolean;
    dowAny: boolean;
    source: string;
}

const MACROS: Record<string, string> = {
    "@hourly": "0 * * * *",
    "@daily": "0 0 * * *",
    "@midnight": "0 0 * * *",
    "@weekly": "0 0 * * 0",
    "@monthly": "0 0 1 * *",
    "@yearly": "0 0 1 1 *",
    "@annually": "0 0 1 1 *",
};
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function parseField(raw: string, min: number, max: number, names: string[] | null, label: string): { values: number[]; any: boolean } {
    const toNumber = (t: string): number => {
        const lower = t.toLowerCase();
        if (names) {
            const i = names.indexOf(lower.slice(0, 3));
            if (i >= 0 && /^[a-z]+$/.test(lower)) return names === MONTHS ? i + 1 : i;
        }
        if (!/^\d+$/.test(t)) throw new CronError(`"${t}" isn't a valid ${label}`);
        return Number(t);
    };
    const out = new Set<number>();
    let any = false;
    for (const part of raw.split(",")) {
        if (!part) throw new CronError(`Empty value in the ${label} field`);
        const [rangePart, stepPart, extra] = part.split("/");
        if (extra !== undefined) throw new CronError(`Too many "/" in "${part}"`);
        const step = stepPart === undefined ? 1 : Number(stepPart);
        if (stepPart !== undefined && (!/^\d+$/.test(stepPart) || step < 1)) throw new CronError(`The step in "${part}" must be 1 or more`);

        let lo: number, hi: number;
        if (rangePart === "*") {
            lo = min; hi = max;
            if (stepPart === undefined) any = true;
        } else if (rangePart.includes("-")) {
            const [a, b, more] = rangePart.split("-");
            if (more !== undefined) throw new CronError(`"${rangePart}" isn't a valid range`);
            lo = toNumber(a); hi = toNumber(b);
        } else {
            lo = toNumber(rangePart);
            hi = stepPart === undefined ? lo : max; // "5/15" means 5, 20, 35, ...
        }
        if (lo < min || hi > max || lo > hi) throw new CronError(`${label} values must be between ${min} and ${max} (got "${part}")`);
        for (let v = lo; v <= hi; v += step) out.add(label === "day of week" && v === 7 ? 0 : v);
    }
    return { values: [...out].sort((x, y) => x - y), any };
}

export function parseCron(expression: string): CronSpec {
    const source = String(expression ?? "").trim().replace(/\s+/g, " ");
    if (!source) throw new CronError("Enter a schedule, like 0 9 * * *");
    const expanded = MACROS[source.toLowerCase()] ?? source;
    const fields = expanded.split(" ");
    if (fields.length !== 5) throw new CronError(`A schedule has 5 parts (minute hour day month weekday), but this has ${fields.length}`);
    const minute = parseField(fields[0], 0, 59, null, "minute");
    const hour = parseField(fields[1], 0, 23, null, "hour");
    const dom = parseField(fields[2], 1, 31, null, "day of month");
    const month = parseField(fields[3], 1, 12, MONTHS, "month");
    // weekday accepts 0-7 (both 0 and 7 mean Sunday)
    const dow = parseField(fields[4], 0, 7, DAYS, "day of week");
    return { minutes: minute.values, hours: hour.values, daysOfMonth: dom.values, months: month.values, daysOfWeek: dow.values, domAny: dom.any, dowAny: dow.any, source };
}

function dayMatches(spec: CronSpec, d: Date): boolean {
    if (!spec.months.includes(d.getUTCMonth() + 1)) return false;
    const domOk = spec.daysOfMonth.includes(d.getUTCDate());
    const dowOk = spec.daysOfWeek.includes(d.getUTCDay());
    if (spec.domAny && spec.dowAny) return true;
    if (spec.domAny) return dowOk;
    if (spec.dowAny) return domOk;
    return domOk || dowOk;
}

/** The first matching minute strictly after `after` (UTC), or null if the schedule can never fire (e.g. Feb 31). */
export function nextRun(spec: CronSpec, after: Date): Date | null {
    const start = new Date(after.getTime());
    start.setUTCSeconds(0, 0);
    start.setUTCMinutes(start.getUTCMinutes() + 1);
    const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    for (let i = 0; i < 366 * 9; i++, day.setUTCDate(day.getUTCDate() + 1)) {
        if (!dayMatches(spec, day)) continue;
        const sameDay = day.getTime() === Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
        for (const h of spec.hours) {
            if (sameDay && h < start.getUTCHours()) continue;
            for (const m of spec.minutes) {
                if (sameDay && h === start.getUTCHours() && m < start.getUTCMinutes()) continue;
                return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m));
            }
        }
    }
    return null;
}

/** The smallest gap, in minutes, between consecutive runs (looked at over the next 40 runs). */
export function minIntervalMinutes(spec: CronSpec): number {
    let prev = nextRun(spec, new Date(Date.UTC(2026, 0, 1, 0, 0)));
    let min = Infinity;
    for (let i = 0; i < 40 && prev; i++) {
        const n = nextRun(spec, prev);
        if (!n) break;
        min = Math.min(min, (n.getTime() - prev.getTime()) / 60000);
        prev = n;
    }
    return min;
}

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A short plain-English summary for the common shapes; otherwise the expression itself. */
export function describeCron(expression: string): string {
    let spec: CronSpec;
    try { spec = parseCron(expression); } catch { return expression; }
    const f = (MACROS[spec.source.toLowerCase()] ?? spec.source).split(" ");
    const time = spec.minutes.length === 1 && spec.hours.length === 1 ? `${pad(spec.hours[0])}:${pad(spec.minutes[0])} UTC` : null;
    const everyMonth = f[3] === "*";
    if (/^\*\/\d+$/.test(f[0]) && f[1] === "*" && f[2] === "*" && everyMonth && f[4] === "*") return `Every ${f[0].slice(2)} minutes`;
    if (f[0] === "*" && f[1] === "*" && f[2] === "*" && everyMonth && f[4] === "*") return "Every minute";
    if (/^\d+$/.test(f[0]) && f[1] === "*" && f[2] === "*" && everyMonth && f[4] === "*") return f[0] === "0" ? "Every hour, on the hour" : `Every hour at :${pad(Number(f[0]))}`;
    if (time && f[2] === "*" && everyMonth && f[4] === "*") return `Every day at ${time}`;
    if (time && f[2] === "*" && everyMonth && spec.daysOfWeek.length === 1) return `Every ${WEEKDAYS[spec.daysOfWeek[0]]} at ${time}`;
    if (time && f[2] === "*" && everyMonth && spec.daysOfWeek.join() === "1,2,3,4,5") return `Weekdays at ${time}`;
    if (time && spec.daysOfMonth.length === 1 && f[4] === "*" && everyMonth) return `On day ${spec.daysOfMonth[0]} of every month at ${time}`;
    return `Custom schedule (${spec.source}, UTC)`;
}
