// Password rules shared by the sign-up form, Settings and the server. Pure, so all three always agree.
// Follows current NIST guidance: favour length and block known-bad choices over forced symbol rules.

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;

export type PasswordProblem = "short" | "long" | "common" | "repetitive" | "sequence" | "personal";

export interface PasswordCheck {
    ok: boolean;
    problems: PasswordProblem[];
    /** Plain-language reasons, ready to show. */
    messages: string[];
    /** 0 (unusable) to 4 (strong): drives the strength meter. */
    score: 0 | 1 | 2 | 3 | 4;
    label: "Too weak" | "Weak" | "Okay" | "Good" | "Strong";
}

// The passwords attackers try first (this list plus the letters-only base check below).
const COMMON = new Set([
    "password", "passw0rd", "p@ssword", "p@ssw0rd", "123456", "12345678", "123456789", "1234567890", "0987654321", "qwerty", "qwertyuiop", "qwerty123",
    "asdfghjkl", "asdfgh", "zxcvbnm", "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "qazwsx", "abc123", "abcd1234", "abcdefgh", "abcdefghij", "iloveyou", "iloveyou1",
    "admin", "admin123", "administrator", "welcome", "welcome1", "welcome123", "letmein", "letmein123", "monkey", "dragon", "master", "sunshine", "princess",
    "football", "baseball", "superman", "batman", "trustno1", "shadow", "michael", "jennifer", "hunter", "ranger", "buster", "soccer", "hockey", "killer", "george",
    "charlie", "andrew", "michelle", "jessica", "pepper", "daniel", "access", "joshua", "maggie", "starwars", "whatever", "freedom", "secret", "changeme", "default",
    "login", "passwd", "test", "test123", "testtest", "guest", "root", "toor", "pass", "pass123", "mypassword", "myspace", "internet", "computer", "summer", "winter",
    "spring", "autumn", "november", "october", "september", "mustang", "harley", "ginger", "yankees", "cowboys", "liverpool", "arsenal", "chelsea", "ferrari",
    "devflow", "workflow", "automation", "qwertyui", "qweasdzxc", "asdasdasd", "password1", "password12", "password123", "password1234", "letmein1", "iloveu",
]);

const lettersOnly = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function isSequence(s: string): boolean {
    if (s.length < 6) return false;
    const lower = s.toLowerCase();
    let up = true, down = true;
    for (let i = 1; i < lower.length; i++) {
        const d = lower.charCodeAt(i) - lower.charCodeAt(i - 1);
        if (d !== 1) up = false;
        if (d !== -1) down = false;
    }
    return up || down; // 1234567890-style runs, abcdefghij, 987654321
}

function isCommon(pw: string): boolean {
    const lower = pw.toLowerCase();
    if (COMMON.has(lower)) return true;
    // "Password2024!", "Qwerty123", "iloveyou99": the same few words with decoration
    const base = lettersOnly(lower);
    return base.length >= 4 && pw.length < 16 && COMMON.has(base);
}

function mentionsPerson(pw: string, who: { email?: string; name?: string }): boolean {
    const lower = pw.toLowerCase();
    const parts = new Set<string>();
    const local = who.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    if (local.length >= 4) parts.add(local);
    for (const t of (who.name ?? "").toLowerCase().split(/[^a-z0-9]+/)) if (t.length >= 4) parts.add(t);
    return [...parts].some((p) => lower.includes(p));
}

export function checkPassword(password: string, who: { email?: string; name?: string } = {}): PasswordCheck {
    const pw = String(password ?? "");
    const problems: PasswordProblem[] = [];
    const messages: string[] = [];

    if (pw.length < MIN_PASSWORD) { problems.push("short"); messages.push(`Use at least ${MIN_PASSWORD} characters.`); }
    if (pw.length > MAX_PASSWORD) { problems.push("long"); messages.push(`Keep it under ${MAX_PASSWORD} characters.`); }
    if (pw.length >= 1 && new Set(pw).size <= 3 && pw.length >= 4) { problems.push("repetitive"); messages.push("Avoid repeating the same few characters."); }
    if (isSequence(pw)) { problems.push("sequence"); messages.push("Avoid simple runs like 1234567890 or abcdefghij."); }
    if (pw.length >= 4 && isCommon(pw)) { problems.push("common"); messages.push("That password is too common. Try a few unrelated words."); }
    if (pw.length >= 4 && mentionsPerson(pw, who)) { problems.push("personal"); messages.push("Don't include your name or email in your password."); }

    // Strength: mostly length, with a nudge for variety
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
    let score = 0;
    if (!problems.length) {
        score = pw.length >= 20 ? 4 : pw.length >= 15 ? 3 : pw.length >= 12 ? 2 : 1;
        if (classes >= 3 && score < 4) score += 1;
        if (classes === 1 && pw.length < 14 && score > 1) score -= 1;
    } else if (problems.length === 1 && problems[0] === "short" && pw.length >= 6) {
        score = 0;
    }
    const label = (["Too weak", "Weak", "Okay", "Good", "Strong"] as const)[problems.length ? 0 : Math.max(1, score)];
    return { ok: problems.length === 0, problems, messages, score: (problems.length ? 0 : Math.max(1, Math.min(4, score))) as PasswordCheck["score"], label };
}
