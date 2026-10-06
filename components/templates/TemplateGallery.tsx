"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Search, X, Sparkles, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import GraphThumb from "@/components/ui/graph-thumb";
import { TEMPLATES, type Template, type TemplateCategory } from "@/lib/templates";
import { iconForNode, nodeKindStyles, normalizeKind } from "@/lib/node-visuals";

const CATEGORIES: TemplateCategory[] = ["Sales", "Engineering", "Support", "Finance", "Marketing", "Data", "Productivity"];

/** Unique tools a template touches (slack, gmail, …), in the order they appear. */
function toolsOf(t: Template): string[] {
    return [...new Set(t.graph.nodes.map((n) => n.provider).filter((p): p is string => !!p))];
}

function prettyTool(p: string) {
    const map: Record<string, string> = { openai: "OpenAI", sheets: "Google Sheets", http: "HTTP", rss: "RSS", json: "JSON", mongo: "MongoDB", postgres: "PostgreSQL", github: "GitHub", wordpress: "WordPress" };
    return map[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

function ToolDot({ provider, size = "sm" }: { provider: string; size?: "sm" | "md" }) {
    const Icon = iconForNode(provider, "action", { provider });
    return (
        <span
            title={prettyTool(provider)}
            className={cn("flex items-center justify-center rounded-lg bg-muted text-muted-foreground", size === "sm" ? "h-6 w-6" : "h-8 w-8")}
        >
            {/* eslint-disable-next-line react-hooks/static-components -- iconForNode returns a stable icon from a lookup table */}
            <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </span>
    );
}

interface TemplateGalleryProps {
    onUseTemplate: (id: string) => void;
}

export default function TemplateGallery({ onUseTemplate }: TemplateGalleryProps) {
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<TemplateCategory | "All">("All");
    const [openId, setOpenId] = useState<string | null>(null);

    const counts = useMemo(() => {
        const c = new Map<string, number>([["All", TEMPLATES.length]]);
        for (const t of TEMPLATES) c.set(t.category, (c.get(t.category) ?? 0) + 1);
        return c;
    }, []);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        return TEMPLATES.filter((t) => {
            if (category !== "All" && t.category !== category) return false;
            if (!q) return true;
            const hay = [t.name, t.description, t.category, t.prompt, ...t.graph.nodes.map((n) => `${n.label} ${n.provider ?? ""}`)].join(" ").toLowerCase();
            return q.split(/\s+/).every((word) => hay.includes(word));
        });
    }, [query, category]);

    const open = TEMPLATES.find((t) => t.id === openId) ?? null;
    const visibleCategories = CATEGORIES.filter((c) => counts.has(c));

    return (
        <div className="h-full overflow-y-auto bg-dots-fine">
            <div className="mx-auto max-w-6xl px-6 pb-20 pt-12 sm:px-10 sm:pt-14">
                {/* Header */}
                <motion.header
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="mb-8 max-w-2xl"
                >
                    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-volt ring-2 ring-volt/30" />
                        {TEMPLATES.length} ready-made workflows
                    </p>
                    <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                        Start from a <span className="highlight-volt">proven</span> pattern
                    </h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Pick one, tweak it in the editor, and run it. Each template opens as the exact graph you see here.
                    </p>
                </motion.header>

                {/* Search + categories */}
                <div className="sticky top-0 z-10 -mx-6 mb-6 border-b border-border/60 bg-card/95 px-6 pb-4 pt-3 backdrop-blur-md sm:-mx-10 sm:px-10">
                    <div className="relative max-w-md">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name, tool or goal…"
                            aria-label="Search templates"
                            className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-10 text-sm shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-4 focus:ring-foreground/5"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery("")}
                                aria-label="Clear search"
                                className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Template categories">
                        {(["All", ...visibleCategories] as const).map((c) => {
                            const active = category === c;
                            return (
                                <button
                                    key={c}
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setCategory(c)}
                                    className={cn(
                                        "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                                        active
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                                    )}
                                >
                                    {c}
                                    <span className={cn("rounded-full px-1.5 text-[11px]", active ? "bg-background/20" : "bg-muted")}>{counts.get(c)}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Grid */}
                {results.length === 0 ? (
                    <div className="mx-auto max-w-sm rounded-3xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
                        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                            <SearchX className="h-6 w-6 text-muted-foreground" />
                        </span>
                        <h2 className="text-base font-semibold">No templates match</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Try a different word, or describe it to Ask DevFlow and it will build one for you.</p>
                        <button
                            onClick={() => { setQuery(""); setCategory("All"); }}
                            className="mt-5 h-10 rounded-full bg-foreground px-5 text-sm font-semibold text-background"
                        >
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {results.map((t, i) => {
                            const tools = toolsOf(t);
                            return (
                                <motion.button
                                    key={t.id}
                                    layout
                                    initial={{ opacity: 0, y: 14 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    onClick={() => setOpenId(t.id)}
                                    className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card text-left shadow-card transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-foreground/20"
                                >
                                    <div className="relative h-44 bg-muted/50 bg-dots-fine">
                                        <GraphThumb graph={t.graph} />
                                        <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                                            {t.category}
                                        </span>
                                    </div>
                                    <div className="flex flex-1 flex-col p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <h2 className="font-display text-[17px] font-semibold leading-snug">{t.name}</h2>
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-volt group-hover:text-volt-foreground">
                                                <ArrowUpRight className="h-4 w-4" />
                                            </span>
                                        </div>
                                        <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted-foreground">{t.description}</p>
                                        <div className="mt-4 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                {tools.slice(0, 4).map((p) => <ToolDot key={p} provider={p} />)}
                                                {tools.length > 4 && <span className="ml-0.5 text-xs text-muted-foreground">+{tools.length - 4}</span>}
                                            </div>
                                            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.graph.nodes.length} nodes</span>
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Preview dialog */}
            <Dialog.Root open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                    <Dialog.Content
                        className="fixed left-1/2 top-1/2 z-[61] flex max-h-[88vh] w-[min(720px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                    >
                        {open && <PreviewBody template={open} onUse={() => { const id = open.id; setOpenId(null); onUseTemplate(id); }} />}
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}

function PreviewBody({ template: t, onUse }: { template: Template; onUse: () => void }) {
    const nameOf = (id: string) => t.graph.nodes.find((n) => n.id === id)?.label ?? id;
    const tools = toolsOf(t);

    return (
        <>
            <div className="relative h-56 shrink-0 bg-muted/50 bg-dots-fine">
                <GraphThumb graph={t.graph} />
                <Dialog.Close
                    aria-label="Close"
                    className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </Dialog.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-5 sm:px-8">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{t.category} · {t.graph.nodes.length} nodes</p>
                <Dialog.Title className="mt-1 font-display text-2xl font-semibold tracking-tight">{t.name}</Dialog.Title>
                <Dialog.Description className="mt-2 text-muted-foreground">{t.description}</Dialog.Description>

                {tools.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        {tools.map((p) => (
                            <span key={p} className="flex items-center gap-1.5 rounded-full bg-muted py-1 pl-1 pr-3 text-xs font-medium">
                                <ToolDot provider={p} size="sm" />
                                {prettyTool(p)}
                            </span>
                        ))}
                    </div>
                )}

                <h3 className="mb-3 mt-7 text-sm font-semibold">How it works</h3>
                <ol className="space-y-2">
                    {t.graph.nodes.map((n, i) => {
                        const kind = normalizeKind(n.type);
                        const style = nodeKindStyles[kind];
                        const Icon = iconForNode(n.label, kind, { provider: n.provider });
                        const branches = t.graph.edges.filter((e) => e.source === n.id && e.label);
                        return (
                            <li key={n.id} className="flex items-start gap-3 rounded-2xl border border-border/70 p-3">
                                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", style.chip)}>
                                    <Icon className="h-[18px] w-[18px]" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold leading-tight">
                                        <span className="mr-2 font-mono text-xs font-normal text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                                        {n.label}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{n.description || style.label}</p>
                                    {branches.length > 0 && (
                                        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                            {branches.map((b) => (
                                                <span key={b.target} className={b.label === "true" ? "text-emerald-700" : "text-muted-foreground"}>
                                                    <span className="font-semibold">{b.label === "true" ? "Yes" : "No"}</span> → {nameOf(b.target)}
                                                </span>
                                            ))}
                                        </p>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>

                <div className="my-6 flex items-start gap-3 rounded-2xl bg-muted/60 p-4">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        Want to change it? Open it and tell Ask DevFlow, e.g. <span className="text-foreground">&ldquo;{t.prompt}&rdquo;</span> or add your own twist.
                    </p>
                </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-card px-6 py-4 sm:px-8">
                <Dialog.Close className="h-11 rounded-full px-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                    Close
                </Dialog.Close>
                <button
                    onClick={onUse}
                    className="group flex h-11 items-center gap-2 rounded-full bg-foreground pl-6 pr-2 text-sm font-semibold text-background transition-transform hover:scale-[1.03] active:scale-95"
                >
                    Use this template
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-volt text-volt-foreground transition-transform group-hover:translate-x-0.5">
                        <ArrowRight className="h-4 w-4" />
                    </span>
                </button>
            </div>
        </>
    );
}
