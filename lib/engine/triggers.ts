// Which trigger a run starts from. A workflow can hold several (say a Webhook and a Schedule); a given run is
// started by exactly one of them, and the others must not fire or overwrite {{input}}.

export type TriggerKind = "webhook" | "schedule" | "manual" | "other";
export type RunStart = "manual" | "webhook" | "schedule";

interface TriggerLike {
    id: string;
    label: string;
    config: Record<string, any>;
}

const text = (v: unknown) => (typeof v === "string" ? v : "").toLowerCase();

export function triggerKindOf(node: { label?: string; config?: Record<string, any> }): TriggerKind {
    const c = node.config ?? {};
    const p = c.parameters && typeof c.parameters === "object" ? c.parameters : {};
    const provider = `${text(c.provider)} ${text(c.source)} ${text(p.source)}`;
    const label = text(node.label);
    if (/webhook/.test(provider) || (!provider.trim() && /webhook/.test(label))) return "webhook";
    if (/schedule|cron/.test(provider) || c.cron !== undefined || p.cron !== undefined || (!provider.trim() && /\b(schedule|every|daily|hourly|weekly)\b/.test(label))) return "schedule";
    if (/manual/.test(provider) || (!provider.trim() && /manual/.test(label))) return "manual";
    return "other";
}

/** The trigger a run of this kind starts from, or undefined when the workflow has none that can. */
export function pickTrigger<T extends TriggerLike>(triggers: T[], start: RunStart): T | undefined {
    if (start === "webhook") return triggers.find((t) => triggerKindOf(t) === "webhook");
    if (start === "schedule") return triggers.find((t) => triggerKindOf(t) === "schedule");
    // A manual run (the Run button) starts from the first trigger, preferring a Manual one
    return triggers.find((t) => triggerKindOf(t) === "manual") ?? triggers[0];
}
