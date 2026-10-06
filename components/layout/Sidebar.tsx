"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import {
    Zap,
    Play,
    GitBranch,
    Database,
    Search,
    Plus,
    PanelLeftClose,
    Clock,
    ChevronDown,
    Webhook,
    CalendarClock,
    FileInput,
    Hand,
    Mail,
    Globe,
    MessageSquare,
    Bell,
    Filter,
    Shuffle,
    Timer,
    SplitSquareVertical,
    HardDrive,
    FileJson,
    Table2,
    Upload,
    Sparkles,
    LucideIcon,
} from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { showToast } from "@/components/ui/Toast";
import { nodeKindStyles, type NodeKind } from "@/lib/node-visuals";

export type SidebarView = "home" | "workflows" | "nodes" | "templates" | "runs" | "settings";

interface SidebarProps {
    currentView?: SidebarView;
    /** Called after a node is tapped into the canvas (lets small screens close the sheet). */
    onNodeAdded?: () => void;
    /** Collapse the panel (desktop only). */
    onCollapse?: () => void;
    className?: string;
}

interface NodeItem {
    name: string;
    icon: LucideIcon;
    description: string;
    config?: Record<string, string | number | boolean>;
}

interface NodeCategory {
    type: string;
    kind: NodeKind;
    icon: LucideIcon;
    nodes: NodeItem[];
}

const nodeLibraryData: NodeCategory[] = [
    {
        type: "Trigger", kind: "trigger", icon: Zap,
        nodes: [
            { name: "Webhook", icon: Webhook, description: "HTTP webhook trigger", config: { source: "Webhook", method: "POST", path: "/hook", sample: '{"name":"Ada","email":"ada@example.com","amount":120}' } },
            { name: "Schedule", icon: CalendarClock, description: "Run on a schedule", config: { cron: "0 * * * *", timezone: "UTC" } },
            { name: "Form Submit", icon: FileInput, description: "On form submission", config: { formId: "", provider: "Typeform" } },
            { name: "Manual", icon: Hand, description: "Run manually", config: {} },
        ],
    },
    {
        type: "Action", kind: "action", icon: Play,
        nodes: [
            { name: "HTTP Request", icon: Globe, description: "Make an API call", config: { method: "GET", url: "https://api.github.com/zen" } },
            { name: "Send Email", icon: Mail, description: "Send email via SMTP", config: { provider: "Resend", apiKey: "{{secrets.RESEND_API_KEY}}", to: "", subject: "", text: "" } },
            { name: "Send Message", icon: MessageSquare, description: "Slack or Discord message", config: { platform: "Slack", webhookUrl: "", text: "New event: {{input.name}}" } },
            { name: "Notification", icon: Bell, description: "Push notification", config: { title: "", priority: "High" } },
            { name: "AI Prompt", icon: Sparkles, description: "LLM text generation", config: { prompt: "Summarize this in one sentence: {{input}}" } },
        ],
    },
    {
        type: "Logic", kind: "logic", icon: GitBranch,
        nodes: [
            { name: "If/Else", icon: SplitSquareVertical, description: "Conditional branching", config: { condition: "{{input.amount}} > 100" } },
            { name: "Filter", icon: Filter, description: "Filter items by condition", config: { field: "", operator: "equals", value: "" } },
            { name: "Switch", icon: Shuffle, description: "Multi-way branching", config: { value: "{{input.status}}", cases: "urgent, normal, low" } },
            { name: "Delay", icon: Timer, description: "Wait before continuing", config: { duration_ms: 1000 } },
        ],
    },
    {
        type: "Data", kind: "data", icon: Database,
        nodes: [
            { name: "Database Query", icon: HardDrive, description: "Run a SQL query", config: { provider: "Postgres", connection: "{{secrets.POSTGRES_URL}}", query: "SELECT * FROM users LIMIT 10", allowWrites: "false" } },
            { name: "JSON Transform", icon: FileJson, description: "Parse or reshape JSON", config: { mapping: "{}" } },
            { name: "Spreadsheet", icon: Table2, description: "Read or write sheets", config: { sheetId: "", range: "A1:Z" } },
            { name: "File Upload", icon: Upload, description: "Upload to storage", config: { bucket: "uploads", path: "/" } },
        ],
    },
];

