"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import {
    ArrowRight, ArrowUpRight, Zap, Sparkles, GitBranch, Database, MousePointerClick, Play, Download, Bell, Layers, Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import LiveDemo from "./LiveDemo";
import { nodeKindStyles, type NodeKind } from "@/lib/node-visuals";
import { TEMPLATES } from "@/lib/templates";

const fadeUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

/** Dotted connector, like a wire between two sections. */
function Wire({ className }: { className?: string }) {
    return (
        <div className={cn("flex flex-col items-center", className)} aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full border-2 border-foreground bg-card" />
            <span className="h-20 border-l-2 border-dashed border-foreground/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
        </div>
    );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-volt ring-2 ring-volt/40" />
            {children}
        </span>
    );
}

function FloatTile({ className, kind, icon: Icon, delay = 0 }: { className?: string; kind: NodeKind; icon: typeof Zap; delay?: number }) {
    return (
        <div
            className={cn("absolute hidden animate-float-y rounded-[22px] border border-border bg-card p-3 shadow-card lg:block", className)}
            style={{ animationDelay: `${delay}s` }}
            aria-hidden
        >
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", nodeKindStyles[kind].chip)}>
                <Icon className="h-6 w-6" />
            </div>
        </div>
    );
}

const steps = [
    {
        n: "01",
        title: "Describe it",
        body: "Type what you want to automate in plain English. DevFlow drafts the full node graph, branches included.",
        visual: (
            <div className="rounded-2xl bg-muted p-4 text-left text-[13px] leading-relaxed text-muted-foreground">
                <span className="text-foreground">“When a lead arrives, enrich it, and ping Slack if it&apos;s an enterprise company.”</span>
                <div className="mt-3 flex items-center gap-2 text-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> <span className="text-xs font-medium">Generating 5 nodes…</span>
                </div>
            </div>
        ),
    },
    {
        n: "02",
        title: "Refine on the canvas",
        body: "Drag nodes in, rewire edges, edit settings, or keep chatting to change the flow. Nothing is locked in.",
        visual: (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-muted p-4">
                {(["trigger", "logic", "action"] as NodeKind[]).map((k, i) => {
                    const Icon = [Zap, GitBranch, Play][i];
                    return (
                        <div key={k} className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
                            <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", nodeKindStyles[k].chip)}>
                                <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-xs font-medium capitalize">{k}</span>
                        </div>
                    );
                })}
            </div>
        ),
    },
    {
        n: "03",
        title: "Run and watch",
        body: "Hit Run and see each node light up in order, with a live console of what happened and when.",
        visual: (
            <div className="rounded-2xl bg-[#0B0B0C] p-4 text-left font-mono text-[12px] leading-relaxed">
                <p className="text-zinc-400">12:04:01 <span className="text-zinc-300">Starting: New lead</span></p>
                <p className="text-zinc-400">12:04:02 <span className="text-[#C8F31D]">Payload received</span></p>
                <p className="text-zinc-400">12:04:03 <span className="text-zinc-300">Routing to 2 nodes…</span></p>
                <p className="text-zinc-400">12:04:04 <span className="text-[#C8F31D]">Workflow executed</span></p>
            </div>
        ),
    },
];

// Landing use cases ARE the shared templates, so what visitors try here is what they get in the app.
const USE_CASE_VISUALS: Record<string, { icon: typeof Zap; kind: NodeKind }> = {
    "lead-routing": { icon: Sparkles, kind: "trigger" },
    "issue-alerts": { icon: GitBranch, kind: "logic" },
    "morning-digest": { icon: Bell, kind: "action" },
    "support-triage": { icon: Zap, kind: "trigger" },
    "failed-payments": { icon: Rocket, kind: "action" },
    "sheet-sync": { icon: Layers, kind: "data" },
};

const useCases = TEMPLATES.filter((t) => t.landing).map((t) => ({
    role: t.landing!.role,
    title: t.landing!.title,
    prompt: t.prompt,
    ...(USE_CASE_VISUALS[t.id] ?? { icon: Zap, kind: "action" as NodeKind }),
}));

