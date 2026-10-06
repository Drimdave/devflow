"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Download, Loader2, LogOut, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/Toast";
import PasswordField from "@/components/auth/PasswordField";
import { checkPassword } from "@/lib/password-policy";
import CredentialsSection from "@/components/settings/CredentialsSection";
import { authClient, signOut, useSession } from "@/lib/auth-client";

type ThemeOption = "light" | "dark" | "system";

const APP_VERSION = "0.1.0-beta";

function Section({ title, description, children, delay = 0 }: { title: string; description: string; children: React.ReactNode; delay?: number }) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-border/70 bg-card p-6 shadow-card sm:p-8"
        >
            <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <div className="mt-6">{children}</div>
        </motion.section>
    );
}

const inputCls =
    "h-12 w-full rounded-2xl bg-muted px-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/20 disabled:opacity-60";

/** A tiny picture of each theme so the choice is visual, not just a word. */
function ThemePreview({ mode }: { mode: ThemeOption }) {
    const light = (
        <div className="h-full w-full bg-[#EFEFED] p-2">
            <div className="h-full rounded-lg bg-white p-2 shadow-sm">
                <div className="h-1.5 w-8 rounded-full bg-neutral-800" />
                <div className="mt-1.5 h-1 w-12 rounded-full bg-neutral-300" />
                <div className="mt-2 h-3 w-5 rounded-full bg-[#C8F31D]" />
            </div>
        </div>
    );
    const dark = (
        <div className="h-full w-full bg-[#0D0D0D] p-2">
            <div className="h-full rounded-lg bg-[#171717] p-2">
                <div className="h-1.5 w-8 rounded-full bg-neutral-100" />
                <div className="mt-1.5 h-1 w-12 rounded-full bg-neutral-600" />
                <div className="mt-2 h-3 w-5 rounded-full bg-[#C8F31D]" />
            </div>
        </div>
    );
    if (mode === "light") return light;
    if (mode === "dark") return dark;
    return (
        <div className="relative h-full w-full">
            {light}
            <div className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">{dark}</div>
        </div>
    );
}