const PANEL_TITLES: Record<SidebarView, { title: string; hint: string }> = {
    home: { title: "Node library", hint: "Drag a node onto the canvas, or tap to add" },
    nodes: { title: "Node library", hint: "Drag a node onto the canvas, or tap to add" },
    workflows: { title: "Your workflows", hint: "Pick up where you left off" },
    templates: { title: "Templates", hint: "Start from a proven pattern" }, // shown as a full page, not in this panel
    runs: { title: "Runs", hint: "What ran, and what happened" }, // full page
    settings: { title: "Settings", hint: "Make DevFlow yours" },
};

/** Contextual left panel. Navigation lives in <TopNav />. */
export default function Sidebar({ currentView = "home", onNodeAdded, onCollapse, className }: SidebarProps) {
    const meta = PANEL_TITLES[currentView];

    return (
        <aside className={cn("flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-card", className)}>
            <div className="flex shrink-0 items-start justify-between gap-2 px-5 pb-3 pt-5">
                <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{meta.title}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{meta.hint}</p>
                </div>
                {onCollapse && (
                    <button
                        onClick={onCollapse}
                        aria-label="Collapse panel"
                        title="Collapse panel"
                        className="-mr-1.5 -mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
                    >
                        <PanelLeftClose className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4">
                {(currentView === "home" || currentView === "nodes") && <NodeLibraryPanel onNodeAdded={onNodeAdded} />}

            </div>
        </aside>
    );
}

// ── Node Library Panel ───────────────────────────────────────────────
const KIND_BLURB: Record<NodeKind, string> = {
    trigger: "Starts the workflow",
    action: "Does something",
    logic: "Decides which way to go",
    data: "Reads or writes data",
};
const FILTERS: { value: "all" | NodeKind; label: string }[] = [
    { value: "all", label: "All" },
    { value: "trigger", label: "Triggers" },
    { value: "action", label: "Actions" },
    { value: "logic", label: "Logic" },
    { value: "data", label: "Data" },
];
const RECENT_KEY = "devflow-recent-nodes";

function NodeLibraryPanel({ onNodeAdded }: { onNodeAdded?: () => void }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<"all" | NodeKind>("all");
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [recent, setRecent] = useState<string[]>([]);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
            // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after mount, so this can't be a lazy initial state
            if (Array.isArray(saved)) setRecent(saved.filter((x) => typeof x === "string").slice(0, 4));
        } catch { /* storage unavailable */ }
    }, []);

    const remember = (name: string) => {
        setRecent((prev) => {
            const next = [name, ...prev.filter((n) => n !== name)].slice(0, 4);
            try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    };

    const payload = (kind: NodeKind, node: NodeItem) => ({
        type: kind,
        label: node.name,
        description: node.description,
        config: node.config || {},
    });

    const onDragStart = (event: React.DragEvent, kind: NodeKind, node: NodeItem) => {
        event.dataTransfer.setData("application/reactflow", JSON.stringify(payload(kind, node)));
        event.dataTransfer.effectAllowed = "move";
        remember(node.name);
    };

    // Drag-and-drop doesn't work on touch screens, so tapping (or pressing Enter) also adds the node
    const addToCanvas = (kind: NodeKind, node: NodeItem) => {
        window.dispatchEvent(new CustomEvent("devflow:add-node", { detail: payload(kind, node) }));
        remember(node.name);
        showToast(`Added ${node.name}`, "success");
        onNodeAdded?.();
    };

    const toggle = (type: string) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });

    const searching = searchQuery.trim().length > 0;

    const categories = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return nodeLibraryData
            .filter((cat) => filter === "all" || cat.kind === filter)
            .map((cat) => ({
                ...cat,
                nodes: cat.nodes.filter((n) => !q || n.name.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)),
            }))
            .filter((cat) => cat.nodes.length > 0);
    }, [searchQuery, filter]);

    const recentItems = useMemo(() => {
        const all = nodeLibraryData.flatMap((cat) => cat.nodes.map((node) => ({ kind: cat.kind, node })));
        return recent.map((name) => all.find((x) => x.node.name === name)).filter((x): x is { kind: NodeKind; node: NodeItem } => !!x);
    }, [recent]);

    const total = categories.reduce((sum, c) => sum + c.nodes.length, 0);

    const row = (kind: NodeKind, node: NodeItem) => {
        const style = nodeKindStyles[kind];
        const settings = Object.keys(node.config || {});
        return (
            <Tooltip.Root key={`${kind}-${node.name}`}>
                <Tooltip.Trigger asChild>
                    <div
                        role="button"
                        tabIndex={0}
                        draggable
                        onDragStart={(e) => onDragStart(e, kind, node)}
                        onClick={() => addToCanvas(kind, node)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                addToCanvas(kind, node);
                            }
                        }}
                        aria-label={`Add ${node.name} node: ${node.description}`}
                        className="group flex cursor-grab items-center gap-3 rounded-2xl border border-transparent p-2 outline-none transition-all hover:border-border hover:bg-muted/50 hover:shadow-sm focus-visible:border-foreground/30 focus-visible:bg-muted/50 active:cursor-grabbing"
                    >
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", style.chip)}>
                            <node.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium leading-tight text-foreground">{node.name}</p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{node.description}</p>
                        </div>
                        <Plus className="h-4 w-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/70 group-focus-visible:text-muted-foreground/70 max-lg:text-muted-foreground/50" />
                    </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        side="right"
                        align="start"
                        sideOffset={12}
                        className="z-[70] w-60 rounded-2xl bg-foreground p-3.5 text-background shadow-2xl max-lg:hidden"
                    >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-background/60">{style.label} · {KIND_BLURB[kind]}</p>
                        <p className="mt-1 text-sm font-semibold">{node.name}</p>
                        <p className="mt-1 text-xs leading-relaxed text-background/80">{node.description}</p>
                        {settings.length > 0 && (
                            <p className="mt-2.5 border-t border-background/15 pt-2.5 font-mono text-[11px] text-background/70">
                                Settings: {settings.join(", ")}
                            </p>
                        )}
                        <p className="mt-2.5 text-[11px] text-volt">Drag onto the canvas, or click to add</p>
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        );
    };

    return (
        <Tooltip.Provider delayDuration={450} skipDelayDuration={150}>
            <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search nodes…"
                    aria-label="Search nodes"
                    className="h-11 w-full rounded-full bg-muted pl-10 pr-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/15"
                />
            </div>

            <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Filter by type">
                {FILTERS.map((f) => (
                    <button
                        key={f.value}
                        role="tab"
                        aria-selected={filter === f.value}
                        onClick={() => setFilter(f.value)}
                        className={cn(
                            "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            filter === f.value
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Recently used */}
            {!searching && filter === "all" && recentItems.length > 0 && (
                <section className="mb-5">
                    <h3 className="mb-1.5 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Recently used
                    </h3>
                    <div className="space-y-1">{recentItems.map((x) => row(x.kind, x.node))}</div>
                </section>
            )}

            {total === 0 ? (
                <div className="py-8 text-center">
                    <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">No nodes match &ldquo;{searchQuery}&rdquo;</p>
                    <button onClick={() => { setSearchQuery(""); setFilter("all"); }} className="mt-3 text-xs font-medium text-foreground underline underline-offset-4">Clear filters</button>
                </div>
            ) : (
                <div className="space-y-4">
                    {categories.map((category) => {
                        const style = nodeKindStyles[category.kind];
                        const isCollapsed = collapsed.has(category.type) && !searching;
                        return (
                            <section key={category.type}>
                                <button
                                    onClick={() => toggle(category.type)}
                                    aria-expanded={!isCollapsed}
                                    className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
                                >
                                    <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                                    {category.type}s
                                    <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium normal-case tracking-normal">{category.nodes.length}</span>
                                    <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", isCollapsed && "-rotate-90")} />
                                </button>
                                {!isCollapsed && <div className="space-y-1">{category.nodes.map((node) => row(category.kind, node))}</div>}
                            </section>
                        );
                    })}
                </div>
            )}
        </Tooltip.Provider>
    );
}
