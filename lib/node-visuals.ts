import {
    Zap, Play, GitBranch, Database, Webhook, CalendarClock, FileInput, Hand, Mail, Globe,
    MessageSquare, Bell, Filter, Shuffle, Timer, SplitSquareVertical, HardDrive, FileJson,
    Table2, Upload, Sparkles, Cloud, Github, Search, Code2, FileText, CreditCard, Newspaper, type LucideIcon,
} from "lucide-react";

export type NodeKind = "trigger" | "action" | "logic" | "data";

export const nodeKindStyles: Record<NodeKind, {
    label: string;
    icon: LucideIcon;
    chip: string;      // icon chip: bg + text
    dot: string;       // solid color
    ring: string;      // selected / hover ring
    handle: string;
}> = {
    trigger: {
        label: "Trigger",
        icon: Zap,
        chip: "bg-node-trigger/10 text-node-trigger",
        dot: "bg-node-trigger",
        ring: "ring-node-trigger/40",
        handle: "!bg-node-trigger",
    },
    action: {
        label: "Action",
        icon: Play,
        chip: "bg-node-action text-background",
        dot: "bg-node-action",
        ring: "ring-node-action/30",
        handle: "!bg-node-action",
    },
    logic: {
        label: "Logic",
        icon: GitBranch,
        chip: "bg-node-logic/15 text-node-logic",
        dot: "bg-node-logic",
        ring: "ring-node-logic/40",
        handle: "!bg-node-logic",
    },
    data: {
        label: "Data",
        icon: Database,
        chip: "bg-node-data/10 text-node-data",
        dot: "bg-node-data",
        ring: "ring-node-data/40",
        handle: "!bg-node-data",
    },
};

export function normalizeKind(type?: string): NodeKind {
    return type === "trigger" || type === "logic" || type === "data" ? type : "action";
}

// Keyword → icon. First match wins, so order from most to least specific.
const ICON_RULES: [RegExp, LucideIcon][] = [
    [/webhook/i, Webhook],
    [/stripe|payment|billing|invoice/i, CreditCard],
    [/notion|confluence|docs?\b|wiki/i, FileText],
    [/wordpress|\bcms\b|blog/i, Newspaper],
    [/schedul|cron|interval|every|daily|hourly/i, CalendarClock],
    [/form|typeform/i, FileInput],
    [/manual|button|click/i, Hand],
    [/slack|discord|message|chat|sms|teams/i, MessageSquare],
    [/mail|gmail|smtp|resend|sendgrid/i, Mail],
    [/notif|alert|push/i, Bell],
    [/github|git\b/i, Github],
    [/ai\b|llm|gpt|prompt|summar|generat|classif|claude|llama|enrich/i, Sparkles],
    [/if\b|else|condition|check|compare|branch/i, SplitSquareVertical],
    [/filter/i, Filter],
    [/switch|route|router/i, Shuffle],
    [/delay|wait|sleep|timer/i, Timer],
    [/sql|database|postgres|mongo|query|db\b|supabase/i, HardDrive],
    [/json|transform|map|parse|format/i, FileJson],
    [/sheet|spreadsheet|csv|airtable|table/i, Table2],
    [/upload|storage|bucket|file|s3/i, Upload],
    [/search|scrape|crawl|rss|fetch/i, Search],
    [/http|api|request|rest|url/i, Globe],
    [/code|script|function/i, Code2],
    [/crm|salesforce|hubspot|clearbit|cloud/i, Cloud],
];

export function iconForNode(label?: string, kind: NodeKind = "action", config?: Record<string, unknown>): LucideIcon {
    const haystack = [label, config?.provider, config?.platform, config?.source].filter(Boolean).join(" ");
    for (const [re, icon] of ICON_RULES) {
        if (re.test(haystack)) return icon;
    }
    return nodeKindStyles[kind].icon;
}

/** A short, human subtitle for a node card, pulled from its config. */
export function subtitleForNode(description?: string, config?: Record<string, unknown>): string {
    if (config) {
        const preferred = ["provider", "platform", "url", "channel", "cron", "path", "condition", "model", "table", "to"];
        for (const key of preferred) {
            const v = config[key];
            if (v !== undefined && v !== "" && typeof v !== "object") return String(v);
        }
    }
    return description || "";
}
