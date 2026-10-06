import test from "node:test";
import assert from "node:assert/strict";
import { dbClient } from "../../lib/engine/executors";
import { parseCases } from "../../lib/engine/switch";
import { runWorkflow } from "../../lib/engine/run";

const node = (id: string, type: string, label: string, config: any = {}) => ({ id, data: { label, type, config } });
const status = (r: any, id: string) => r.steps.find((s: any) => s.nodeId === id).status;

test("parseCases trims, de-duplicates and reserves 'default'", () => {
    assert.deepEqual(parseCases(" urgent, Normal ;low, urgent,,default"), ["urgent", "Normal", "low"]);
});

test("switch routes to the matching case, else default", async () => {
    const nodes = (value: string) => [
        node("t", "trigger", "Start", { sample: { status: value } }),
        node("s", "logic", "Switch", { value: "{{input.status}}", cases: "urgent, normal, low" }),
        node("u", "action", "Urgent path", { provider: "sheets" }),
        node("n", "action", "Normal path", { provider: "sheets" }),
        node("l", "action", "Low path", { provider: "sheets" }),
        node("d", "action", "Default path", { provider: "sheets" }),
    ];
    const edges = [
        { source: "t", target: "s" },
        { source: "s", target: "u", sourceHandle: "urgent" },
        { source: "s", target: "n", sourceHandle: "normal" },
        { source: "s", target: "l", sourceHandle: "low" },
        { source: "s", target: "d", sourceHandle: "default" },
    ];
    const hit = async (value: string) => {
        const r = await runWorkflow(nodes(value), edges);
        assert.equal(r.status, "success");
        return ["u", "n", "l", "d"].filter((id) => status(r, id) === "simulated");
    };
    assert.deepEqual(await hit("urgent"), ["u"]);
    assert.deepEqual(await hit("  NORMAL "), ["n"]);
    assert.deepEqual(await hit("low"), ["l"]);
    assert.deepEqual(await hit("something-else"), ["d"]);
});

test("switch with a bare field name and an unset value", async () => {
    const mk = (config: any) => [node("t", "trigger", "Start", { sample: { tier: "gold" } }), node("s", "logic", "Switch", config)];
    const ok = await runWorkflow(mk({ key: "tier", cases: "gold, silver" }), [{ source: "t", target: "s" }]);
    assert.equal((ok.steps[1].output as any).matched, "gold");
    const bad = await runWorkflow(mk({ cases: "gold" }), [{ source: "t", target: "s" }]);
    assert.match(bad.steps[1].error!, /switch on/);
    const none = await runWorkflow(mk({ value: "{{input.tier}}" }), [{ source: "t", target: "s" }]);
    assert.match(none.steps[1].error!, /no cases/);
});

// ── database ────────────────────────────────────────────────────────────

const CONN = "postgresql://user:pw_secret_123@ep-cool-123.us-west-2.aws.neon.tech/db?sslmode=require";
const dbFlow = (config: any) => [node("t", "trigger", "Start", { sample: { email: "ada@example.com", id: 7 } }), node("q", "data", "Database Query", { provider: "Postgres", connection: "{{secrets.POSTGRES_URL}}", ...config })];
const link = [{ source: "t", target: "q" }];

function mockDb(rows: unknown[] = [{ id: 1 }]) {
    const calls: { conn: string; sql: string; params: unknown[] }[] = [];
    const original = dbClient.query;
    dbClient.query = async (conn, sql, params) => { calls.push({ conn, sql, params }); return rows; };
    return { calls, restore: () => { dbClient.query = original; } };
}
const run = (config: any, secrets: Record<string, string> = { POSTGRES_URL: CONN }) => runWorkflow(dbFlow(config), link, { secrets });

test("queries run with data as parameters, never pasted into SQL", async () => {
    const m = mockDb([{ id: 7, email: "ada@example.com" }]);
    try {
        const r = await run({ query: "SELECT * FROM users WHERE email = {{input.email}} AND id = {{input.id}}" });
        assert.equal(r.status, "success");
        assert.equal(m.calls[0].sql, "SELECT * FROM users WHERE email = $1 AND id = $2");
        assert.deepEqual(m.calls[0].params, ["ada@example.com", 7]);
        assert.equal((r.steps[1].output as any).rowCount, 1);
        assert.ok(!JSON.stringify(r).includes("pw_secret_123"));
    } finally { m.restore(); }
});