export default function LandingPage() {
    return (
        <MotionConfig reducedMotion="user">
        <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground selection:bg-volt selection:text-volt-foreground">
            {/* Nav */}
            <div className="fixed left-1/2 top-4 z-50 w-full max-w-4xl -translate-x-1/2 px-4">
                <nav className="flex h-14 items-center justify-between rounded-full border border-border/70 bg-card/80 pl-5 pr-2 shadow-card backdrop-blur-xl">
                    <Link
                        href="/"
                        onClick={(e) => {
                            e.preventDefault();
                            window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="transition-opacity hover:opacity-80"
                        aria-label="DevFlow home"
                    >
                        <Logo />
                    </Link>
                    <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
                        <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
                        <a href="#features" className="transition-colors hover:text-foreground">Features</a>
                        <a href="#use-cases" className="transition-colors hover:text-foreground">Use cases</a>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Link href="/login" className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex">
                            Log in
                        </Link>
                        <Link href="/login" className="flex h-10 items-center gap-1.5 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-transform hover:scale-[1.04]">
                            Get started <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </nav>
            </div>

            <main>
                {/* Hero */}
                <section className="relative px-4 pb-10 pt-36 sm:pt-44">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--volt)/0.22),transparent_70%)]" />
                    <div className="bg-dots-fine pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />

                    <div className="relative mx-auto max-w-5xl text-center">
                        <FloatTile className="-left-2 top-6 -rotate-6 xl:left-6" kind="trigger" icon={Zap} />
                        <FloatTile className="right-0 top-0 rotate-6 xl:right-8" kind="action" icon={Sparkles} delay={1.2} />
                        <FloatTile className="-left-6 top-64 rotate-3 xl:left-0" kind="logic" icon={GitBranch} delay={2.1} />
                        <FloatTile className="-right-4 top-60 -rotate-3 xl:right-2" kind="data" icon={Database} delay={0.6} />

                        <div>
                            <Eyebrow>AI workflow automation</Eyebrow>
                        </div>

                        {/* Hero copy renders visible in the server HTML (no opacity-0 start) so it paints before JS loads */}
                        <h1
                            className="mx-auto mt-7 max-w-3xl text-balance text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl"
                        >
                            Describe it.
                            <br />
                            Watch it <span className="highlight-volt">run.</span>
                        </h1>

                        <p
                            className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground"
                        >
                            DevFlow turns plain English into a working automation graph you can edit, save and run, in seconds.
                        </p>

                        <div
                            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
                        >
                            <Link href="/login" className="group flex h-14 items-center gap-2 rounded-full bg-foreground pl-7 pr-3 text-base font-semibold text-background transition-transform hover:scale-[1.03]">
                                Start building free
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-volt text-volt-foreground transition-transform group-hover:translate-x-0.5">
                                    <ArrowRight className="h-4 w-4" />
                                </span>
                            </Link>
                            <a href="#how" className="flex h-14 items-center rounded-full border border-border bg-card px-7 text-base font-medium transition-colors hover:border-foreground/30">
                                See how it works
                            </a>
                        </div>
                        <p className="mt-5 text-sm text-muted-foreground">Free during beta · No credit card · Or try it right below, no sign-up</p>
                    </div>

                    <motion.div
                        initial={{ y: 40 }}
                        animate={{ y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="relative mx-auto mt-16 max-w-5xl rounded-[36px] border border-border/70 bg-card/50 p-2 shadow-card backdrop-blur sm:p-3"
                    >
                        <LiveDemo />
                    </motion.div>
                </section>

                <div className="flex justify-center"><Wire /></div>

                {/* How it works */}
                <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
                    <motion.div {...fadeUp} className="mx-auto mb-14 max-w-2xl text-center">
                        <Eyebrow>How it works</Eyebrow>
                        <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                            From idea to running flow in <span className="highlight-volt">three steps</span>
                        </h2>
                    </motion.div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {steps.map((s, i) => (
                            <motion.div
                                key={s.n}
                                {...fadeUp}
                                transition={{ ...fadeUp.transition, delay: i * 0.1 }}
                                className="relative flex flex-col rounded-[28px] border border-border/70 bg-card p-6 shadow-card"
                            >
                                <div className="mb-5 flex items-center justify-between">
                                    <span className="font-mono text-sm text-muted-foreground">{s.n}</span>
                                    {i < steps.length - 1 && <ArrowRight className="hidden h-4 w-4 text-muted-foreground/50 md:block" />}
                                </div>
                                <div className="mb-6 min-h-[132px]">{s.visual}</div>
                                <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Features */}
                <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
                    <motion.div {...fadeUp} className="mx-auto mb-14 max-w-2xl text-center">
                        <Eyebrow>Features</Eyebrow>
                        <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                            Built to be <span className="highlight-volt">followed</span>, not guessed at
                        </h2>
                    </motion.div>

                    <div className="grid gap-4 md:grid-cols-6">
                        <motion.div {...fadeUp} className="relative overflow-hidden rounded-[28px] bg-foreground p-8 text-background md:col-span-4">
                            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-volt/30 blur-[80px]" />
                            <Sparkles className="mb-6 h-7 w-7 text-volt" />
                            <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">Prompt to flow</h3>
                            <p className="mt-3 max-w-md text-background/70">
                                Skip the blank canvas. Describe the outcome and DevFlow lays out triggers, actions and branches for you, wired and positioned.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-2">
                                {["Send Slack alert on failed payment", "Daily digest of new signups", "Sync leads to a sheet"].map((t) => (
                                    <span key={t} className="rounded-full border border-background/20 px-3.5 py-1.5 text-xs text-background/80">{t}</span>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="flex flex-col rounded-[28px] border border-border/70 bg-card p-8 shadow-card md:col-span-2">
                            <div className="mb-6 flex min-h-[88px] items-center justify-center rounded-2xl bg-muted/60 bg-dots-fine px-3 py-4">
                                <div className="flex items-center">
                                    {(["trigger", "logic", "action"] as NodeKind[]).map((k, i) => {
                                        const Icon = [Zap, GitBranch, Play][i];
                                        return (
                                            <div key={k} className="flex items-center">
                                                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl border border-border shadow-sm", nodeKindStyles[k].chip)}>
                                                    <Icon className="h-[18px] w-[18px]" />
                                                </span>
                                                {i < 2 && <span className="h-px w-5 border-t-2 border-dashed border-foreground/30" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <h3 className="text-xl font-semibold tracking-tight">Visual canvas</h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                Drag, connect and tweak every node. Zoom, pan and a mini-map are built in.
                            </p>
                        </motion.div>

                        <motion.div {...fadeUp} className="flex flex-col rounded-[28px] border border-border/70 bg-card p-8 shadow-card md:col-span-3">
                            <div className="mb-6 min-h-[88px] rounded-2xl bg-[#0B0B0C] p-3.5 font-mono text-[11px] leading-relaxed">
                                <p className="text-zinc-400">14:58:36 <span className="text-zinc-300">Starting: New lead</span></p>
                                <p className="text-zinc-400">14:58:39 <span className="text-[#C8F31D]">Payload received</span></p>
                                <p className="text-zinc-400">14:58:45 <span className="text-[#C8F31D]">Workflow executed</span></p>
                            </div>
                            <h3 className="text-xl font-semibold tracking-tight">Live execution</h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                Nodes light up as they run, and a streaming console shows every step.
                            </p>
                        </motion.div>

                        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="flex flex-col rounded-[28px] border border-border/70 bg-card p-8 shadow-card md:col-span-3">
                            <div className="mb-6 min-h-[88px] rounded-2xl bg-muted/60 p-3.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                                <p>{"{"}</p>
                                <p className="pl-3"><span className="text-foreground">&quot;name&quot;</span>: &quot;Lead routing&quot;,</p>
                                <p className="pl-3"><span className="text-foreground">&quot;nodes&quot;</span>: [ … 5 ],</p>
                                <p className="pl-3"><span className="text-foreground">&quot;edges&quot;</span>: [ … 4 ]</p>
                                <p>{"}"}</p>
                            </div>
                            <h3 className="text-xl font-semibold tracking-tight">Yours to keep</h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                Save to your account, duplicate, or export any workflow as plain JSON.
                            </p>
                        </motion.div>

                        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }} className="flex flex-col rounded-[28px] border border-border/70 bg-volt p-8 text-volt-foreground md:col-span-3">
                            <Zap className="mb-6 h-7 w-7" />
                            <h3 className="text-xl font-semibold tracking-tight">Simple by default. Editable all the way down.</h3>
                            <p className="mt-2 max-w-md text-sm leading-relaxed text-volt-foreground/70">
                                Ask DevFlow to draft it, then open any node and change every field. Generation runs on Groq, so the first draft lands in seconds.
                            </p>
                        </motion.div>

                        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }} className="flex flex-col rounded-[28px] border border-border/70 bg-card p-8 shadow-card md:col-span-3">
                            <MousePointerClick className="mb-6 h-7 w-7" />
                            <h3 className="text-xl font-semibold tracking-tight">Re-run just one node</h3>
                            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                                Testing a single step shouldn&apos;t mean replaying everything. Open a node&apos;s menu and run only that one.
                            </p>
                        </motion.div>
                    </div>
                </section>

                {/* Use cases */}
                <section id="use-cases" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
                    <motion.div {...fadeUp} className="mb-10 max-w-2xl">
                        <Eyebrow>Use cases</Eyebrow>
                        <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                            One sentence per <span className="highlight-volt">job</span>
                        </h2>
                        <p className="mt-4 text-lg text-muted-foreground">Pick one and watch it build in the demo above.</p>
                    </motion.div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {useCases.map((u, i) => (
                            <motion.button
                                key={u.role}
                                {...fadeUp}
                                transition={{ ...fadeUp.transition, delay: (i % 3) * 0.08 }}
                                onClick={() => window.dispatchEvent(new CustomEvent("devflow:try", { detail: u.prompt }))}
                                className="group flex flex-col rounded-[28px] border border-border/70 bg-card p-6 text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20"
                            >
                                <div className="mb-6 flex items-start justify-between">
                                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", nodeKindStyles[u.kind].chip)}>
                                        <u.icon className="h-6 w-6" />
                                    </div>
                                    <span className="flex h-8 items-center gap-1 rounded-full bg-muted px-3 text-xs font-medium transition-colors group-hover:bg-volt group-hover:text-volt-foreground">
                                        Try it <ArrowUpRight className="h-3.5 w-3.5" />
                                    </span>
                                </div>
                                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{u.role} can</p>
                                <h3 className="mt-1 text-lg font-semibold tracking-tight">{u.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">&ldquo;{u.prompt}&rdquo;</p>
                            </motion.button>
                        ))}
                    </div>
                </section>

                {/* Built with */}
                <section className="mx-auto max-w-6xl px-4 py-10">
                    <motion.div {...fadeUp} className="flex flex-col items-center gap-4 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Under the hood</p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {["Next.js 16", "React Flow", "Groq", "Neon Postgres", "Better Auth", "TypeScript"].map((t) => (
                                <span key={t} className="rounded-full border border-border bg-card px-4 py-1.5 font-mono text-xs text-muted-foreground">{t}</span>
                            ))}
                        </div>
                    </motion.div>
                </section>

                {/* CTA */}
                <section className="px-4 pb-24 pt-10">
                    <motion.div
                        {...fadeUp}
                        className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] bg-foreground px-6 py-20 text-center text-background sm:py-28"
                    >
                        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-volt/40 blur-[110px]" />
                        <h2 className="relative mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
                            Your first workflow is one sentence away.
                        </h2>
                        <p className="relative mx-auto mt-5 max-w-md text-balance text-background/70">
                            Start with the one job you keep doing by hand.
                        </p>
                        <Link
                            href="/login"
                            className="group relative mt-10 inline-flex h-14 items-center gap-2 rounded-full bg-volt pl-8 pr-3 text-base font-semibold text-volt-foreground transition-transform hover:scale-[1.04]"
                        >
                            Start building free
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-transform group-hover:translate-x-0.5">
                                <ArrowRight className="h-4 w-4" />
                            </span>
                        </Link>
                        <p className="relative mt-5 text-xs text-background/50">Free during beta · No credit card</p>
                    </motion.div>
                </section>
            </main>

            <footer className="border-t border-border/70 px-4 py-10">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
                    <Link
                        href="/"
                        onClick={(e) => {
                            e.preventDefault();
                            window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        aria-label="Back to top"
                    >
                        <Logo />
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                        <p>© {new Date().getFullYear()} DevFlow. Build workflows at the speed of thought.</p>
                        <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
                        <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
                    </div>
                </div>
            </footer>
        </div>
        </MotionConfig>
    );
}
