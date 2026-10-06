"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Logo } from "@/components/ui/logo";
import { showToast } from "@/components/ui/Toast";
import PasswordField from "@/components/auth/PasswordField";
import { checkPassword } from "@/lib/password-policy";

// Where the link in the reset email lands: /reset-password?token=...  (or ?error=INVALID_TOKEN when it's expired or used)
export default function ResetPasswordPage() {
    const router = useRouter();
    const [token, setToken] = useState<string | null | undefined>(undefined); // undefined = still reading the URL
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const q = new URLSearchParams(window.location.search);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the query string only exists in the browser
        setToken(q.get("error") ? null : q.get("token"));
    }, []);

    const policy = checkPassword(password);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !policy.ok) return;
        setBusy(true);
        setError(null);
        const { error: err } = await authClient.resetPassword({ newPassword: password, token });
        setBusy(false);
        if (err) {
            setError(err.code === "INVALID_TOKEN" ? "This link has expired or was already used. Ask for a new one." : err.message || "Couldn't reset your password.");
            return;
        }
        showToast("Password changed. Sign in with your new password.", "success");
        router.push("/login");
    };

    const dead = token === null || (token !== undefined && !token);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-3">
            <div className="w-full max-w-md rounded-[28px] border border-border/70 bg-card p-8 shadow-card sm:p-10">
                <Link href="/" className="mb-8 block w-fit"><Logo /></Link>

                {token === undefined ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : dead ? (
                    <div role="alert">
                        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><TriangleAlert className="h-5 w-5" /></span>
                        <h1 className="text-2xl font-semibold tracking-tight">This link doesn&apos;t work</h1>
                        <p className="mt-2 text-sm text-muted-foreground">Reset links expire after an hour and can only be used once. Request a new one from the sign-in page.</p>
                        <Link href="/login" className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">Back to sign in</Link>
                    </div>
                ) : (
                    <>
                        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
                        <p className="mt-2 text-sm text-muted-foreground">You&apos;ll be signed out everywhere else once it&apos;s changed.</p>
                        <form onSubmit={submit} className="mt-6 space-y-3">
                            <PasswordField value={password} onChange={setPassword} mode="new" disabled={busy} label="New password" placeholder="New password" />
                            {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{error}</p>}
                            <button type="submit" disabled={busy || !policy.ok} className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100">
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Change password <ArrowRight className="h-4 w-4" /></>}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