export default function SettingsPage() {
    const { data: session, isPending } = useSession();

    // ── Profile ──
    const [name, setName] = useState("");
    const [savingName, setSavingName] = useState(false);
    useEffect(() => {
        if (session?.user?.name) setName(session.user.name);
    }, [session?.user?.name]);

    const saveName = async (e: React.FormEvent) => {
        e.preventDefault();
        const next = name.trim();
        if (!next || next === session?.user?.name) return;
        setSavingName(true);
        const { error } = await authClient.updateUser({ name: next });
        setSavingName(false);
        if (error) showToast(error.message || "Couldn't update your name", "error");
        else showToast("Name updated", "success");
    };

    // ── Appearance ──
    const [theme, setTheme] = useState<ThemeOption>("light");
    useEffect(() => {
        try {
            const saved = localStorage.getItem("devflow-theme");
            if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
        } catch { /* storage unavailable */ }
    }, []);
    const chooseTheme = (next: ThemeOption) => {
        setTheme(next);
        try { localStorage.setItem("devflow-theme", next); } catch { /* ignore */ }
        const isDark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        document.documentElement.classList.toggle("dark", isDark);
    };
    const themes: { value: ThemeOption; label: string; icon: LucideIcon }[] = [
        { value: "light", label: "Light", icon: Sun },
        { value: "dark", label: "Dark", icon: Moon },
        { value: "system", label: "System", icon: Monitor },
    ];

    // ── Your data ──
    const [exporting, setExporting] = useState(false);
    const exportAll = async () => {
        setExporting(true);
        try {
            const res = await fetch("/api/workflows?full=1");
            if (!res.ok) throw new Error();
            const { workflows } = await res.json();
            const payload = {
                exportedAt: new Date().toISOString(),
                app: "DevFlow",
                workflows: (workflows as { name: string; description: string; created_at: string; updated_at: string; nodes_json?: unknown[]; edges_json?: unknown[] }[]).map((w) => ({
                    name: w.name,
                    description: w.description,
                    createdAt: w.created_at,
                    updatedAt: w.updated_at,
                    nodes: w.nodes_json ?? [],
                    edges: w.edges_json ?? [],
                })),
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `devflow-workflows-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast(`Exported ${payload.workflows.length} ${payload.workflows.length === 1 ? "workflow" : "workflows"}`, "success");
        } catch {
            showToast("Couldn't export your workflows", "error");
        } finally {
            setExporting(false);
        }
    };

    // ── Security ──
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [pwError, setPwError] = useState<string | null>(null);
    const [changingPw, setChangingPw] = useState(false);

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwError(null);
        const check = checkPassword(next, { email: session?.user?.email, name: session?.user?.name });
        if (!check.ok) return setPwError(check.messages[0]);
        if (next !== confirm) return setPwError("The new passwords don't match.");
        if (next === current) return setPwError("Choose a password different from your current one.");
        setChangingPw(true);
        const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
        setChangingPw(false);
        if (error) {
            setPwError(error.message || "Couldn't change your password.");
            return;
        }
        setCurrent(""); setNext(""); setConfirm("");
        showToast("Password changed. Other devices were signed out.", "success");
    };

    const [signingOut, setSigningOut] = useState(false);
    const handleSignOut = async () => {
        setSigningOut(true);
        await signOut();
        // Full navigation to the public home page (also clears all in-memory app state)
        window.location.assign("/");
    };

    // ── About ──
    const [about, setAbout] = useState<{ aiModel: string; dbRegion: string | null } | null>(null);
    useEffect(() => {
        let cancelled = false;
        fetch("/api/about")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (!cancelled) setAbout(d); })
            .catch(() => { /* leave as loading dashes */ });
        return () => { cancelled = true; };
    }, []);

    const nameChanged = name.trim() !== "" && name.trim() !== (session?.user?.name ?? "");

    return (
        <div className="h-full overflow-y-auto bg-dots-fine">
            <div className="mx-auto max-w-3xl px-6 pb-20 pt-12 sm:px-10 sm:pt-14">
                <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="mb-8">
                    <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Settings</h1>
                    <p className="mt-3 text-lg text-muted-foreground">Your account, your look, your data.</p>
                </motion.header>

                <div className="space-y-5">
                    {/* Profile */}
                    <Section title="Profile" description="How you appear in DevFlow." delay={0.05}>
                        <div className="mb-5 flex items-center gap-4">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground font-display text-xl font-semibold text-background">
                                {isPending ? "" : (session?.user?.name?.charAt(0) || "?").toUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate font-medium">{session?.user?.name ?? "…"}</p>
                                <p className="truncate text-sm text-muted-foreground">{session?.user?.email ?? "…"}</p>
                            </div>
                        </div>
                        <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row">
                            <label className="sr-only" htmlFor="display-name">Display name</label>
                            <input id="display-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Display name" className={inputCls} disabled={isPending} />
                            <button
                                type="submit"
                                disabled={!nameChanged || savingName}
                                className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-transform hover:scale-[1.03] active:scale-95 disabled:scale-100 disabled:opacity-40"
                            >
                                {savingName && <Loader2 className="h-4 w-4 animate-spin" />}
                                Save name
                            </button>
                        </form>
                        <p className="mt-3 text-xs text-muted-foreground">Your email is your sign-in and can&apos;t be changed here yet.</p>
                    </Section>

                    {/* Appearance */}
                    <Section title="Appearance" description="Pick how DevFlow looks. It's remembered on this device." delay={0.1}>
                        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
                            {themes.map((t) => {
                                const active = theme === t.value;
                                return (
                                    <button
                                        key={t.value}
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => chooseTheme(t.value)}
                                        className={cn(
                                            "group overflow-hidden rounded-2xl border-2 text-left transition-all",
                                            active ? "border-foreground" : "border-border hover:border-foreground/30"
                                        )}
                                    >
                                        <div className="relative h-20 sm:h-24">
                                            <ThemePreview mode={t.value} />
                                        </div>
                                        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                                            <span className="flex items-center gap-2 text-sm font-medium"><t.icon className="h-4 w-4 text-muted-foreground" />{t.label}</span>
                                            {active && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </Section>

                    {/* Your data */}
                    <Section title="Credentials" description="API keys, tokens and webhook URLs your workflows can use." delay={0.125}>
                        <CredentialsSection />
                    </Section>

                    <Section title="Your data" description="Everything you build belongs to you." delay={0.15}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-medium">Export all workflows</p>
                                <p className="mt-0.5 text-sm text-muted-foreground">Download every workflow as one JSON file.</p>
                            </div>
                            <button
                                onClick={exportAll}
                                disabled={exporting}
                                className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-medium transition-colors hover:border-foreground/30 disabled:opacity-60"
                            >
                                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                Export JSON
                            </button>
                        </div>
                    </Section>

                    {/* Security */}
                    <Section title="Security" description="Change your password, or sign out of this device." delay={0.2}>
                        <form onSubmit={changePassword} className="space-y-3">
                            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" autoComplete="current-password" aria-label="Current password" required className={inputCls} />
                            <PasswordField value={next} onChange={setNext} mode="new" who={{ email: session?.user?.email, name: session?.user?.name }} label="New password" placeholder="New password" />
                            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" aria-label="Confirm new password" required className={inputCls} />
                            {pwError && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{pwError}</p>}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                <button
                                    type="submit"
                                    disabled={changingPw || !current || !next || !confirm}
                                    className="flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-transform hover:scale-[1.03] active:scale-95 disabled:scale-100 disabled:opacity-40"
                                >
                                    {changingPw && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Change password
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSignOut}
                                    disabled={signingOut}
                                    className="flex h-11 items-center gap-2 rounded-full border border-destructive/30 px-5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                                >
                                    {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                                    Sign out
                                </button>
                            </div>
                        </form>
                    </Section>

                    {/* About */}
                    <Section title="About" description="What DevFlow is running on." delay={0.25}>
                        <dl className="divide-y divide-border rounded-2xl border border-border text-sm">
                            {[
                                ["Version", APP_VERSION],
                                ["AI model", about ? about.aiModel : "…"],
                                ["Database", about ? (about.dbRegion ? `Neon Postgres · ${about.dbRegion}` : "Neon Postgres") : "…"],
                            ].map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                                    <dt className="text-muted-foreground">{k}</dt>
                                    <dd className="truncate font-mono text-[13px]">{v}</dd>
                                </div>
                            ))}
                        </dl>
                    </Section>
                </div>
            </div>
        </div>
    );
}
