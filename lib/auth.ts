import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { Pool, types } from "pg";
import { MAX_PASSWORD, MIN_PASSWORD, checkPassword } from "@/lib/password-policy";
import { clearSignInFailures, recordSignInFailure, signInBlockedFor } from "@/lib/auth-guard";
import { lockoutMessage } from "@/lib/auth-lockout";
import { mailMode, resetPasswordMail, sendAuthMail, verifyEmailMail } from "@/lib/auth-mail";
import { ipFromHeaders } from "@/lib/rate-limit";

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in environment variables");
}

const isProd = process.env.NODE_ENV === "production";

// Postgres returns bigint as text. better-auth stores request times (milliseconds, a bigint column) for rate limiting and does
// arithmetic on them, so "1791...” + 60000 would be string concatenation and break Retry-After. Millisecond timestamps fit a number.
types.setTypeParser(types.builtins.INT8, (v: string) => Number(v));

// Be explicit about TLS: the pg driver is changing what "sslmode=require" means. Neon uses publicly trusted
// certificates, so full verification is the right (and current) behaviour.
const connectionString = process.env.DATABASE_URL.replace(/sslmode=(require|prefer|verify-ca)/, "sslmode=verify-full");

// The public address of the app. Links in emails and the trusted-origin check are built from it, so production must set it.
const baseURL = process.env.BETTER_AUTH_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || undefined;
if (isProd && !baseURL && process.env.NEXT_PHASE !== "phase-production-build") {
    console.error("[auth] BETTER_AUTH_URL (or NEXT_PUBLIC_APP_URL) is not set. Email links and origin checks need the public address of the app.");
}

const email = mailMode() !== "off"; // verification and password reset only exist when we can actually send email

const fail = (message: string, code: string): never => {
    throw new APIError("BAD_REQUEST", { message, code });
};

/** Names are shown around the app, so keep them to plain, reasonable text. */
function checkName(raw: unknown): string {
    const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
    if (!name) return fail("Enter your name.", "NAME_REQUIRED");
    if (name.length > 80) return fail("Keep your name under 80 characters.", "NAME_TOO_LONG");
    if (/[\u0000-\u001f\u007f<>]/.test(name)) return fail("Your name has characters we can't accept.", "NAME_INVALID");
    return name;
}

export const auth = betterAuth({
    database: new Pool({ connectionString }),
    ...(baseURL ? { baseURL, trustedOrigins: [baseURL] } : {}),

    emailAndPassword: {
        enabled: true,
        minPasswordLength: MIN_PASSWORD,
        maxPasswordLength: MAX_PASSWORD,
        requireEmailVerification: email,
        revokeSessionsOnPasswordReset: true,
        resetPasswordTokenExpiresIn: 60 * 60,
        ...(email
            ? { sendResetPassword: async ({ user, url }: { user: { email: string; name: string }; url: string }) => { await sendAuthMail(resetPasswordMail(user.email, user.name, url)); } }
            : {}),
    },

    ...(email
        ? {
            emailVerification: {
                sendOnSignUp: true,
                sendOnSignIn: true, // an unverified user who tries to sign in gets a fresh link
                autoSignInAfterVerification: true,
                expiresIn: 60 * 60,
                sendVerificationEmail: async ({ user, url }: { user: { email: string; name: string }; url: string }) => { await sendAuthMail(verifyEmailMail(user.email, user.name, url)); },
            },
        }
        : {}),

    session: {
        // Keep a signed copy of the session in a cookie for a few minutes, so most requests can
        // verify the user without a database round trip (each one costs 300ms+ to Neon).
        // Trade-off: signing out elsewhere or revoking a session can take up to maxAge to apply.
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60,
        },
    },

    // Limits per client address, kept in the database so they hold across serverless instances. On in every environment.
    rateLimit: {
        enabled: true,
        storage: "database",
        window: 60,
        max: 120,
        customRules: {
            "/sign-in/email": { window: 60, max: 10 },
            "/sign-up/email": { window: 600, max: 5 },
            "/request-password-reset": { window: 600, max: 3 },
            "/send-verification-email": { window: 600, max: 3 },
        },
    },

    advanced: {
        useSecureCookies: isProd,
        // Trust the headers our platform sets itself before the client-supplied ones
        ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for", "cf-connecting-ip", "x-real-ip", "x-forwarded-for"] },
    },

    hooks: {
        before: createAuthMiddleware(async (ctx) => {
            const body = (ctx.body ?? {}) as Record<string, unknown>;

            if (ctx.path === "/sign-up/email") {
                const name = checkName(body.name);
                const addr = typeof body.email === "string" ? body.email.trim() : "";
                if (addr.length > 254) fail("That email address is too long.", "EMAIL_TOO_LONG");
                const check = checkPassword(typeof body.password === "string" ? body.password : "", { email: addr, name });
                if (!check.ok) fail(check.messages[0], "PASSWORD_TOO_WEAK");
            }

            if (ctx.path === "/change-password" || ctx.path === "/reset-password") {
                const who = (ctx.context.session as { user?: { email?: string; name?: string } } | null)?.user ?? {};
                const check = checkPassword(typeof body.newPassword === "string" ? body.newPassword : "", who);
                if (!check.ok) fail(check.messages[0], "PASSWORD_TOO_WEAK");
            }

            if (ctx.path === "/sign-in/email" && typeof body.email === "string") {
                const wait = await signInBlockedFor(body.email, ipFromHeaders(ctx.request?.headers ?? new Headers()));
                if (wait > 0) throw new APIError("TOO_MANY_REQUESTS", { message: lockoutMessage(wait), code: "TOO_MANY_ATTEMPTS" });
            }
        }),

        after: createAuthMiddleware(async (ctx) => {
            if (ctx.path !== "/sign-in/email") return;
            const addr = (ctx.body as { email?: unknown } | undefined)?.email;
            if (typeof addr !== "string") return;
            const ip = ipFromHeaders(ctx.request?.headers ?? new Headers());
            const returned = ctx.context.returned;
            const failed = returned instanceof APIError;
            // Only wrong credentials count as guesses; a throttled or unverified-email response doesn't
            const wrongCredentials = failed && (returned as APIError & { body?: { code?: string } }).body?.code === "INVALID_EMAIL_OR_PASSWORD";
            if (wrongCredentials) await recordSignInFailure(addr, ip);
            else if (!failed) await clearSignInFailures(addr, ip);
        }),
    },
});