test("quoted tokens are still parameters", async () => {
    const m = mockDb();
    try {
        await run({ query: "SELECT * FROM users WHERE email = '{{input.email}}' AND id = {{input.id}}" });
        assert.equal(m.calls[0].sql, "SELECT * FROM users WHERE email = $1 AND id = $2");
        assert.deepEqual(m.calls[0].params, ["ada@example.com", 7]);
    } finally { m.restore(); }
});

test("hostile input stays a parameter", async () => {
    const m = mockDb();
    try {
        const nodes = dbFlow({ query: "SELECT * FROM users WHERE name = {{input.name}}" });
        nodes[0] = node("t", "trigger", "Start", { sample: { name: "x'; DROP TABLE users; --" } });
        const r = await runWorkflow(nodes, link, { secrets: { POSTGRES_URL: CONN } });
        assert.equal(r.status, "success");
        assert.ok(!m.calls[0].sql.includes("DROP"));
        assert.deepEqual(m.calls[0].params, ["x'; DROP TABLE users; --"]);
    } finally { m.restore(); }
});

test("without a connection it is simulated", async () => {
    const m = mockDb();
    try {
        const r = await run({ query: "SELECT 1" }, {});
        assert.equal(r.steps[1].status, "simulated");
        assert.equal(m.calls.length, 0);
    } finally { m.restore(); }
});

test("writes are off by default and limited to insert/update/delete", async () => {
    const m = mockDb();
    try {
        const errOf = async (cfg: any) => (await run(cfg)).steps[1].error;
        assert.match((await errOf({ query: "DELETE FROM users WHERE id = {{input.id}}" }))!, /allowWrites/);
        assert.match((await errOf({ query: "WITH d AS (DELETE FROM users RETURNING *) SELECT * FROM d" }))!, /allowWrites/);
        assert.match((await errOf({ query: "DROP TABLE users", allowWrites: "true" }))!, /Only INSERT, UPDATE and DELETE/);
        assert.match((await errOf({ query: "SELECT 1; SELECT 2" }))!, /one statement/);
        assert.equal(m.calls.length, 0);
        const ok = await run({ query: "UPDATE users SET seen = true WHERE id = {{input.id}}", allowWrites: "true" });
        assert.equal(ok.status, "success");
        assert.equal(m.calls.length, 1);
    } finally { m.restore(); }
});

test("connection rules: credentials only, Neon only, never our own database", async () => {
    const m = mockDb();
    try {
        assert.match((await run({ query: "SELECT 1", connection: CONN })).steps[1].error!, /Credentials/);
        assert.match((await run({ query: "SELECT 1" }, { POSTGRES_URL: "postgresql://u:p@db.internal.example.com/x" })).steps[1].error!, /Neon/);
        assert.match((await run({ query: "SELECT 1" }, { POSTGRES_URL: "mysql://u:p@x.neon.tech/x" })).steps[1].error!, /Postgres connection/);
        assert.match((await run({ query: "SELECT {{secrets.POSTGRES_URL}}" })).steps[1].error!, /can't be used inside a SQL/);
        process.env.DATABASE_URL = CONN;
        assert.match((await run({ query: "SELECT 1" })).steps[1].error!, /own database/);
        assert.equal(m.calls.length, 0);
    } finally { m.restore(); delete process.env.DATABASE_URL; }
});

test("large results are capped and driver errors are reported", async () => {
    const big = mockDb(Array.from({ length: 250 }, (_, i) => ({ i })));
    try {
        const r = await run({ query: "SELECT i FROM t" });
        const out = r.steps[1].output as any;
        assert.equal(out.rowCount, 250);
        assert.equal(out.rows.length, 100);
        assert.equal(out.truncated, true);
    } finally { big.restore(); }
    const original = dbClient.query;
    dbClient.query = async () => { throw new Error('relation "nope" does not exist'); };
    try {
        const r = await run({ query: "SELECT * FROM nope" });
        assert.equal(r.status, "failed");
        assert.match(r.steps[1].error!, /does not exist/);
    } finally { dbClient.query = original; }
});
