import test from "node:test";
import assert from "node:assert/strict";
import { checkEnv, hasErrors } from "../../lib/env-check";

const GOOD = {
    DATABASE_URL: "postgresql://u:p@ep-x-pooler.us-west-2.aws.neon.tech/db?sslmode=require",
    BETTER_AUTH_SECRET: "Xk3v9Qm2LpR7sT1wZ8yB4nC6dF0gH5jKaMqVeUoIrYtXuOiPlNbWcEzDfAgSh",
    BETTER_AUTH_URL: "https://app.example.com",
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
    CREDENTIALS_KEY: Buffer.alloc(32, 7).toString("base64"),
    GROQ_API_KEY: "gsk_test",
    CRON_SECRET: "a".repeat(10) + "b".repeat(20),
    RESEND_API_KEY: "re_x",
    EMAIL_FROM: "DevFlow <noreply@example.com>",
    NEXT_PUBLIC_CONTACT_EMAIL: "privacy@example.com",
};
const find = (env: Record<string, string | undefined>, name: string, prod = true) => checkEnv(env, { production: prod }).filter((f) => f.name === name);
const levels = (env: Record<string, string | undefined>, prod = true) => checkEnv(env, { production: prod }).map((f) => f.level);

test("a complete production setup has no errors or warnings", () => {
    const f = checkEnv(GOOD, { production: true });
    assert.deepEqual(f.filter((x) => x.level !== "ok"), []);
});

test("missing essentials are errors", () => {
    for (const name of ["DATABASE_URL", "BETTER_AUTH_SECRET", "CREDENTIALS_KEY"]) {
        const env = { ...GOOD, [name]: undefined };
        assert.ok(find(env, name).some((f) => f.level === "error"), name);
        assert.equal(hasErrors(checkEnv(env, { production: true })), true);
    }
});

test("the public address is required in production but only a hint in development", () => {
    const env = { ...GOOD, BETTER_AUTH_URL: undefined, NEXT_PUBLIC_APP_URL: undefined };
    assert.ok(find(env, "BETTER_AUTH_URL", true).some((f) => f.level === "error"));
    assert.ok(find(env, "BETTER_AUTH_URL", false).every((f) => f.level !== "error"));
    assert.ok(find({ ...GOOD, BETTER_AUTH_URL: "http://app.example.com", NEXT_PUBLIC_APP_URL: "http://app.example.com" }, "BETTER_AUTH_URL").some((f) => f.level === "error")); // not https
    assert.ok(find({ ...GOOD, NEXT_PUBLIC_APP_URL: "https://other.example.com" }, "NEXT_PUBLIC_APP_URL").some((f) => f.level === "warn"));
});

test("secrets are judged by randomness, not by the words in them", () => {
    assert.ok(find({ ...GOOD, BETTER_AUTH_SECRET: "short" }, "BETTER_AUTH_SECRET").some((f) => f.level === "error"));
    assert.ok(find({ ...GOOD, BETTER_AUTH_SECRET: "a".repeat(40) }, "BETTER_AUTH_SECRET").some((f) => f.level === "error"));
    assert.ok(find({ ...GOOD, BETTER_AUTH_SECRET: "changeme-" + "padding-to-reach-length".repeat(2) }, "BETTER_AUTH_SECRET").some((f) => f.level === "error"));
    // a random value that happens to contain the word "secret" is fine
    assert.ok(find({ ...GOOD, BETTER_AUTH_SECRET: "q7Zs3ecretK9mWx2PvL8nRb5TyH1dFjGcAeUoIsXrNtVhQwYzMkBpDfS4" }, "BETTER_AUTH_SECRET").every((f) => f.level === "ok"));
    // in development a weak secret is a warning, not an error
    assert.ok(find({ ...GOOD, BETTER_AUTH_SECRET: "short" }, "BETTER_AUTH_SECRET", false).every((f) => f.level === "warn"));
});

test("the credentials key must be exactly 32 bytes", () => {
    assert.ok(find({ ...GOOD, CREDENTIALS_KEY: "not-a-key" }, "CREDENTIALS_KEY").some((f) => f.level === "error"));
    assert.ok(find({ ...GOOD, CREDENTIALS_KEY: Buffer.alloc(16).toString("base64") }, "CREDENTIALS_KEY").some((f) => f.level === "error"));
});

test("database advice: pooled connection and TLS", () => {
    assert.ok(find({ ...GOOD, DATABASE_URL: "postgresql://u:p@ep-x.us-west-2.aws.neon.tech/db?sslmode=require" }, "DATABASE_URL").some((f) => f.level === "warn" && /pooled/.test(f.message)));
    assert.ok(find({ ...GOOD, DATABASE_URL: "postgresql://u:p@ep-x-pooler.us-west-2.aws.neon.tech/db" }, "DATABASE_URL").some((f) => f.level === "warn" && /sslmode/.test(f.message)));
    assert.ok(find({ ...GOOD, DATABASE_URL: "mysql://nope" }, "DATABASE_URL").some((f) => f.level === "error"));
});

test("optional features warn instead of failing the deploy", () => {
    const env = { ...GOOD, GROQ_API_KEY: undefined, CRON_SECRET: undefined, RESEND_API_KEY: undefined, EMAIL_FROM: undefined };
    assert.equal(hasErrors(checkEnv(env, { production: true })), false);
    assert.ok(levels(env).filter((l) => l === "warn").length >= 3);
    // email needs both halves
    assert.ok(find({ ...GOOD, EMAIL_FROM: undefined }, "EMAIL_FROM").some((f) => f.level === "warn"));
});

test("console mail mode must never reach production", () => {
    assert.ok(find({ ...GOOD, AUTH_EMAIL_MODE: "console" }, "AUTH_EMAIL_MODE", true).some((f) => f.level === "error"));
    assert.equal(find({ ...GOOD, AUTH_EMAIL_MODE: "console" }, "AUTH_EMAIL_MODE", false).length, 0);
});

test("findings never contain secret values", () => {
    const text = JSON.stringify(checkEnv(GOOD, { production: true }));
    for (const v of [GOOD.BETTER_AUTH_SECRET, GOOD.CREDENTIALS_KEY, GOOD.CRON_SECRET, GOOD.GROQ_API_KEY, GOOD.RESEND_API_KEY, "u:p@"]) assert.ok(!text.includes(v), "leaked a value");
});
