// How long run history is kept and how big one run may be. Pure, so the rules are testable on their own.

export const RETENTION = {
    /** Newest runs kept per workflow. */
    perWorkflow: 100,
    /** Runs older than this are deleted. */
    days: 30,
    /** Largest serialized step data stored for one run. */
    maxRunChars: 200_000,
    /** What's left of an output that had to be cut down. */
    previewChars: 1_500,
    maxTextChars: 500,
};

type Step = Record<string, any>;

const size = (v: unknown) => {
    try { return JSON.stringify(v)?.length ?? 0; } catch { return 0; }
};

/**
 * Keep a run's step data under the size limit. The biggest outputs are replaced with a short preview first;
 * only if that isn't enough are long notes and errors trimmed. Statuses, labels and timings are never touched,
 * so the run still reads correctly.
 */
export function shrinkSteps(steps: Step[], maxChars = RETENTION.maxRunChars): { steps: Step[]; shrunk: boolean } {
    if (size(steps) <= maxChars) return { steps, shrunk: false };
    const out: Step[] = steps.map((s) => ({ ...s }));

    // 1. the largest outputs first
    const byOutput = out.map((s, i) => ({ i, n: size(s.output) })).filter((x) => x.n > RETENTION.previewChars).sort((a, b) => b.n - a.n);
    for (const { i } of byOutput) {
        if (size(out) <= maxChars) break;
        let preview = "";
        try { preview = JSON.stringify(out[i].output).slice(0, RETENTION.previewChars); } catch { /* unserialisable */ }
        out[i].output = { truncated: true, note: "This output was too large to keep in history", preview };
    }
    // 2. then long text
    if (size(out) > maxChars) {
        for (const s of out) {
            for (const k of ["note", "error"] as const) {
                if (typeof s[k] === "string" && s[k].length > RETENTION.maxTextChars) s[k] = s[k].slice(0, RETENTION.maxTextChars) + "…";
            }
        }
    }
    // 3. last resort: drop all output bodies but keep every step's status
    if (size(out) > maxChars) for (const s of out) if (s.output !== undefined) s.output = { truncated: true, note: "Output omitted: this run produced too much data" };
    // 4. the very last resort: shorten every remaining text
    if (size(out) > maxChars) {
        for (const s of out) {
            for (const k of ["note", "error", "label"] as const) if (typeof s[k] === "string" && s[k].length > 100) s[k] = s[k].slice(0, 100) + "…";
        }
    }
    return { steps: out, shrunk: true };
}
