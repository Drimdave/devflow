import { ConditionError, evaluateCondition } from "./condition";
import { SWITCH_DEFAULT, isSwitchNode, switchCases } from "./switch";
import { makeRedactor } from "./redact";
import { safeFetch } from "./safe-fetch";
import { lookup, resolveDeep, resolveString } from "./template";
import type { EngineNode, ExecResult, RunContext } from "./types";

/** Thrown by an executor when it fails but still has useful output to show (e.g. an HTTP 404 body). */
export class ExecError extends Error {
    constructor(message: string, public output?: unknown) {
        super(message);
    }
}

export type NodeExecKind = "trigger" | "delay" | "condition" | "http" | "llm" | "chat" | "email" | "switch" | "database" | "transform" | "simulated";

/** Outbound HTTP goes through here so tests can stand in for the network. */
export const httpClient = { fetch: safeFetch };

/** Read a setting from the node's config, or from config.parameters (the shape the AI generates). */
export function setting(node: EngineNode, key: string): any {
    const c = node.config ?? {};
    return c[key] ?? (c.parameters && typeof c.parameters === "object" ? c.parameters[key] : undefined);
}

const text = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : JSON.stringify(v));

/** Decide which real behaviour (if any) a node has, from its type, provider, label and settings. */
export function kindOf(node: EngineNode): NodeExecKind {
    const provider = text(node.config?.provider ?? node.config?.platform).toLowerCase();
    const label = node.label.toLowerCase();
    const both = `${provider} ${label}`;

    if (node.type === "trigger") return "trigger";
    if (/\b(delay|wait|sleep)\b/.test(both) && (node.type === "logic" || setting(node, "duration_ms") !== undefined || setting(node, "duration") !== undefined)) return "delay";
    if (node.type === "logic") return isSwitchNode(node.label, node.config) ? "switch" : "condition";
    if (/slack|discord|teams/.test(provider)) return "chat";
    if (/^(resend|email|smtp|sendgrid|mailgun|ses|postmark)$/.test(provider) || /^(send )?e-?mails?\b/.test(label)) return "email";
    if (/^(postgres|postgresql|pg|neon|database|sql|mysql|mongo|mongodb|supabase)$/.test(provider) || /\b(database|sql)\b/.test(label)) return "database";
    if (setting(node, "url") !== undefined) return "http";
    if (/^(openai|ai|llm|anthropic|groq)$/.test(provider) || /\b(ai prompt|summari[sz]e|classif|generate|draft)\b|with ai\b/.test(label)) return "llm";
    if (/\b(json|transform|set|map|reshape)\b/.test(both)) return "transform";
    return "simulated";
}

const vars = (ctx: RunContext): Record<string, unknown> => ({ ...ctx.outputs, input: ctx.input, secrets: ctx.secrets });
/** Same, without credentials: AI prompts must never see them. */
const varsNoSecrets = (ctx: RunContext): Record<string, unknown> => ({ ...ctx.outputs, input: ctx.input });

