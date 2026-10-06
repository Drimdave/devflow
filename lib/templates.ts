import { editorPositions, type DemoGraph, type DemoKind } from "./demo-graph";

// ONE list of templates, used everywhere: the landing page demo and use-case cards, the
// dashboard, and the editor's template panel. Each template carries its real graph, so a
// preview is exactly what you get, and "Use template" can load it instantly with no AI call.

export type TemplateCategory = "Sales" | "Engineering" | "Support" | "Finance" | "Marketing" | "Data" | "Productivity";

export interface Template {
    id: string;
    name: string;
    category: TemplateCategory;
    description: string;
    /** One plain-English sentence: shown in the demo prompt box and as the "describe it" example. */
    prompt: string;
    graph: DemoGraph;
    /** Show on the dashboard. */
    featured?: boolean;
    /** Show on the landing page as "<role> can <title>". */
    landing?: { role: string; title: string };
}

type N = [id: string, type: DemoKind, label: string, description: string, provider?: string];
type E = [source: string, target: string, label?: "true" | "false"];

function graph(title: string, nodes: N[], edges: E[]): DemoGraph {
    return {
        title,
        nodes: nodes.map(([id, type, label, description, provider]) => ({ id, type, label, description, provider })),
        edges: edges.map(([source, target, label]) => ({ source, target, label })),
    };
}

export const TEMPLATES: Template[] = [
    {
        id: "lead-routing",
        name: "Lead routing",
        category: "Sales",
        description: "Enrich new leads with AI and send enterprise ones straight to sales on Slack.",
        prompt: "Route enterprise leads to Slack",
        featured: true,
        landing: { role: "Sales", title: "Route leads to the right channel" },
        graph: graph("Lead routing", [
            ["n1", "trigger", "New lead", "Webhook · POST /leads", "webhook"],
            ["n2", "action", "Enrich with AI", "Company size and industry", "openai"],
            ["n3", "logic", "Enterprise?", "employees > 500"],
            ["n4", "action", "Notify sales", "Slack · #enterprise", "slack"],
            ["n5", "data", "Add to nurture list", "Google Sheets", "sheets"],
        ], [["n1", "n2"], ["n2", "n3"], ["n3", "n4", "true"], ["n3", "n5", "false"]]),
    },
    {
        id: "issue-alerts",
        name: "Issue alerts",
        category: "Engineering",
        description: "Post new GitHub issues to Slack, and log the non-bugs to a backlog sheet.",
        prompt: "Post new GitHub issues to Slack",
        landing: { role: "Engineering", title: "Keep issues out of the void" },
        graph: graph("Issue alerts", [
            ["n1", "trigger", "New issue", "GitHub · issues.opened", "github"],
            ["n2", "logic", "Labeled bug?", "labels contains bug"],
            ["n3", "action", "Alert #bugs", "Slack · @oncall", "slack"],
            ["n4", "data", "Log to backlog", "Google Sheets", "sheets"],
        ], [["n1", "n2"], ["n2", "n3", "true"], ["n2", "n4", "false"]]),
    },
    {
        id: "morning-digest",
        name: "Morning digest",
        category: "Productivity",
        description: "Every morning, summarize your unread email with AI and DM yourself the highlights.",
        prompt: "Summarize my emails with AI every morning",
        featured: true,
        landing: { role: "Founders", title: "Start the day with a digest" },
        graph: graph("Morning digest", [
            ["n1", "trigger", "Every day, 8am", "Schedule · 0 8 * * *", "schedule"],
            ["n2", "action", "Fetch unread mail", "Gmail · inbox", "gmail"],
            ["n3", "action", "Summarize with AI", "Top 5 action items", "openai"],
            ["n4", "action", "Send digest", "Slack · DM to me", "slack"],
        ], [["n1", "n2"], ["n2", "n3"], ["n3", "n4"]]),
    },
    {
        id: "support-triage",
        name: "Support triage",
        category: "Support",
        description: "Classify each new ticket by urgency, page on-call for urgent ones, backlog the rest.",
        prompt: "Classify support tickets with AI and page the on-call engineer on Discord if urgent",
        featured: true,
        landing: { role: "Support", title: "Triage tickets by urgency" },
        graph: graph("Support triage", [
            ["n1", "trigger", "New ticket", "Webhook · helpdesk", "webhook"],
            ["n2", "action", "Classify urgency", "AI · low / normal / urgent", "openai"],
            ["n3", "logic", "Urgent?", "urgency = urgent"],
            ["n4", "action", "Page on-call", "Discord · #oncall", "discord"],
            ["n5", "data", "Add to backlog", "Notion · Support", "notion"],
        ], [["n1", "n2"], ["n2", "n3"], ["n3", "n4", "true"], ["n3", "n5", "false"]]),
    },
    {
        id: "failed-payments",
        name: "Failed payment alerts",
        category: "Finance",
        description: "When a Stripe payment fails, alert finance on big amounts and email the customer on small ones.",
        prompt: "When a Stripe payment fails, email the customer and alert finance on Slack if it is over $500",
        featured: true,
        landing: { role: "Finance", title: "Catch failed payments fast" },
        graph: graph("Failed payment alerts", [
            ["n1", "trigger", "Payment failed", "Stripe · invoice.payment_failed", "stripe"],
            ["n2", "logic", "Over $500?", "amount > 500"],
            ["n3", "action", "Alert finance", "Slack · #finance", "slack"],
            ["n4", "action", "Email customer", "Retry link via Resend", "email"],
        ], [["n1", "n2"], ["n2", "n3", "true"], ["n2", "n4", "false"]]),
    },
    {
        id: "sheet-sync",
        name: "Postgres to Sheets",
        category: "Data",
        description: "Hourly, copy new database rows into a Google Sheet and post the count to Slack.",
        prompt: "Every hour, copy new Postgres rows into a Google Sheet and post a count to Slack",
        landing: { role: "Data teams", title: "Keep a sheet in sync" },
        graph: graph("Postgres to Sheets", [
            ["n1", "trigger", "Every hour", "Schedule · 0 * * * *", "schedule"],
            ["n2", "data", "Query new rows", "Postgres · since last run", "postgres"],
            ["n3", "data", "Append to sheet", "Google Sheets", "sheets"],
            ["n4", "action", "Post the count", "Slack · #data", "slack"],
        ], [["n1", "n2"], ["n2", "n3"], ["n3", "n4"]]),
    },
    {
        id: "database-sync",
        name: "Database sync",
        category: "Data",
        description: "Keep a destination database in step with a source on a schedule.",
        prompt: "Every hour, sync updated records from PostgreSQL into MongoDB",
        graph: graph("Database sync", [
            ["n1", "trigger", "Every hour", "Schedule · 0 * * * *", "schedule"],
            ["n2", "data", "Query source", "PostgreSQL · updated_at", "postgres"],
            ["n3", "action", "Transform", "Map to new schema", "json"],
            ["n4", "data", "Upsert records", "MongoDB · destination", "mongo"],
        ], [["n1", "n2"], ["n2", "n3"], ["n3", "n4"]]),
    },
    {
        id: "metric-alerts",
        name: "Metric alerts",
        category: "Engineering",
        description: "Every 5 minutes, check a metric and alert Slack the moment it crosses a threshold.",
        prompt: "Every 5 minutes, fetch metrics from our monitoring API and alert Slack if any exceed the threshold",
        graph: graph("Metric alerts", [
            ["n1", "trigger", "Every 5 minutes", "Schedule · */5 * * * *", "schedule"],
            ["n2", "action", "Fetch metrics", "HTTP · monitoring API", "http"],
            ["n3", "logic", "Over threshold?", "value > limit"],
            ["n4", "action", "Alert Slack", "Slack · #alerts", "slack"],
        ], [["n1", "n2"], ["n2", "n3"], ["n3", "n4", "true"]]),
    },
    {
        id: "content-pipeline",
        name: "Content pipeline",
        category: "Marketing",
        description: "Pull trending topics, draft a post with AI, review it, then publish.",
        prompt: "Fetch trending topics from an RSS feed, draft a blog post with AI, review it, and publish to WordPress",
        graph: graph("Content pipeline", [
            ["n1", "trigger", "Run manually", "Manual trigger", "manual"],
            ["n2", "action", "Fetch topics", "RSS feed", "rss"],
            ["n3", "action", "Draft post", "AI · blog draft", "openai"],
            ["n4", "logic", "Passes review?", "quality > 7"],
            ["n5", "action", "Publish", "WordPress", "wordpress"],
        ], [["n1", "n2"], ["n2", "n3"], ["n3", "n4"], ["n4", "n5", "true"]]),
    },
];

