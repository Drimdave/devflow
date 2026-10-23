import test from "node:test";
import assert from "node:assert/strict";
import { secretRefs, missingCredentials, credentialHint, missingCredentialFromError, safeCredentialName, cleanAssistantMessage } from "../../lib/credential-hints";

const wf = (config: Record<string, unknown>) => ({ nodes: [{ id: "a", data: { config } }, { id: "b", data: { config: { x: "{{secrets.OTHER_KEY}}" } } }] });

test("finds every secret a workflow references, once each, in order", () => {
    const refs = secretRefs(wf({ url: "https://x.test/{{secrets.GMAIL_TOKEN}}", auth: "Bearer {{ secrets.GMAIL_TOKEN }}" }));
    assert.deepEqual(refs, ["GMAIL_TOKEN", "OTHER_KEY"]);
});

test("a workflow with no secrets, or no nodes, needs nothing", () => {
    assert.deepEqual(secretRefs({ nodes: [{ data: { config: { url: "https://x.test" } } }] }), []);
    assert.deepEqual(secretRefs({}), []);
    assert.deepEqual(secretRefs(null), []);
});

test("only credentials the account has not saved are reported missing", () => {
    assert.deepEqual(missingCredentials(wf({ u: "{{secrets.A}}" }), ["A", "OTHER_KEY"]), []);
    assert.deepEqual(missingCredentials(wf({ u: "{{secrets.A}}" }), ["OTHER_KEY"]), ["A"]);
});

test("input.* and node references are not mistaken for secrets", () => {
    assert.deepEqual(secretRefs({ nodes: [{ data: { config: { t: "{{input.secrets}} {{http_1.secrets.x}} {{secretsfoo.bar}}" } } }] }), []);
});

test("hints say plainly when Gmail cannot be connected", () => {
    assert.match(credentialHint("GMAIL_TOKEN"), /cannot connect to Gmail/i);
    assert.match(credentialHint("slack_webhook"), /Incoming Webhook/);
    assert.match(credentialHint("RESEND_API_KEY"), /resend\.com/);
    assert.match(credentialHint("SOMETHING_ELSE"), /API key or URL/);
});

test("pulls the credential name out of the engine error, and nothing else", () => {
    assert.equal(missingCredentialFromError("Get Gmail messages: Credential GMAIL_TOKEN isn't saved. Add it in Settings → Credentials."), "GMAIL_TOKEN");
    assert.equal(missingCredentialFromError("Request failed with status 500"), null);
});

test("a ?add= value is reduced to a safe credential name", () => {
    assert.equal(safeCredentialName("gmail_token"), "GMAIL_TOKEN");
    assert.equal(safeCredentialName("<script>alert(1)</script>"), "SCRIPTALERT1SCRIPT");
    assert.equal(safeCredentialName(null), "");
    assert.equal(safeCredentialName("A".repeat(200)).length, 60);
});

test("the model's note to the user is trimmed, bounded and dropped when empty", () => {
    assert.equal(cleanAssistantMessage("  Built it.\n\nSave   a key.  "), "Built it. Save a key.");
    assert.equal(cleanAssistantMessage("   \n "), undefined);
    assert.equal(cleanAssistantMessage("x".repeat(5000))!.length, 600);
});
