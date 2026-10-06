import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { evaluateCondition } from "../../lib/engine/condition";
import { resolveString, resolveDeep } from "../../lib/engine/template";
import { isPrivateAddress, safeFetch } from "../../lib/engine/safe-fetch";
import { runWorkflow } from "../../lib/engine/run";

const node = (id: string, type: string, label: string, config: any = {}) => ({ id, data: { label, type, config } });
const edge = (source: string, target: string, sourceHandle?: string) => ({ source, target, sourceHandle });

test("templates resolve paths and keep types", () => {
    const vars = { input: { amount: 700, user: { name: "Ada" } }, n1: { items: [{ id: 7 }] } };
    assert.equal(resolveString("{{input.amount}}", vars), 700);
    assert.equal(resolveString("Hi {{input.user.name}}!", vars), "Hi Ada!");
    assert.equal(resolveString("{{n1.items[0].id}}", vars), 7);
    assert.equal(resolveString("{{constructor}}", vars), undefined);
    assert.equal(resolveString("x{{__proto__.y}}", vars), "x");
    assert.deepEqual(resolveDeep({ a: "{{input.amount}}" }, vars), { a: 700 });
});

test("conditions", () => {
    const v = { input: { amount: 700, tag: "vip-gold", status: "open" } };
    assert.equal(evaluateCondition("{{input.amount}} > 500", v), true);
    assert.equal(evaluateCondition("{{input.amount}} < 500", v), false);
    assert.equal(evaluateCondition("{{input.status}} == open", v), true);
    assert.equal(evaluateCondition('{{input.status}} != "closed"', v), true);
    assert.equal(evaluateCondition("{{input.tag}} contains vip", v), true);
    assert.equal(evaluateCondition("{{input.missing}} > 1", v), false);
    assert.equal(evaluateCondition("{{input.amount}}", v), true);
});

test("private addresses are detected", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.0.1", "169.254.169.254", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1"]) assert.equal(isPrivateAddress(ip), true, ip);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isPrivateAddress(ip), false, ip);
});

test("safeFetch refuses local and private targets", async () => {
    const server = http.createServer((_, res) => res.end("secret")).listen(0);
    const port = (server.address() as any).port;
    try {
        await assert.rejects(safeFetch(`http://127.0.0.1:${port}/`), /not allowed|blocked|private/i);
        await assert.rejects(safeFetch(`http://localhost:${port}/`), /not allowed|blocked|private/i);
        await assert.rejects(safeFetch("http://169.254.169.254/latest/meta-data"), /not allowed|blocked|private/i);
        await assert.rejects(safeFetch("file:///etc/passwd"), /http/i);
    } finally {
        server.close();
    }
});

test("branching follows the Yes/No path and skips the other", async () => {
    const nodes = [
        node("t", "trigger", "Webhook", { sample: { amount: 900 } }),
        node("c", "logic", "If big", { condition: "{{input.amount}} > 500" }),
        node("yes", "action", "Notify", { provider: "slack" }),
        node("no", "action", "Log it", { provider: "sheets" }),
    ];
    const edges = [edge("t", "c"), edge("c", "yes", "true"), edge("c", "no", "false")];
    const r = await runWorkflow(nodes, edges);
    const by = Object.fromEntries(r.steps.map((s) => [s.nodeId, s]));
    assert.equal(r.status, "success");
    assert.equal(by.c.status, "success");
    assert.equal(by.yes.status, "simulated");
    assert.equal(by.no.status, "skipped");

    const r2 = await runWorkflow(nodes, edges, { input: { amount: 10 } });
    const by2 = Object.fromEntries(r2.steps.map((s) => [s.nodeId, s]));
    assert.equal(by2.yes.status, "skipped");
    assert.equal(by2.no.status, "simulated");
});

test("transform passes variables between nodes", async () => {
    const nodes = [
        node("t", "trigger", "Webhook", { sample: { name: "Ada" } }),
        node("m", "data", "Set fields", { provider: "json", mapping: { greeting: "Hello {{input.name}}", from: "{{t.name}}" } }),
    ];
    const r = await runWorkflow(nodes, [edge("t", "m")]);
    assert.deepEqual(r.steps[1].output, { greeting: "Hello Ada", from: "Ada" });
});

test("failure stops the run and skips what follows", async () => {
    const nodes = [
        node("t", "trigger", "Start"),
        node("h", "action", "Call API", { url: "http://127.0.0.1:1/" }),
        node("n", "action", "After", { provider: "sheets" }),
    ];
    const r = await runWorkflow(nodes, [edge("t", "h"), edge("h", "n")]);
    assert.equal(r.status, "failed");
    assert.equal(r.steps[1].status, "failed");
    assert.equal(r.steps[2].status, "skipped");
});

test("loops and missing triggers are reported", async () => {
    const loop = await runWorkflow([node("t", "trigger", "T"), node("a", "action", "A"), node("b", "action", "B")], [edge("t", "a"), edge("a", "b"), edge("b", "a")]);
    assert.equal(loop.status, "failed");
    assert.match(loop.error!, /loop/i);
    const none = await runWorkflow([node("a", "action", "A")], []);
    assert.match(none.error!, /trigger/i);
});

test("single node mode runs only that node", async () => {
    const r = await runWorkflow([node("t", "trigger", "T"), node("a", "action", "A", { provider: "sheets" })], [edge("t", "a")], { onlyNodeId: "a" });
    assert.equal(r.steps.length, 1);
    assert.equal(r.steps[0].status, "simulated");
});

test("disconnected nodes are skipped, not run", async () => {
    const r = await runWorkflow([node("t", "trigger", "T"), node("x", "action", "Orphan", { provider: "sheets" })], []);
    assert.equal(r.steps.find((s) => s.nodeId === "x")!.status, "skipped");
});