const SECRET_REF = /\{\{\s*secrets\.([A-Za-z0-9_]+)/g;
const SECRET_TOKEN = /\{\{\s*secrets\.[A-Za-z0-9_]+\s*\}\}/g;
/** Only nodes that send data OUT may hold a credential; anywhere else it could be copied into data that flows onward. */
const SECRET_SINKS: NodeExecKind[] = ["http", "chat", "email", "database"];

/**
 * True when the host part of a URL template is fixed in the node (only literal text or {{secrets.X}}).
 * A credential must never be attached to a request whose destination is chosen by incoming data,
 * or a webhook caller could point it at their own server and read the credential.
 */
export function authorityIsFixed(rawUrl: string): boolean {
    const rest = rawUrl.trim().replace(/^https?:\/\//i, "");
    const end = rest.search(/[\/?#]/);
    const authority = end === -1 ? rest : rest.slice(0, end);
    return authority.length > 0 && !authority.replace(SECRET_TOKEN, "").includes("{{");
}

const mentionsSecret = (v: unknown) => /\{\{\s*secrets\./.test(JSON.stringify(v ?? ""));

/** Fail before anything is sent if a node references a credential that isn't saved (or uses one where it must not). */
function checkSecretRefs(node: EngineNode, kind: NodeExecKind, ctx: RunContext) {
    let json: string;
    try {
        // A missing email API key isn't an error: the node reports itself as simulated instead
        const cfg: Record<string, unknown> = { ...(node.config ?? {}) };
        if (kind === "database") {
            delete cfg.connection;
            delete cfg.connectionString;
        }
        if (kind === "email") {
            delete cfg.apiKey;
            delete cfg.api_key;
            if (cfg.parameters && typeof cfg.parameters === "object") cfg.parameters = { ...(cfg.parameters as object), apiKey: undefined, api_key: undefined };
        }
        json = JSON.stringify(cfg);
    } catch { return; }
    for (const m of json.matchAll(SECRET_REF)) {
        if (kind === "llm") throw new ExecError("Saved credentials can't be used in AI prompts");
        if (!SECRET_SINKS.includes(kind)) throw new ExecError("Saved credentials can only be used in HTTP request, message, email and database nodes");
        if (!(m[1] in ctx.secrets)) throw new ExecError(`Credential ${m[1]} isn't saved. Add it in Settings → Credentials.`);
    }
}

function parseMaybeJson(v: unknown): unknown {
    if (typeof v !== "string") return v;
    const t = v.trim();
    if (!t || !/^[\[{]/.test(t)) return v;
    try {
        return JSON.parse(t);
    } catch {
        return v;
    }
}

// ── trigger ─────────────────────────────────────────────────────────────

async function runTrigger(node: EngineNode, ctx: RunContext): Promise<ExecResult> {
    if (ctx.triggerInput !== undefined) return { output: ctx.triggerInput, note: "Used the test data you provided" };
    const sample = parseMaybeJson(setting(node, "sample"));
    if (sample !== undefined && typeof sample === "object") return { output: sample, note: "Used this trigger's sample data" };
    return { output: {}, note: "No test data, so downstream nodes see an empty payload. Add a JSON \"sample\" field to this trigger." };
}

// ── delay ───────────────────────────────────────────────────────────────

async function runDelay(node: EngineNode, ctx: RunContext): Promise<ExecResult> {
    const raw = Number(setting(node, "duration_ms") ?? setting(node, "duration") ?? 1000);
    const wanted = Number.isFinite(raw) && raw >= 0 ? raw : 1000;
    const ms = Math.min(wanted, 5000, Math.max(0, ctx.deadline - Date.now()));
    await new Promise((r) => setTimeout(r, ms));
    return { output: { waitedMs: Math.round(ms) }, note: wanted > ms ? `Capped at ${Math.round(ms)}ms for test runs` : undefined };
}

// ── condition (If/Else, Filter) ─────────────────────────────────────────

const OP_WORDS: Record<string, string> = {
    equals: "==", equal: "==", eq: "==", is: "==", not_equals: "!=", ne: "!=",
    greater_than: ">", gt: ">", less_than: "<", lt: "<", gte: ">=", lte: "<=",
    contains: "contains", not_contains: "!contains", starts_with: "startsWith", ends_with: "endsWith",
};

function conditionExpression(node: EngineNode): string | undefined {
    const direct = setting(node, "condition");
    if (typeof direct === "string" && direct.trim()) return direct;
    if (typeof direct === "boolean") return String(direct);
    // Filter-style: field + operator + value
    const field = setting(node, "field");
    if (field) return `${field} ${OP_WORDS[text(setting(node, "operator")).toLowerCase()] ?? "=="} ${text(setting(node, "value"))}`;
    // AI-generated: parameters.value + operation + parameters.match / compare / threshold
    const value = setting(node, "value");
    const operation = text(node.config?.operation).toLowerCase();
    const rhs = setting(node, "match") ?? setting(node, "compare") ?? setting(node, "threshold") ?? setting(node, "equals");
    if (value !== undefined && rhs !== undefined) return `${text(value)} ${OP_WORDS[operation] ?? "=="} ${text(rhs)}`;
    return undefined;
}

async function runCondition(node: EngineNode, ctx: RunContext): Promise<ExecResult> {
    const expr = conditionExpression(node);
    if (!expr) throw new ExecError('This condition has no expression. Open its settings and add one, like {{input.amount}} > 500');
    let result: boolean;
    try {
        result = evaluateCondition(expr, vars(ctx));
    } catch (e) {
        if (e instanceof ConditionError) throw new ExecError(e.message);
        throw e;
    }
    return { output: { condition: expr, result }, branch: result ? "true" : "false", note: `${expr}  →  ${result ? "Yes" : "No"}` };
}

// ── switch ──────────────────────────────────────────────────────────────

async function runSwitch(node: EngineNode, ctx: RunContext): Promise<ExecResult> {
    const cases = switchCases(node.config);
    if (!cases.length) throw new ExecError('This switch has no cases. Add a "cases" field like: urgent, normal, low');
    const v = vars(ctx);
    const configured = setting(node, "value") ?? setting(node, "key") ?? setting(node, "field");
    if (configured === undefined || text(configured).trim() === "") throw new ExecError('Set a "value" to switch on, like {{input.status}}');
    const expr = text(configured).trim();
    // "status" on its own means the field of that name in the incoming data
    const resolved = /\{\{/.test(expr) ? resolveString(expr, v, ctx.warnings) : lookup(v, expr);
    const actual = text(resolved).trim();
    const hit = cases.find((c) => c.toLowerCase() === actual.toLowerCase());
    const branch = hit ?? SWITCH_DEFAULT;
    return { output: { value: resolved ?? null, matched: branch }, branch, note: `${actual === "" ? "(empty)" : actual}  →  ${hit ? hit : "default"}` };
}

// ── database (Postgres on Neon) ─────────────────────────────────────────

/** The one place that talks to the database, so tests can replace it. */
export const dbClient = {
    async query(connection: string, sqlText: string, params: unknown[]): Promise<unknown[]> {
        const { neon } = await import("@neondatabase/serverless");
        const run = neon(connection);
        return (await run.query(sqlText, params)) as unknown[];
    },
};

const MAX_ROWS = 100;
const WRITE_WORDS = /\b(insert|update|delete)\b/i; // catches data-modifying CTEs inside a WITH

/** Turns {{tokens}} in the SQL into $1, $2… so data is always sent as parameters, never pasted into the statement. */
function parameterize(query: string, v: Record<string, unknown>, ctx: RunContext): { text: string; params: unknown[] } {
    const params: unknown[] = [];
    // A token the author wrapped in quotes ('{{input.id}}') is still one parameter; the quotes are dropped
    const out = query.replace(/'\{\{\s*([^{}]+?)\s*\}\}'|\{\{\s*([^{}]+?)\s*\}\}/g, (_m, quoted: string | undefined, bare: string | undefined) => {
        const path = (quoted ?? bare) as string;
        if (/^secrets\./i.test(path)) throw new ExecError("Credentials can't be used inside a SQL query");
        const val = lookup(v, path);
        if (val === undefined) ctx.warnings.push(`{{${path}}} had no value`);
        params.push(val === undefined ? null : typeof val === "object" && val !== null ? JSON.stringify(val) : val);
        return `$${params.length}`;
    });
    return { text: out, params };
}

function hostOf(url: string): string | null {
    try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

async function runDatabase(node: EngineNode, ctx: RunContext): Promise<ExecResult> {
    const provider = text(node.config?.provider).toLowerCase();
    const rawConn = text(setting(node, "connection") ?? setting(node, "connectionString")).trim();
    const query = text(setting(node, "query") ?? setting(node, "sql")).trim().replace(/;+\s*$/, "");

    if (provider && !/^(postgres|postgresql|pg|neon|database|sql)$/.test(provider)) {
        return { status: "simulated", output: { simulated: true }, note: `Simulated: DevFlow runs queries on Postgres (Neon) only; "${provider}" isn't supported yet.` };
    }
    if (rawConn && !/\{\{\s*secrets\./.test(rawConn)) {
        throw new ExecError("Don't paste a connection string into a node. Save it in Settings → Credentials and use {{secrets.POSTGRES_URL}}");
    }
    const conn = text(resolveString(rawConn, vars(ctx), ctx.warnings)).trim();
    if (!conn || !query) {
        return { status: "simulated", output: { simulated: true }, note: !query && conn ? "Nothing ran. Add a SQL query to this node." : "Nothing ran. Save your Postgres (Neon) connection string in Settings → Credentials, then set this node's connection to {{secrets.POSTGRES_URL}} and add a query." };
    }

    const host = hostOf(conn);
    if (!/^postgres(ql)?:\/\//i.test(conn) || !host) throw new ExecError("That doesn't look like a Postgres connection string (postgresql://…)");
    if (!host.endsWith(".neon.tech")) throw new ExecError("Only Neon databases are supported for now (host must end in .neon.tech)");
    const own = hostOf(process.env.DATABASE_URL ?? "");
    if (own && host === own) throw new ExecError("Workflows can't query DevFlow's own database");

    const allowWrites = /^(true|yes|1)$/i.test(text(setting(node, "allowWrites")).trim());
    const first = query.replace(/^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, "").split(/\s/)[0].toLowerCase();
    const isRead = ["select", "with", "show", "explain", "values", "table"].includes(first);
    if (query.includes(";")) throw new ExecError("Run one statement per node (remove the extra ;)");
    if (isRead && WRITE_WORDS.test(query) && !allowWrites) throw new ExecError('This query contains a write keyword. Writing is off by default; set "allowWrites" to true on this node to allow INSERT/UPDATE/DELETE.');
    if (!isRead) {
        if (!allowWrites) throw new ExecError('Only SELECT queries run by default. Set "allowWrites" to true on this node to allow INSERT/UPDATE/DELETE.');
        if (!["insert", "update", "delete"].includes(first)) throw new ExecError("Only INSERT, UPDATE and DELETE are allowed as write statements");
    }

    const { text: sqlText, params } = parameterize(query, vars(ctx), ctx);
    const remaining = ctx.deadline - Date.now();
    if (remaining < 500) throw new ExecError("The run ran out of time before this query");
    ctx.log("Running SQL…");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const rows = (await Promise.race([
            dbClient.query(conn, sqlText, params),
            new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new ExecError("The query took too long (10s limit)")), Math.min(10_000, remaining)); }),
        ])) as unknown[];
        const list = Array.isArray(rows) ? rows : [];
        const clipped = list.slice(0, MAX_ROWS);
        return {
            output: { rowCount: list.length, rows: clipped, ...(list.length > MAX_ROWS ? { truncated: true } : {}) },
            note: `${isRead ? "Read" : "Wrote"} ${list.length} row${list.length === 1 ? "" : "s"}${list.length > MAX_ROWS ? ` (showing ${MAX_ROWS})` : ""}`,
        };
    } catch (e: any) {
        if (e instanceof ExecError) throw e;
        throw new ExecError(String(e?.message || "The query failed").slice(0, 300));
    } finally {
        if (timer) clearTimeout(timer);
    }
}

// ── http ────────────────────────────────────────────────────────────────

const VERBS = ["get", "post", "put", "patch", "delete", "head"];

async function runHttp(node: EngineNode, ctx: RunContext): Promise<ExecResult> {
    if (++ctx.counters.http > ctx.limits.maxHttpCalls) throw new ExecError(`A run can make at most ${ctx.limits.maxHttpCalls} HTTP requests`);
    const v = vars(ctx);
    const rawUrl = text(setting(node, "url"));
    if (mentionsSecret([rawUrl, setting(node, "headers"), setting(node, "body")]) && !authorityIsFixed(rawUrl)) {
        throw new ExecError("This request uses a saved credential, so its address must start with a fixed host (like https://api.example.com/…). The host can't come from incoming data.");
    }
    const url = text(resolveString(rawUrl, v, ctx.warnings)).trim();
    if (!url) throw new ExecError("This request has no URL");

    const op = text(node.config?.operation).toLowerCase();
    const method = text(setting(node, "method") ?? (VERBS.includes(op) ? op : "GET")).toUpperCase();

    const rawHeaders = parseMaybeJson(setting(node, "headers"));
    const headers: Record<string, string> = {};
    if (rawHeaders && typeof rawHeaders === "object") {
        for (const [k, val] of Object.entries(resolveDeep(rawHeaders as Record<string, unknown>, v, ctx.warnings))) headers[k] = text(val);
    }

    let body: string | undefined;
    const rawBody = parseMaybeJson(setting(node, "body"));
    if (rawBody !== undefined && method !== "GET" && method !== "HEAD") {
        const resolved = resolveDeep(rawBody, v, ctx.warnings);
        if (typeof resolved === "string") body = resolved;
        else {
            body = JSON.stringify(resolved);
            if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) headers["content-type"] = "application/json";
        }
    }

    const remaining = ctx.deadline - Date.now();
    if (remaining < 500) throw new ExecError("The run ran out of time before this request");
    ctx.log(`${method} ${url}`);
    let res;
    try {
        res = await httpClient.fetch(url, { method, headers, body, timeoutMs: Math.min(10_000, remaining) });
    } catch (e: any) {
        throw new ExecError(e?.message || "Request failed");
    }

    const isJson = /json/i.test(res.headers["content-type"] ?? "");
    let parsed: unknown = res.body;
    if (isJson) {
        try { parsed = JSON.parse(res.body); } catch { /* keep text */ }
    }
    const output = { status: res.status, ok: res.status < 400, url: res.url, body: parsed, ...(res.truncated ? { truncated: true } : {}) };
    if (res.status >= 400) throw new ExecError(`HTTP ${res.status} ${res.statusText}`.trim(), output);
    return { output, note: `${method} ${url} → ${res.status}${res.truncated ? " (response truncated)" : ""}` };
}

// ── llm ─────────────────────────────────────────────────────────────────

async function runLlm(node: EngineNode, ctx: RunContext): Promise<ExecResult> {
    if (++ctx.counters.llm > ctx.limits.maxLlmCalls) throw new ExecError(`A run can make at most ${ctx.limits.maxLlmCalls} AI calls`);
    const v = varsNoSecrets(ctx);
    const configured = setting(node, "prompt") ?? setting(node, "instruction") ?? setting(node, "text");
    const basePrompt = text(resolveString(text(configured) || node.label, v, ctx.warnings)).slice(0, 6000);
    const referencesData = typeof configured === "string" && /\{\{/.test(configured);
    const prevJson = ctx.previous === undefined ? "" : text(ctx.previous).slice(0, 4000);
    const redact = makeRedactor(ctx.secrets);
    const prompt = redact.str(referencesData || !prevJson ? basePrompt : `${basePrompt}\n\nInput data:\n${prevJson}`);

    const { groq, GROQ_MODEL } = await import("../workflow-ai"); // lazy: needs GROQ_API_KEY only when an AI node actually runs
    const models = [text(setting(node, "model")) || GROQ_MODEL, "openai/gpt-oss-20b"].filter((m, i, a) => m && a.indexOf(m) === i);
    let lastErr: unknown;
    ctx.log("Asking the AI model…");
    for (const model of models) {
        try {
            const completion = await groq.chat.completions.create({
                model,
                temperature: 0.3,
                max_completion_tokens: 1200,
                ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" as const } : {}),
                messages: [
                    { role: "system", content: "You are one step in an automated workflow. Do exactly what the instruction says, using the input data. Reply with only the result: no preamble, no explanation." },
                    { role: "user", content: prompt },
                ],
            });
            const out = completion.choices[0]?.message?.content?.trim() ?? "";
            return { output: { text: out, model }, note: `${model}` };
        } catch (e: any) {
            lastErr = e;
            const s = e?.status;
            if (!(s === 429 || s === 404 || (typeof s === "number" && s >= 500))) break;
        }
    }
    throw new ExecError((lastErr as any)?.message?.slice(0, 200) || "The AI call failed");
}

// ── chat (Slack / Discord incoming webhooks) ────────────────────────────

async function runChat(node: EngineNode, ctx: RunContext): Promise<ExecResult> {
    const v = vars(ctx);
    const provider = text(node.config?.provider ?? node.config?.platform).toLowerCase();
    const rawWebhook = text(setting(node, "webhookUrl") ?? setting(node, "webhook_url") ?? setting(node, "webhook") ?? setting(node, "url"));
    if (mentionsSecret(rawWebhook) && !authorityIsFixed(rawWebhook)) throw new ExecError("The webhook address uses a saved credential, so its host can't come from incoming data.");
    const webhook = text(resolveString(text(setting(node, "webhookUrl") ?? setting(node, "webhook_url") ?? setting(node, "webhook") ?? setting(node, "url")), v, ctx.warnings)).trim();
    const message = text(resolveString(text(setting(node, "text") ?? setting(node, "message") ?? setting(node, "content")) || `${node.label}\n${text(ctx.previous).slice(0, 500)}`, v, ctx.warnings)).slice(0, 1900);

    if (!webhook) {
        return {
            status: "simulated",
            output: { wouldSend: message, to: setting(node, "channel") ?? provider },
            note: `Nothing was sent. Add a ${provider || "chat"} webhook URL in this node's settings to post for real.`,
        };
    }
    if (++ctx.counters.http > ctx.limits.maxHttpCalls) throw new ExecError(`A run can make at most ${ctx.limits.maxHttpCalls} HTTP requests`);
    const payload = provider.includes("discord") ? { content: message } : { text: message };
    let res;
    try {
        res = await httpClient.fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), timeoutMs: Math.min(10_000, Math.max(500, ctx.deadline - Date.now())) });
    } catch (e: any) {
        throw new ExecError(e?.message || "Couldn't reach the webhook");
    }
    if (res.status >= 400) throw new ExecError(`${provider || "Webhook"} rejected the message (HTTP ${res.status})`, { status: res.status, body: res.body.slice(0, 300) });
    return { output: { delivered: true, status: res.status, message }, note: `Posted to ${provider || "webhook"}` };
}

// ── email (Resend) ──────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
const MAX_RECIPIENTS = 5;
const bareAddress = (a: string) => (a.match(/<([^>]+)>\s*$/)?.[1] ?? a).trim();

function recipients(raw: unknown): string[] {
    const list = Array.isArray(raw) ? raw : text(raw).split(/[,;]/);
    return list.map((x) => text(x).trim()).filter(Boolean);
}

async function runEmail(node: EngineNode, ctx: RunContext): Promise<ExecResult> {
    const v = vars(ctx);
    const provider = text(node.config?.provider).toLowerCase();
    const str = (key: string) => text(resolveString(text(setting(node, key)), v, ctx.warnings)).trim();

    const to = recipients(resolveDeep(setting(node, "to") ?? "", v, ctx.warnings));
    const subject = str("subject").slice(0, 200);
    const textBody = text(resolveString(text(setting(node, "text") ?? setting(node, "body") ?? setting(node, "message")), v, ctx.warnings)).slice(0, 20_000);
    const html = str("html").slice(0, 50_000);
    const apiKey = str("apiKey") || str("api_key");
    const from = str("from") || "DevFlow <onboarding@resend.dev>";
    const replyTo = str("replyTo") || str("reply_to");
    const rawKey = text(setting(node, "apiKey") ?? setting(node, "api_key")).trim();
    if (rawKey && !/\{\{\s*secrets\./.test(rawKey)) {
        throw new ExecError("Don't paste an API key into a node. Save it in Settings → Credentials and use {{secrets.RESEND_API_KEY}}");
    }

    // Validate first so a misconfigured node explains itself even when it would only be simulated
    if (!to.length) throw new ExecError('Add a recipient in the "to" field');
    if (to.length > MAX_RECIPIENTS) throw new ExecError(`At most ${MAX_RECIPIENTS} recipients per email`);
    const badAddr = [...to, bareAddress(from), ...(replyTo ? [replyTo] : [])].find((a) => !EMAIL_RE.test(bareAddress(a)));
    if (badAddr) throw new ExecError(`"${badAddr}" isn't a valid email address`);
    if (!subject) throw new ExecError('Add a subject');
    if (!textBody && !html) throw new ExecError('Add a message (text)');

    if (provider && !/^(resend|email)$/.test(provider)) {
        return { status: "simulated", output: { wouldSend: { to, subject } }, note: `Simulated: DevFlow sends email through Resend only; "${provider}" isn't supported yet. Set provider to Resend.` };
    }
    if (!apiKey) {
        return { status: "simulated", output: { wouldSend: { to, subject, text: textBody.slice(0, 500) } }, note: "Nothing was sent. Save your Resend API key in Settings → Credentials and set this node's apiKey to {{secrets.RESEND_API_KEY}}." };
    }

    if (++ctx.counters.email > ctx.limits.maxEmails) throw new ExecError(`A run can send at most ${ctx.limits.maxEmails} emails`);
    const blocked = await ctx.emailGate?.();
    if (blocked) throw new ExecError(blocked);
    if (++ctx.counters.http > ctx.limits.maxHttpCalls) throw new ExecError(`A run can make at most ${ctx.limits.maxHttpCalls} HTTP requests`);

    ctx.log(`Sending email to ${to.length} recipient${to.length > 1 ? "s" : ""}…`);
    let res;
    try {
        res = await httpClient.fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
            body: JSON.stringify({ from, to, subject, ...(textBody ? { text: textBody } : {}), ...(html ? { html } : {}), ...(replyTo ? { reply_to: replyTo } : {}) }),
            timeoutMs: Math.min(10_000, Math.max(500, ctx.deadline - Date.now())),
        });
    } catch (e: any) {
        throw new ExecError(e?.message || "Couldn't reach Resend");
    }

    let body: any = res.body;
    try { body = JSON.parse(res.body); } catch { /* keep text */ }
    if (res.status >= 400) {
        const why = typeof body === "object" && body?.message ? String(body.message) : `HTTP ${res.status}`;
        throw new ExecError(`Resend rejected the email: ${why}`, { status: res.status });
    }
    return { output: { sent: true, id: body?.id, to, subject }, note: `Emailed ${to.join(", ")} via Resend` };
}

// ── transform ───────────────────────────────────────────────────────────

async function runTransform(node: EngineNode, ctx: RunContext): Promise<ExecResult> {
    const mapping = parseMaybeJson(setting(node, "mapping"));
    if (mapping === undefined || mapping === "" || (typeof mapping === "object" && mapping !== null && !Object.keys(mapping).length)) {
        return { output: ctx.previous ?? ctx.input ?? {}, note: "No mapping set, so the data passed through unchanged" };
    }
    return { output: resolveDeep(mapping, vars(ctx), ctx.warnings) };
}

// ── simulated (no real integration yet) ─────────────────────────────────

async function runSimulated(node: EngineNode): Promise<ExecResult> {
    const what = text(node.config?.provider) || node.label;
    return {
        status: "simulated",
        output: { simulated: true },
        note: `Simulated: DevFlow has no real "${what}" integration yet, so nothing external happened.`,
    };
}

export async function executeNode(node: EngineNode, ctx: RunContext): Promise<ExecResult> {
    const kind = kindOf(node);
    checkSecretRefs(node, kind, ctx);
    switch (kind) {
        case "trigger": return runTrigger(node, ctx);
        case "delay": return runDelay(node, ctx);
        case "condition": return runCondition(node, ctx);
        case "http": return runHttp(node, ctx);
        case "llm": return runLlm(node, ctx);
        case "chat": return runChat(node, ctx);
        case "email": return runEmail(node, ctx);
        case "switch": return runSwitch(node, ctx);
        case "database": return runDatabase(node, ctx);
        case "transform": return runTransform(node, ctx);
        default: return runSimulated(node);
    }
}
