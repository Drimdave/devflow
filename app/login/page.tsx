"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient, signIn, signUp } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, MailCheck } from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import { Logo } from "@/components/ui/logo";
import AppPreview from "@/components/landing/AppPreview";
import PasswordField from "@/components/auth/PasswordField";
import { checkPassword } from "@/lib/password-policy";

const inputCls =
    "h-12 w-full rounded-2xl bg-muted px-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/20 disabled:opacity-60";

type Mode = "signin" | "signup" | "forgot" | "check-verify" | "check-reset";

export default function LoginPage() {
    const [mode, setMode] = useState<Mode>("signin");
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [emailEnabled, setEmailEnabled] = useState(false);
    const router = useRouter();

    // Forgot-password and email checks only exist when this server can actually send email
    useEffect(() => {
        let live = true;
        fetch("/api/auth-config").then((r) => r.json()).then((d) => live && setEmailEnabled(!!d.emailEnabled)).catch(() => {});
        return () => { live = false; };
    }, []);

    const switchMode = (m: Mode) => { setMode(m); setError(null); setPassword(""); };
    const policy = mode === "signup" ? checkPassword(password, { email, name }) : null;

    // Turn the server's answer into something a person can act on
    const explain = (err: { message?: string; code?: string; status?: number }, fallback: string) => {
        if (err.code === "TOO_MANY_ATTEMPTS" || err.status === 429) return err.message || "Too many attempts. Please wait a moment and try again.";
        if (err.code === "EMAIL_NOT_VERIFIED") return "Please confirm your email first. We just sent you a new link.";
        if (err.code === "INVALID_EMAIL_OR_PASSWORD") return "That email and password don't match.";
        return err.message || fallback;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (mode === "signup" && policy && !policy.ok) { setError(policy.messages[0]); return; }
        setIsLoading(true);

        try {
            if (mode === "signin") {
                await signIn.email({ email, password }, {
                    onSuccess: () => { showToast("Signed in successfully", "success"); router.push("/"); },
                    onError: (ctx) => setError(explain(ctx.error, "Couldn't sign you in.")),
                });
            } else if (mode === "signup") {
                await signUp.email({ email, password, name: name.trim() }, {
                    onSuccess: (ctx) => {
                        // With email checks on there's no session yet: the person has to confirm their address first
                        if (!ctx.data?.token) { switchMode("check-verify"); return; }
                        showToast("Account created", "success");
                        router.push("/");
                    },
                    onError: (ctx) => setError(explain(ctx.error, "Couldn't create your account.")),
                });
            } else if (mode === "forgot") {
                // The answer is the same whether or not the address has an account, so this can't be used to look people up
                await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
                switchMode("check-reset");
            }
        } catch {
            setError("Something went wrong. Check your connection and try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const resendVerification = async () => {
        setIsLoading(true);
        await authClient.sendVerificationEmail({ email, callbackURL: "/" }).catch(() => {});
        setIsLoading(false);
        showToast("Sent again. Check your inbox.", "success");
    };

    return (
        <div className="grid min-h-screen gap-3 bg-background p-3 lg:grid-cols-[minmax(420px,520px)_1fr]">
            {/* Form */}
            <div className="flex flex-col rounded-[28px] border border-border/70 bg-card p-8 shadow-card sm:p-12">
                <Link href="/" className="w-fit">
                    <Logo />
                </Link>

                <div className="my-auto w-full max-w-sm py-12">
                    {mode === "check-verify" || mode === "check-reset" ? (
                        <div role="status">
                            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-volt text-volt-foreground"><MailCheck className="h-6 w-6" /></span>
                            <h1 className="text-balance text-3xl font-semibold tracking-tight">Check your email</h1>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {mode === "check-verify"
                                    ? <>We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Open it to finish creating your account.</>
                                    : <>If <span className="font-medium text-foreground">{email}</span> has an account, a link to choose a new password is on its way. It works for one hour.</>}
                            </p>
                            <div className="mt-8 flex flex-wrap gap-2">
                                {mode === "check-verify" && (
                                    <button onClick={resendVerification} disabled={isLoading} className="h-11 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60">
                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send it again"}
                                    </button>
                                )}
                                <button onClick={() => switchMode("signin")} className="h-11 rounded-full px-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Back to sign in</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-balance text-3xl font-semibold tracking-tight">
                                {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
                            </h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {mode === "signin" ? "Sign in to pick up your workflows." : mode === "signup" ? "Start building automations in minutes." : "Enter your email and we'll send you a link to choose a new one."}
                            </p>

                            <form onSubmit={handleSubmit} className="mt-8 space-y-3" noValidate={false}>
                                {mode === "signup" && (
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className={inputCls}
                                        placeholder="Full name"
                                        aria-label="Full name"
                                        autoComplete="name"
                                        maxLength={80}
                                        disabled={isLoading}
                                    />
                                )}
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={inputCls}
                                    placeholder="Email"
                                    aria-label="Email"
                                    autoComplete="email"
                                    maxLength={254}
                                    disabled={isLoading}
                                />
                                {mode !== "forgot" && (
                                    <PasswordField
                                        value={password}
                                        onChange={setPassword}
                                        mode={mode === "signup" ? "new" : "current"}
                                        who={{ email, name }}
                                        disabled={isLoading}
                                        label="Password"
                                    />
                                )}

                                {error && (
                                    <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading || (mode === "signup" && !!policy && !policy.ok)}
                                    className="group mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
                                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                        </>
                                    )}
                                </button>
                            </form>

                            {mode === "signin" && emailEnabled && (
                                <button onClick={() => switchMode("forgot")} className="mt-4 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline" disabled={isLoading}>
                                    Forgot your password?
                                </button>
                            )}

                            {mode === "signup" && (
                                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                                    By creating an account you agree to the <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">Terms</Link> and the <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</Link>.
                                </p>
                            )}

                            <p className="mt-6 text-sm text-muted-foreground">
                                {mode === "signin" ? "New to DevFlow? " : mode === "signup" ? "Already have an account? " : "Remembered it? "}
                                <button
                                    onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                                    className="font-semibold text-foreground underline underline-offset-4"
                                    disabled={isLoading}
                                >
                                    {mode === "signin" ? "Create an account" : "Sign in"}
                                </button>
                            </p>
                        </>
                    )}
                </div>

                <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} DevFlow</p>
            </div>

            {/* Showcase */}
            <div className="relative hidden overflow-hidden rounded-[28px] bg-[#0B0B0C] p-12 lg:flex lg:flex-col">
                <div className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-volt/25 blur-[110px]" />
                <div className="relative max-w-lg">
                    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/70">
                        <span className="h-1.5 w-1.5 rounded-full bg-volt" /> AI-powered workflow builder
                    </p>
                    <h2 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white xl:text-5xl">
                        Say what you want.
                        <br />
                        Watch it <span className="text-volt">come alive.</span>
                    </h2>
                </div>
                <div className="relative mt-auto translate-x-12 translate-y-12 pt-10">
                    <AppPreview />
                </div>
            </div>
        </div>
    );
}
