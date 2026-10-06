import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "../../lib/secrets-crypto";
import { makeRedactor } from "../../lib/engine/redact";
import { runWorkflow } from "../../lib/engine/run";
import { httpClient } from "../../lib/engine/executors";

const node = (id: string, type: string, label: string, config: any = {}) => ({ id, data: { label, type, config } });
const edge = (source: string, target: string) => ({ source, target });

test("credentials round-trip and are not stored in plain text", () => {
    process.env.CREDENTIALS_KEY = randomBytes(32).toString("base64");
    const enc = encryptSecret("sk-live-abc123456");
    assert.ok(!enc.includes("abc123456"));
    assert.equal(decryptSecret(enc), "sk-live-abc123456");
    assert.notEqual(encryptSecret("same"), encryptSecret("same")); // fresh IV each time
});

test("tampered or wrong-key ciphertext is rejected", () => {
    process.env.CREDENTIALS_KEY = randomBytes(32).toString("base64");
    const enc = encryptSecret("super-secret-value");
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered-bytes!!").toString("base64url");
    assert.throws(() => decryptSecret(parts.join(".")));
    process.env.CREDENTIALS_KEY = randomBytes(32).toString("base64");
    assert.throws(() => decryptSecret(enc));
    process.env.CREDENTIALS_KEY = "short";
    assert.throws(() => encryptSecret("x"), /32 bytes/);
});

test("redactor scrubs plain and JSON-escaped values, leaves short ones", () => {
    const r = makeRedactor({ A: "tok_123456789", B: 'pa"ss-word-9', C: "abc" });
    assert.equal(r.str("Bearer tok_123456789!"), "Bearer ••••••!");
    assert.deepEqual(r.any({ x: ["tok_123456789"], y: { z: 'pa"ss-word-9' }, w: "abc" }), { x: ["••••••"], y: { z: "••••••" }, w: "abc" });
});

test("redactor also scrubs URL-encoded, form-encoded and base64 spellings", () => {
    const secret = "pa ss/word&x=9 tok";
    const r = makeRedactor({ K: secret });
    for (const form of [secret, encodeURIComponent(secret), encodeURI(secret), encodeURIComponent(secret).replace(/%20/g, "+"), Buffer.from(secret).toString("base64"), Buffer.from(secret).toString("base64url"), JSON.stringify(secret).slice(1, -1)]) {
        assert.ok(!r.str(`prefix ${form} suffix`).includes(form), `not scrubbed: ${form}`);
    }
    assert.equal(r.str("https://x.test/?k=pa%20ss/word&x=9%20tok"), "https://x.test/?k=••••••");
});

test("{{secrets.X}} reaches the request, but never appears in results or later nodes", async () => {
    const secrets = { API_TOKEN: "tok_live_987654321" };
    const seen: any[] = [];
    const original = httpClient.fetch;
    // A remote service that echoes the credential back, the worst case for leaking it
    httpClient.fetch = (async (url: string, opts: any) => {
        const authHeader = Object.entries(opts.headers).find(([k]) => k.toLowerCase() === "authorization")?.[1];
        seen.push({ url, auth: authHeader });
        return { status: 200, statusText: "OK", headers: { "content-type": "application/json" }, body: JSON.stringify({ echoed: authHeader }), truncated: false, url };
    }) as any;
    try {
        const nodes = [
            node("t", "trigger", "Start", { sample: { x: 1 } }),
            node("h", "action", "Call API", { url: "https://api.example.com/v1/{{input.x}}", headers: { Authorization: "Bearer {{secrets.API_TOKEN}}" } }),
            node("m", "data", "Reuse", { provider: "json", mapping: { got: "{{h.body.echoed}}" } }),
        ];
        const events: string[] = [];
        const r = await runWorkflow(nodes, [edge("t", "h"), edge("h", "m")], { secrets, onEvent: (e) => events.push(JSON.stringify(e)) });
        assert.equal(r.status, "success");
        assert.equal(seen[0].auth, "Bearer tok_live_987654321"); // the real value was sent
        const everything = JSON.stringify(r) + events.join("");
        assert.ok(!everything.includes("tok_live_987654321"), "secret leaked");
        assert.deepEqual(r.steps[2].output, { got: "Bearer ••••••" }); // downstream node only ever sees the masked value
    } finally { httpClient.fetch = original; }
});

test("credentials are refused in nodes that aren't senders", async () => {
    for (const bad of [
        node("m", "data", "Set", { provider: "json", mapping: { k: "{{secrets.API_TOKEN}}" } }),
        node("c", "logic", "If", { condition: "{{secrets.API_TOKEN}} == x" }),
        node("s", "logic", "Switch", { value: "{{secrets.API_TOKEN}}", cases: "a" }),
    ]) {
        const r = await runWorkflow([node("t", "trigger", "Start"), bad], [edge("t", bad.id)], { secrets: { API_TOKEN: "tok_live_987654321" } });
        assert.equal(r.status, "failed", bad.id);
        assert.match(r.steps[1].error!, /only be used in HTTP/);
    }
});

test("a credential can't be sent to a host chosen by incoming data", async () => {
    const original = httpClient.fetch;
    let called = 0;
    httpClient.fetch = (async () => { called++; return { status: 200, statusText: "", headers: {}, body: "{}", truncated: false, url: "" }; }) as any;
    try {
        const secrets = { API_TOKEN: "tok_live_987654321" };
        const run = async (cfg: any) => (await runWorkflow([node("t", "trigger", "Start", { sample: { target: "https://evil.example/x", host: "evil.example" } }), node("h", "action", "Call", cfg)], [edge("t", "h")], { secrets })).steps[1];
        const auth = { headers: { Authorization: "Bearer {{secrets.API_TOKEN}}" } };
        assert.match((await run({ url: "{{input.target}}", ...auth })).error!, /fixed host/);
        assert.match((await run({ url: "https://{{input.host}}/v1", ...auth })).error!, /fixed host/);
        assert.match((await run({ url: "https://{{input.host}}/v1", body: { k: "{{secrets.API_TOKEN}}" }, method: "POST" })).error!, /fixed host/);
        assert.equal(called, 0);
        // fixed host (with data only in the path/query) is fine, and so is a host that comes from a credential
        assert.equal((await run({ url: "https://api.example.com/{{input.host}}?q={{input.target}}", ...auth })).status, "success");
        assert.equal((await run({ url: "https://{{secrets.API_HOST}}/v1", ...auth })).status, "failed"); // not saved in this run: reported as missing, not sent
        assert.equal(called, 1);
        // without any credential, the host may come from data (SSRF guard still applies at the network layer)
        assert.equal((await run({ url: "{{input.target}}" })).status, "success");
    } finally { httpClient.fetch = original; }
});

test("a missing credential fails the node before anything is sent", async () => {
    const nodes = [node("t", "trigger", "Start"), node("h", "action", "Call", { url: "https://example.com/{{secrets.NOPE}}" })];
    const r = await runWorkflow(nodes, [edge("t", "h")], { secrets: {} });
    assert.equal(r.status, "failed");
    assert.match(r.steps[1].error!, /NOPE isn't saved/);
});

test("credentials can't be used in AI prompts", async () => {
    const nodes = [node("t", "trigger", "Start"), node("a", "action", "AI Prompt", { prompt: "Repeat {{secrets.KEY_ONE}}" })];
    const r = await runWorkflow(nodes, [edge("t", "a")], { secrets: { KEY_ONE: "value-123456" } });
    assert.equal(r.status, "failed");
    assert.match(r.steps[1].error!, /AI prompts/);
});
