import test from "node:test";
import assert from "node:assert/strict";
import { httpClient } from "../../lib/engine/executors";
import { runWorkflow } from "../../lib/engine/run";

const node = (id: string, type: string, label: string, config: any = {}) => ({ id, data: { label, type, config } });
const flow = (config: any, extra: any[] = []) => [node("t", "trigger", "Start", { sample: { email: "ada@example.com", name: "Ada" } }), node("e", "action", "Send Email", { provider: "Resend", ...config }), ...extra];
const edges = [{ source: "t", target: "e" }];

function mockResend(reply: { status: number; body: unknown }) {
    const calls: any[] = [];
    const original = httpClient.fetch;
    httpClient.fetch = (async (url: string, opts: any) => {
        calls.push({ url, ...opts });
        return { status: reply.status, statusText: "", headers: {}, body: JSON.stringify(reply.body), truncated: false, url };
    }) as any;
    return { calls, restore: () => { httpClient.fetch = original; } };
}

const SECRETS = { RESEND_API_KEY: "re_test_abcdef123456" };
const good = { apiKey: "{{secrets.RESEND_API_KEY}}", to: "{{input.email}}", subject: "Hi {{input.name}}", text: "Welcome, {{input.name}}!" };

test("sends through Resend with the saved key, and hides the key", async () => {
    const m = mockResend({ status: 200, body: { id: "em_1" } });
    try {
        const r = await runWorkflow(flow(good), edges, { secrets: SECRETS });
        assert.equal(r.status, "success");
        assert.equal(r.steps[1].status, "success");
        const call = m.calls[0];
        assert.equal(call.url, "https://api.resend.com/emails");
        assert.equal(call.headers.authorization, "Bearer re_test_abcdef123456");
        const sent = JSON.parse(call.body);
        assert.deepEqual(sent.to, ["ada@example.com"]);
        assert.equal(sent.subject, "Hi Ada");
        assert.equal(sent.text, "Welcome, Ada!");
        assert.ok(!JSON.stringify(r).includes("re_test_abcdef123456"));
    } finally { m.restore(); }
});

test("without a key it is simulated and sends nothing", async () => {
    const m = mockResend({ status: 200, body: {} });
    try {
        const r = await runWorkflow(flow({ ...good, apiKey: "" }), edges, { secrets: {} });
        assert.equal(r.steps[1].status, "simulated");
        assert.equal(m.calls.length, 0);
    } finally { m.restore(); }
});

test("a referenced but unsaved API key is simulated, not failed", async () => {
    const m = mockResend({ status: 200, body: {} });
    try {
        const r = await runWorkflow(flow(good), edges, { secrets: {} });
        assert.equal(r.status, "success");
        assert.equal(r.steps[1].status, "simulated");
        assert.match(r.steps[1].note!, /Resend API key/);
        assert.equal(m.calls.length, 0);
    } finally { m.restore(); }
});

test("bad configuration fails with a clear message", async () => {
    const m = mockResend({ status: 200, body: {} });
    try {
        const run = async (cfg: any) => (await runWorkflow(flow({ ...good, ...cfg }), edges, { secrets: SECRETS })).steps[1].error;
        assert.match((await run({ to: "" }))!, /recipient/);
        assert.match((await run({ to: "not-an-email" }))!, /valid email/);
        assert.match((await run({ to: "a@x.co,b@x.co,c@x.co,d@x.co,e@x.co,f@x.co" }))!, /At most 5/);
        assert.match((await run({ subject: "" }))!, /subject/);
        assert.match((await run({ text: "" }))!, /message/);
        assert.match((await run({ apiKey: "re_pasted_raw_key_123" }))!, /Credentials/);
        assert.equal(m.calls.length, 0);
    } finally { m.restore(); }
});

test("Resend errors are surfaced", async () => {
    const m = mockResend({ status: 403, body: { message: "You can only send testing emails to your own address" } });
    try {
        const r = await runWorkflow(flow(good), edges, { secrets: SECRETS });
        assert.equal(r.status, "failed");
        assert.match(r.steps[1].error!, /only send testing emails/);
    } finally { m.restore(); }
});

test("per-run cap and account gate stop sending", async () => {
    const m = mockResend({ status: 200, body: { id: "x" } });
    try {
        const many = [1, 2, 3, 4].map((i) => node(`e${i}`, "action", `Send Email ${i}`, { provider: "Resend", ...good }));
        const chain = [node("t", "trigger", "Start", { sample: { email: "a@b.co", name: "A" } }), ...many];
        const chainEdges = [{ source: "t", target: "e1" }, { source: "e1", target: "e2" }, { source: "e2", target: "e3" }, { source: "e3", target: "e4" }];
        const r = await runWorkflow(chain, chainEdges, { secrets: SECRETS });
        assert.equal(m.calls.length, 3);
        assert.match(r.steps[4].error!, /at most 3 emails/);

        const before = m.calls.length;
        const g = await runWorkflow(flow(good), edges, { secrets: SECRETS, emailGate: () => "Email limit reached" });
        assert.equal(g.steps[1].error, "Email limit reached");
        assert.equal(m.calls.length, before);
    } finally { m.restore(); }
});
