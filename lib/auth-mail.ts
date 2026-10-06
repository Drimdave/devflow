// Email for sign-in flows (verify your address, reset your password). Sent through Resend.
//   production: set RESEND_API_KEY and EMAIL_FROM (e.g. "DevFlow <noreply@yourdomain.com>")
//   local dev : AUTH_EMAIL_MODE=console prints the emails to the server log instead (refused in production)
// With neither, email is "off": sign-up stays open without verification and password reset is unavailable.

export type MailMode = "resend" | "console" | "off";

export function mailMode(): MailMode {
    if (process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()) return "resend";
    if (process.env.NODE_ENV !== "production" && process.env.AUTH_EMAIL_MODE === "console") return "console";
    return "off";
}

export interface AuthMail {
    to: string;
    subject: string;
    text: string;
}

export async function sendAuthMail(mail: AuthMail): Promise<void> {
    const mode = mailMode();
    if (mode === "console") {
        console.log(`\n[auth email -> ${mail.to}] ${mail.subject}\n${mail.text}\n`);
        return;
    }
    if (mode !== "resend") throw new Error("Email isn't configured on this server");
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "content-type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM!.trim(), to: [mail.to], subject: mail.subject, text: mail.text }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Email provider refused the message (HTTP ${res.status})`);
}

export const verifyEmailMail = (to: string, name: string, url: string): AuthMail => ({
    to,
    subject: "Confirm your email for DevFlow",
    text: `Hi ${name || "there"},\n\nConfirm your email address to finish setting up your DevFlow account:\n\n${url}\n\nThis link works for one hour. If you didn't create an account, you can ignore this email.\n`,
});

export const resetPasswordMail = (to: string, name: string, url: string): AuthMail => ({
    to,
    subject: "Reset your DevFlow password",
    text: `Hi ${name || "there"},\n\nSomeone asked to reset the password for your DevFlow account. To choose a new one, open:\n\n${url}\n\nThis link works for one hour and can be used once. If it wasn't you, ignore this email: your password hasn't changed.\n`,
});
