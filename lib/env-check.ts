// Checks the environment variables DevFlow needs and says what's wrong in plain words.
// Used at server start (instrumentation.ts) and by `npm run check:env`. No imports, so it runs anywhere.

export type EnvLevel = "error" | "warn" | "ok";

export interface EnvFinding {
    name: string;
    level: EnvLevel;
    message: string;
}

type Env = Record<string, string | undefined>;

const has = (v: string | undefined) => !!v && v.trim().length > 0;

function isBase64Key32(v: string): boolean {
    try { return Buffer.from(v.trim(), "base64").length === 32; } catch { return false; }
}

export function checkEnv(env: Env, opts: { production: boolean }): EnvFinding[] {
    const out: EnvFinding[] = [];
    const add = (name: string, level: EnvLevel, message: string) => out.push({ name, level, message });
    const prod = opts.production;

    // Database
    const db = env.DATABASE_URL?.trim();
    if (!db) add("DATABASE_URL", "error", "Missing. Use your Neon connection string (the pooled one, whose host contains -pooler).");
    else if (!/^postgres(ql)?:\/\//i.test(db)) add("DATABASE_URL", "error", "Doesn't look like a Postgres connection string (postgresql://...).");
    else {
        add("DATABASE_URL", "ok", "Set.");
        if (!/-pooler\./.test(db)) add("DATABASE_URL", "warn", "Not the pooled connection (host without -pooler). Serverless functions open many short connections; use Neon's pooled string.");
        if (!/sslmode=/.test(db)) add("DATABASE_URL", "warn", "No sslmode in the connection string. Add ?sslmode=require so traffic to the database is encrypted.");
    }

    // Auth
    const secret = env.BETTER_AUTH_SECRET?.trim();
    if (!secret) add("BETTER_AUTH_SECRET", "error", "Missing. Generate one with: openssl rand -base64 32");
    else if (secret.length < 32) add("BETTER_AUTH_SECRET", prod ? "error" : "warn", "Too short: use at least 32 random characters.");
    else if (new Set(secret).size < 12 || /^(better-auth-secret-123456789|changeme|change-me|your-secret|secret)\b/i.test(secret)) add("BETTER_AUTH_SECRET", prod ? "error" : "warn", "Looks like a placeholder or a low-randomness value. Generate a real one: openssl rand -base64 32");
    else add("BETTER_AUTH_SECRET", "ok", "Set.");

    const authUrl = env.BETTER_AUTH_URL?.trim();
    const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
    if (!authUrl && !appUrl) add("BETTER_AUTH_URL", prod ? "error" : "warn", "Missing. Set it (and NEXT_PUBLIC_APP_URL) to the public address of the app, e.g. https://app.example.com. Email links and origin checks depend on it.");
    else {
        const url = authUrl || appUrl!;
        if (prod && !/^https:\/\//i.test(url)) add("BETTER_AUTH_URL", "error", "Must be an https:// address in production, or cookies and links are not secure.");
        else add("BETTER_AUTH_URL", "ok", "Set.");
        if (authUrl && appUrl && authUrl.replace(/\/$/, "") !== appUrl.replace(/\/$/, "")) add("NEXT_PUBLIC_APP_URL", "warn", "Differs from BETTER_AUTH_URL. They should be the same address.");
    }
    if (!appUrl) add("NEXT_PUBLIC_APP_URL", prod ? "warn" : "ok", prod ? "Missing. Used for the sign-in client, sitemap and social-share images." : "Not set (fine locally).");

    // Credentials store
    const key = env.CREDENTIALS_KEY?.trim();
    if (!key) add("CREDENTIALS_KEY", "error", "Missing. Without it saved credentials can't be stored or read. Generate: openssl rand -base64 32");
    else if (!isBase64Key32(key)) add("CREDENTIALS_KEY", "error", "Must be 32 random bytes, base64-encoded (openssl rand -base64 32).");
    else add("CREDENTIALS_KEY", "ok", "Set. Back it up: losing it makes every saved credential unreadable.");

    // AI
    if (!has(env.GROQ_API_KEY)) add("GROQ_API_KEY", "warn", "Missing. AI workflow generation and AI nodes won't work.");
    else add("GROQ_API_KEY", "ok", "Set.");

    // Scheduler
    const cron = env.CRON_SECRET?.trim();
    if (!cron) add("CRON_SECRET", "warn", "Missing. Scheduled workflows won't run and old run history won't be cleaned up.");
    else if (cron.length < 24) add("CRON_SECRET", "warn", "Short. Use at least 24 random characters (openssl rand -hex 24).");
    else add("CRON_SECRET", "ok", "Set. Remember something must call /api/cron/tick about once a minute.");

    // Email (verification + password reset)
    const key1 = has(env.RESEND_API_KEY), from = has(env.EMAIL_FROM);
    if (key1 && from) add("RESEND_API_KEY", "ok", "Email is on: new accounts must verify their address and \"Forgot password\" works.");
    else if (key1 !== from) add(key1 ? "EMAIL_FROM" : "RESEND_API_KEY", "warn", "Email needs BOTH RESEND_API_KEY and EMAIL_FROM. With only one, email stays off.");
    else add("RESEND_API_KEY", "warn", "Not set: email is off, so sign-up has no email verification and there is no password reset.");
    if (prod && env.AUTH_EMAIL_MODE === "console") add("AUTH_EMAIL_MODE", "error", "console mode prints emails (with sign-in links) to the logs. It must not be set in production.");

    // Legal pages
    if (prod && !has(env.NEXT_PUBLIC_CONTACT_EMAIL)) add("NEXT_PUBLIC_CONTACT_EMAIL", "warn", "Missing. The Privacy Policy and Terms tell people to email you to delete their account; set the address (and NEXT_PUBLIC_LEGAL_NAME).");

    return out;
}

export const hasErrors = (findings: EnvFinding[]) => findings.some((f) => f.level === "error");