export function getTemplate(id: string): Template | undefined {
    return TEMPLATES.find((t) => t.id === id);
}

/** Match typed text to a template by its prompt, ignoring case and spacing. */
export function findTemplateByPrompt(text: string): Template | undefined {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    return TEMPLATES.find((t) => norm(t.prompt) === norm(text));
}

/** Test payloads so a template runs meaningfully the moment it's opened (the trigger's "sample"). */
const SAMPLES: Record<string, Record<string, unknown>> = {
    "lead-routing": { name: "Priya Shah", email: "priya@acme.io", company: "Acme", employees: 1200 },
    "issue-alerts": { title: "Login button misaligned", labels: "bug,ui", url: "https://github.com/acme/app/issues/42" },
    "support-triage": { subject: "Checkout is down for everyone", body: "Customers can't pay since 9am.", urgency: "urgent" },
    "failed-payments": { customer: "cus_123", email: "customer@example.com", amount: 300, currency: "usd" },
    "metric-alerts": { value: 95, limit: 80 },
    "content-pipeline": { topic: "AI workflow automation", quality: 8 },
};

/** The flat node/edge shape the editor canvas loads, with proper positions. */
export function toEditorWorkflow(template: Template) {
    const pos = editorPositions(template.graph);
    return {
        nodes: template.graph.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            label: n.label,
            description: n.description,
            position: pos.get(n.id) ?? { x: 350, y: 0 },
            config: {
                ...(n.provider ? { provider: n.provider } : {}),
                ...(n.type === "logic" && n.description ? { condition: n.description } : {}),
                ...(n.type === "trigger" && SAMPLES[template.id] ? { sample: JSON.stringify(SAMPLES[template.id]) } : {}),
                ...(n.provider === "schedule" ? { cron: n.description.match(/·\s*([\d*\/,\- ]+)$/)?.[1]?.trim() ?? "0 * * * *" } : {}),
                ...(n.provider === "openai" && n.description ? { prompt: n.description } : {}),
                ...(n.provider === "email"
                    ? { provider: "Resend", apiKey: "{{secrets.RESEND_API_KEY}}", to: "{{input.email}}", subject: n.label, text: n.description || n.label }
                    : {}),
            },
        })),
        edges: template.graph.edges.map((e, i) => ({
            id: `e${i + 1}`,
            source: e.source,
            target: e.target,
            label: e.label ?? null,
        })),
    };
}
