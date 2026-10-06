import test from "node:test";
import assert from "node:assert/strict";
import { ConditionError, evaluateCondition as ev } from "../../lib/engine/condition";
import { runWorkflow } from "../../lib/engine/run";

const v = { input: { name: "Ada Lovelace", n: 10, s: "10", z: 0, f: false, e: "", nul: null, tags: ["bug", "ui"], nested: { a: { b: 5 } }, status: "open", amount: 700, plan: "pro" } };

test("combining conditions with && || ! and parentheses", () => {
    assert.equal(ev("{{input.n}} > 5 && {{input.z}} == 0", v), true);
    assert.equal(ev("{{input.n}} > 50 && {{input.z}} == 0", v), false);
    assert.equal(ev("{{input.n}} > 50 || {{input.z}} == 0", v), true);
    assert.equal(ev("{{input.n}} > 50 || {{input.z}} == 1", v), false);
    assert.equal(ev("!{{input.f}}", v), true);
    assert.equal(ev("!{{input.n}}", v), false);
    assert.equal(ev("! {{input.n}} > 50", v), true);
    assert.equal(ev("status == open && amount > 500", v), true);
    assert.equal(ev("(amount > 5000 || status == open) && plan == pro", v), true);
    assert.equal(ev("(amount > 5000 || status == closed) && plan == pro", v), false);
    assert.equal(ev("amount > 5000 || plan == free || status == open", v), true);
    assert.equal(ev("((amount > 500))", v), true);
    // && binds tighter than ||
    assert.equal(ev("status == closed && amount > 5000 || plan == pro", v), true);
    assert.equal(ev("status == closed && (amount > 5000 || plan == pro)", v), false);
});

test("separators inside quotes and templates are not operators", () => {
    const w = { input: { q: "a && b", r: "x || y" } };
    assert.equal(ev(`{{input.q}} == "a && b"`, w), true);
    assert.equal(ev(`{{input.r}} contains "||"`, w), true);
    assert.equal(ev(`{{input.q}} == 'a && b' && {{input.r}} == "x || y"`, w), true);
});

test("single values: truthiness rules", () => {
    assert.equal(ev("{{input.f}}", v), false);
    assert.equal(ev("{{input.z}}", v), false);
    assert.equal(ev("{{input.e}}", v), false);
    assert.equal(ev("{{input.nul}}", v), false);
    assert.equal(ev("{{input.name}}", v), true);
    assert.equal(ev("n", v), true);
    assert.equal(ev("nope", v), false); // a field that isn't there is "no", not a literal word
    assert.equal(ev("true", v), true);
    assert.equal(ev("false", v), false);
});

test("missing and null are the same to a person", () => {
    assert.equal(ev("{{input.nope}} == null", v), true);
    assert.equal(ev("{{input.nul}} == null", v), true);
    assert.equal(ev("{{input.nope}} != null", v), false);
    assert.equal(ev("{{input.name}} != null", v), true);
    assert.equal(ev("{{input.nope}} != 5", v), true);
    assert.equal(ev("{{input.nope}} > 1", v), false);
});

test("anything it can't understand is an error, never a silent Yes", () => {
    for (const bad of ["(((((((", "Score is above 70", "amount above 500", "hello world", "{{input.n}} >", "> 5", `"unclosed`, "{{input.n", "a == (b", "&& amount > 1", "amount > 1 &&"]) {
        assert.throws(() => ev(bad, v), (e: unknown) => e instanceof ConditionError, bad);
    }
});

test("a broken condition fails the node with a readable message", async () => {
    const nodes = [
        { id: "t", data: { label: "T", type: "trigger", config: { sample: { a: 1 } } } },
        { id: "c", data: { label: "Check", type: "logic", config: { condition: "Score is above 70" } } },
        { id: "y", data: { label: "Yes path", type: "action", config: { provider: "sheets" } } },
    ];
    const r = await runWorkflow(nodes, [{ source: "t", target: "c" }, { source: "c", target: "y", sourceHandle: "true" }]);
    assert.equal(r.status, "failed");
    assert.match(r.steps[1].error!, /Couldn't understand "Score is above 70"/);
    assert.equal(r.steps[2].status, "skipped");
});
