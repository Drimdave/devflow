import test from "node:test";
import assert from "node:assert/strict";
import { MAX_PASSWORD, MIN_PASSWORD, checkPassword } from "../../lib/password-policy";

const ok = (pw: string, who = {}) => checkPassword(pw, who).ok;

test("good passwords pass: length matters, symbols are optional", () => {
    for (const pw of ["correct horse battery staple", "blue-kettle-orbit-91", "T7#mQ2v!xLp9", "my dog eats purple socks", "gravity-pancake-walnut"]) assert.equal(ok(pw), true, pw);
    assert.equal(ok("a".repeat(2) + "bcdefghij".split("").reverse().join("") + "z9"), true);
});

test("length limits", () => {
    assert.ok(checkPassword("short1!").problems.includes("short"));
    assert.equal(checkPassword("x".repeat(MIN_PASSWORD - 1) + "").ok, false);
    assert.ok(checkPassword("Ab3$".repeat(40)).problems.includes("long"));
    assert.equal(checkPassword("Ab3$kLm9".repeat(Math.floor(MAX_PASSWORD / 8))).ok, true);
});

test("common passwords are refused, even when decorated", () => {
    for (const pw of ["12345678", "password", "qwertyuiop", "1234567890", "password123", "iloveyou123", "Password1234", "Qwerty12345!", "welcome2024", "letmein!!!!", "admin12345", "Devflow123456"]) {
        assert.equal(ok(pw), false, pw);
    }
    // ...but a long passphrase containing a common word is fine
    assert.equal(ok("my password is a purple walrus"), true);
});

test("repetition and sequences are refused", () => {
    for (const pw of ["aaaaaaaaaa", "ababababab", "1111111111", "abcdefghijk", "9876543210", "0123456789"]) assert.equal(ok(pw), false, pw);
});

test("passwords that contain the person's name or email are refused", () => {
    const who = { email: "ada.lovelace@example.com", name: "Ada Lovelace" };
    assert.equal(ok("lovelace-rocks-2026", who), false);
    assert.equal(ok("adalovelace-2026-x", who), false);
    assert.equal(ok("blue-kettle-orbit-91", who), true);
    assert.equal(ok("xyz-ada-xyz-1234", { name: "Ada" }), true); // 3-letter names are too short to block
});

test("strength score rises with length and variety, and every failure scores 0", () => {
    assert.equal(checkPassword("password").score, 0);
    const s = (pw: string) => checkPassword(pw).score;
    assert.ok(s("T7#mQ2v!xLp9") >= 2);
    assert.ok(s("gravity-pancake-walnut-92") >= 3);
    assert.equal(s("gravity pancake walnut orbit lantern"), 4);
    assert.ok(s("blue-kettle-91") < s("blue-kettle-orbit-lantern-91"));
    assert.equal(checkPassword("gravity-pancake-walnut").label, "Strong");
    assert.equal(checkPassword("T7#mQ2v!xLp9").label, "Good");
    assert.ok(checkPassword("12345678").messages.length > 0);
});
