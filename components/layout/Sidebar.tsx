"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import {
    Home,
    Workflow,
    Settings,
    Box,
    Zap,
    Play,
    GitBranch,
    Database,
    Search,
    Trash2,
    Loader2,
    Plus,
    Blocks,
    Clock,
    MoreVertical,
    ChevronDown,
    ChevronRight,
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
    Palette,
    Moon,
    Sun,
    Monitor,
    Info,
    LucideIcon,
    ArrowRight,
    Layers,
    Rocket,
    Activity,
    TrendingUp,
    ArrowUpRight,
    BarChart3,
} from "lucide-react";
import { showToast } from "@/components/ui/Toast";

export type SidebarView = "home" | "workflows" | "nodes" | "templates" | "settings";

interface SavedWorkflow {
    id: string;
    name: string;
    description: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    nodes_json?: any[];
    edges_json?: any[];
}

interface SidebarProps {
    activeWorkflowId?: string | null;
    refreshKey?: number;
    currentView?: SidebarView;
    onLoadWorkflow?: (id: string) => void;
    onNewWorkflow?: () => void;
    onWorkflowDeleted?: (id: string) => void;
    onLoadTemplate?: (template: { name: string; nodes: any[]; edges: any[] }) => void;
    onUseTemplate?: (prompt: string) => void;
    onViewChange?: (view: SidebarView) => void;
}

interface NodeItem {
    name: string;
    icon: LucideIcon;
    description: string;
    config?: Record<string, string | number | boolean>;
}

interface NodeCategory {
    type: string;
    icon: LucideIcon;
    color: string;
    nodes: NodeItem[];
}

const nodeLibraryData: NodeCategory[] = [
    {
        type: "Trigger", icon: Zap, color: "text-blue-500",
        nodes: [
            { name: "Webhook", icon: Webhook, description: "HTTP webhook trigger", config: { source: "Webhook", method: "POST", path: "/hook" } },
            { name: "Schedule", icon: CalendarClock, description: "Cron/interval trigger", config: { cron: "0 * * * *", timezone: "UTC" } },
            { name: "Form Submit", icon: FileInput, description: "On form submission", config: { formId: "", provider: "Typeform" } },
            { name: "Manual", icon: Hand, description: "Manual trigger", config: {} },
        ],
    },
    {
        type: "Action", icon: Play, color: "text-teal-500",
        nodes: [
            { name: "HTTP Request", icon: Globe, description: "Make API calls", config: { method: "GET", url: "https://api.example.com" } },
            { name: "Send Email", icon: Mail, description: "Send email via SMTP", config: { to: "", subject: "", provider: "Resend" } },
            { name: "Send Message", icon: MessageSquare, description: "Slack/Discord message", config: { channel: "", platform: "Slack" } },
            { name: "Notification", icon: Bell, description: "Push notification", config: { title: "", priority: "High" } },
            { name: "AI Prompt", icon: Sparkles, description: "LLM text generation", config: { model: "llama3-8b-8192", temperature: 0.7 } },
        ],
    },
    {
        type: "Logic", icon: GitBranch, color: "text-amber-500",
        nodes: [
            { name: "If/Else", icon: SplitSquareVertical, description: "Conditional branching", config: { condition: "payload.amount > 100" } },
            { name: "Filter", icon: Filter, description: "Filter items by condition", config: { field: "", operator: "equals", value: "" } },
            { name: "Switch", icon: Shuffle, description: "Multi-way branching", config: { key: "status" } },
            { name: "Delay", icon: Timer, description: "Wait before continuing", config: { duration_ms: 1000 } },
        ],
    },
    {
        type: "Data", icon: Database, color: "text-purple-500",
        nodes: [
            { name: "Database Query", icon: HardDrive, description: "SQL query execution", config: { table: "users", action: "SELECT" } },
            { name: "JSON Transform", icon: FileJson, description: "Parse/transform JSON", config: { mapping: "{}" } },
            { name: "Spreadsheet", icon: Table2, description: "Read/write sheets", config: { sheetId: "", range: "A1:Z" } },
            { name: "File Upload", icon: Upload, description: "Upload to storage", config: { bucket: "uploads", path: "/" } },
        ],
    },
];

function timeAgo(dateStr: string) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

import { signIn, signOut, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

// ... Inside Sidebar function
export default function Sidebar({ activeWorkflowId, refreshKey, currentView: externalView, onLoadWorkflow, onNewWorkflow, onWorkflowDeleted, onLoadTemplate, onUseTemplate, onViewChange }: SidebarProps) {
    const [activeView, setActiveView] = useState<SidebarView>("home");
    const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { data: session, isPending } = useSession();
    const router = useRouter();

    // Sync sidebar view when parent tells us to switch
    useEffect(() => {
        if (externalView && externalView !== activeView) {
            setActiveView(externalView);
        }
    }, [externalView]);

    const navItems = [
        { icon: Home, label: "Home", view: "home" as SidebarView },
        { icon: Workflow, label: "Workflows", view: "workflows" as SidebarView },
        { icon: Blocks, label: "Nodes", view: "nodes" as SidebarView },
        { icon: Box, label: "Templates", view: "templates" as SidebarView },
        { icon: Settings, label: "Settings", view: "settings" as SidebarView },
    ];

    // Fetch saved workflows when Workflows panel is active
    useEffect(() => {
        if (activeView === "workflows") {
            fetchWorkflows();
        }
    }, [activeView, refreshKey]);

    // Notify parent of view changes
    const handleViewChange = (view: SidebarView) => {
        setActiveView(view);
        onViewChange?.(view);
    };

    const fetchWorkflows = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/workflows");
            if (res.ok) {
                const data = await res.json();
                setSavedWorkflows(data.workflows || []);
            } else if (res.status === 401) {
                // If unauthorized, show nothing or prompt to login
                setSavedWorkflows([]);
            }
        } catch (error) {
            console.error("Failed to fetch workflows:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeletingId(id);
        try {
            const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
            if (res.ok) {
                setSavedWorkflows((prev) => prev.filter((w) => w.id !== id));
                onWorkflowDeleted?.(id);
                showToast("Workflow deleted", "error");
            } else {
                showToast("Failed to delete workflow", "error");
            }
        } catch {
            showToast("Something went wrong", "error");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="flex h-full w-[240px] flex-col border-r border-border bg-card">
            {/* Logo Area */}
            <div className="flex h-14 items-center gap-2 px-4 border-b border-border shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Workflow className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold text-foreground">DevFlow</span>
            </div>

            {/* Main Nav */}
            <div className="flex-1 overflow-y-auto py-4">
                <nav className="space-y-1 px-2">
                    {navItems.map((item) => (
                        <button
                            key={item.label}
                            onClick={() => handleViewChange(item.view)}
                            className={cn(
                                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                                activeView === item.view ? "bg-muted text-foreground" : "text-muted-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Dynamic Panel Content */}
                <div className="mt-6 px-4 pb-4">
                    {activeView === "workflows" && (
                        <WorkflowsPanel
                            workflows={savedWorkflows}
                            isLoading={isLoading}
                            activeWorkflowId={activeWorkflowId}
                            deletingId={deletingId}
                            onLoad={(id) => onLoadWorkflow?.(id)}
                            onDelete={handleDelete}
                            onNew={() => {
                                if (!session) {
                                    showToast("Please sign in to save workflows", "error");
                                    router.push("/login");
                                    return;
                                }
                                onNewWorkflow?.();
                            }}
                            onRefresh={fetchWorkflows}
                        />
                    )}

                    {(activeView === "home" || activeView === "nodes") && (
                        <NodeLibraryPanel />
                    )}

                    {activeView === "templates" && (
                        <TemplatesPanel onUseTemplate={(prompt) => onUseTemplate?.(prompt)} />
                    )}

                    {activeView === "settings" && (
                        <SettingsPanel />
                    )}
                </div>
            </div>

            {/* User Footer */}
            <div className="border-t border-border p-4 shrink-0 bg-card">
                {isPending ? (
                    <div className="flex items-center justify-center py-2 relative h-full">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                ) : session ? (
                    <div className="flex flex-col gap-3 relative h-full group">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold relative h-full">
                                {session.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-foreground truncate">{session.user.name}</span>
                                <span className="text-xs text-muted-foreground truncate">{session.user.email}</span>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                await signOut();
                                router.refresh();
                            }}
                            className="w-full text-xs font-medium text-muted-foreground hover:text-red-400 py-1.5 px-2 rounded-md hover:bg-red-500/10 transition-colors text-left relative h-full"
                        >
                            Sign Out
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2.5 relative h-full">
                        <p className="text-xs text-muted-foreground mb-1">Sign in to sync your workflows to the cloud</p>
                        <button
                            onClick={() => router.push("/login")}
                            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors relative h-full"
                        >
                            Sign In / Register
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Workflows Panel ──────────────────────────────────────────────────
function WorkflowsPanel({
    workflows,
    isLoading,
    activeWorkflowId,
    deletingId,
    onLoad,
    onDelete,
    onNew,
    onRefresh,
}: {
    workflows: SavedWorkflow[];
    isLoading: boolean;
    activeWorkflowId?: string | null;
    deletingId: string | null;
    onLoad: (id: string) => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
    onNew: () => void;
    onRefresh: () => void;
}) {
    return (
        <>
            <div className="flex items-center justify-between mb-3">
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Saved Workflows
                </h3>
                <button
                    onClick={onNew}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="New workflow"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            ) : workflows.length === 0 ? (
                <div className="text-center py-8">
                    <Workflow className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-xs text-muted-foreground">No saved workflows yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Generate one and hit Save</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {workflows.map((wf) => (
                        <div
                            key={wf.id}
                            onClick={() => onLoad(wf.id)}
                            className={cn(
                                "group flex items-center justify-between rounded-lg px-3 py-2.5 cursor-pointer transition-all",
                                activeWorkflowId === wf.id
                                    ? "bg-primary/10 border border-primary/20"
                                    : "hover:bg-muted border border-transparent"
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <p className={cn(
                                    "text-sm font-medium truncate",
                                    activeWorkflowId === wf.id ? "text-primary" : "text-foreground"
                                )}>
                                    {wf.name}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <Clock className="h-3 w-3 text-muted-foreground/70" />
                                    <span className="text-[11px] text-muted-foreground/70">
                                        {timeAgo(wf.updated_at)}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={(e) => onDelete(e, wf.id)}
                                disabled={deletingId === wf.id}
                                className={cn(
                                    "flex h-6 w-6 items-center justify-center rounded-md transition-all shrink-0 ml-2",
                                    deletingId === wf.id
                                        ? "opacity-100"
                                        : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                )}
                            >
                                {deletingId === wf.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Trash2 className="h-3 w-3" />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Visible New Workflow button */}
            <button
                onClick={onNew}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
            >
                <Plus className="h-4 w-4" />
                New Workflow
            </button>
        </>
    );
}



// ── Node Library Panel ───────────────────────────────────────────────
function NodeLibraryPanel() {
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(nodeLibraryData.map(c => c.type)));

    const onDragStart = (event: React.DragEvent, nodeType: string, nodeName: string, configData: any = {}) => {
        // Set the node data as a JSON string
        event.dataTransfer.setData('application/reactflow', JSON.stringify({
            type: nodeType,
            label: nodeName,
            config: configData
        }));
        event.dataTransfer.effectAllowed = 'move';
    };

    const toggleCategory = (type: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    };

    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) return nodeLibraryData;
        const q = searchQuery.toLowerCase();
        return nodeLibraryData
            .map((cat) => ({
                ...cat,
                nodes: cat.nodes.filter(
                    (n) => n.name.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)
                ),
            }))
            .filter((cat) => cat.nodes.length > 0);
    }, [searchQuery]);

    return (
        <>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Node Library
            </h3>
            <div className="relative mb-3">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search nodes..."
                    className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs focus:border-primary focus:outline-none transition-colors"
                />
            </div>
            <div className="space-y-0.5">
                {filteredCategories.length === 0 ? (
                    <div className="text-center py-6">
                        <Search className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-xs text-muted-foreground">No nodes match &ldquo;{searchQuery}&rdquo;</p>
                    </div>
                ) : (
                    filteredCategories.map((category) => {
                        const isExpanded = expandedCategories.has(category.type) || searchQuery.trim().length > 0;
                        return (
                            <div key={category.type}>
                                <button
                                    onClick={() => toggleCategory(category.type)}
                                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
                                >
                                    <div className="flex items-center gap-2">
                                        {isExpanded ? (
                                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        ) : (
                                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                        )}
                                        <category.icon className={cn("h-3.5 w-3.5", category.color)} />
                                        <span className="text-sm font-medium text-foreground">{category.type}</span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">{category.nodes.length}</span>
                                </button>
                                {isExpanded && (
                                    <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border/50 pl-3">
                                        {category.nodes.map((node) => (
                                            <div
                                                key={node.name}
                                                draggable
                                                onDragStart={(e) => onDragStart(e, category.type.toLowerCase(), node.name, node.config || {})}
                                                className="group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing transition-colors hover:bg-muted/60"
                                                title={node.description}
                                            >
                                                <node.icon className={cn("h-3 w-3 shrink-0", category.color)} />
                                                <span className="text-xs text-foreground truncate">{node.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
}

// ── Templates Panel ──────────────────────────────────────────────────
const starterTemplates = [
    {
        name: "Lead Enrichment Pipeline",
        description: "Capture leads, enrich with company data, route to CRM",
        icon: Sparkles,
        color: "text-blue-500",
        nodeCount: "5-8",
        prompt: "Create a lead enrichment pipeline: webhook trigger receives new leads, enrich with company data from Clearbit, check company size, route enterprise leads to Slack sales channel, add SMB leads to nurture sequence",
    },
    {
        name: "Data Sync Workflow",
        description: "Sync data between databases on a schedule",
        icon: Layers,
        color: "text-purple-500",
        nodeCount: "3-5",
        prompt: "Create a data sync workflow: scheduled trigger every hour, query source PostgreSQL database for updated records, transform data format, upsert into destination MongoDB",
    },
    {
        name: "Alert Pipeline",
        description: "Monitor metrics and alert on anomalies",
        icon: Bell,
        color: "text-amber-500",
        nodeCount: "4-6",
        prompt: "Create an alert pipeline: scheduled trigger every 5 minutes, fetch metrics from monitoring API, check if any metric exceeds threshold, send Slack alert with details for anomalies",
    },
    {
        name: "Content Pipeline",
        description: "Generate and publish content with AI",
        icon: Rocket,
        color: "text-teal-500",
        nodeCount: "5-10",
        prompt: "Create a content pipeline: manual trigger, fetch trending topics from RSS feed, generate blog post draft with AI, review content for quality, publish to WordPress CMS",
    },
];

function TemplatesPanel({ onUseTemplate }: { onUseTemplate?: (prompt: string) => void }) {
    const handleUseTemplate = (template: typeof starterTemplates[0]) => {
        if (onUseTemplate) {
            onUseTemplate(template.prompt);
            showToast(`Generating "${template.name}"...`, "success");
        } else {
            showToast("Template loaded! Describe it in the chat to generate.", "success");
        }
    };

    return (
        <>
            <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Starter Templates
            </h3>
            <div className="space-y-2">
                {starterTemplates.map((t) => (
                    <button
                        key={t.name}
                        onClick={() => handleUseTemplate(t)}
                        className="group w-full text-left rounded-lg border border-border/50 p-3 transition-all hover:border-primary/30 hover:bg-primary/5"
                    >
                        <div className="flex items-start gap-2.5">
                            <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted", t.color)}>
                                <t.icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                    {t.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                    {t.description}
                                </p>
                                <div className="flex items-center gap-1 mt-1.5">
                                    <Workflow className="h-3 w-3 text-muted-foreground/60" />
                                    <span className="text-[10px] text-muted-foreground/60">{t.nodeCount} nodes</span>
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </>
    );
}

// ── Settings Panel ───────────────────────────────────────────────────
type ThemeOption = "dark" | "light" | "system";

function SettingsPanel() {
    const [theme, setTheme] = useState<ThemeOption>(() => {
        if (typeof window !== "undefined") {
            return (localStorage.getItem("devflow-theme") as ThemeOption) || "system";
        }
        return "system";
    });

    const handleThemeChange = (newTheme: ThemeOption) => {
        setTheme(newTheme);
        localStorage.setItem("devflow-theme", newTheme);
        if (newTheme === "dark" || (newTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
            document.documentElement.classList.add("dark");
            document.documentElement.classList.remove("light");
        } else {
            document.documentElement.classList.remove("dark");
            document.documentElement.classList.add("light");
        }
        showToast(`Theme set to ${newTheme}`, "success");
    };

    const themeOptions: { value: ThemeOption; label: string; icon: LucideIcon }[] = [
        { value: "dark", label: "Dark", icon: Moon },
        { value: "light", label: "Light", icon: Sun },
        { value: "system", label: "System", icon: Monitor },
    ];

    return (
        <>
            <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Settings
            </h3>

            {/* Theme */}
            <div className="mb-5">
                <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                    Appearance
                </p>
                <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-border p-1.5">
                    {themeOptions.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handleThemeChange(opt.value)}
                            className={cn(
                                "flex flex-col items-center gap-1 rounded-md py-2 text-[11px] font-medium transition-all",
                                theme === opt.value
                                    ? "bg-primary/10 text-primary border border-primary/30"
                                    : "text-muted-foreground hover:bg-muted border border-transparent"
                            )}
                        >
                            <opt.icon className="h-3.5 w-3.5" />
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* About */}
            <div>
                <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    About
                </p>
                <div className="space-y-2 text-[11px] text-muted-foreground rounded-lg border border-border p-3">
                    <div className="flex justify-between">
                        <span>Version</span>
                        <span className="font-mono text-foreground/70">0.1.0-beta</span>
                    </div>
                    <div className="flex justify-between">
                        <span>AI Engine</span>
                        <span className="font-mono text-foreground/70">Groq Llama 3</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Database</span>
                        <span className="font-mono text-foreground/70">Neon PostgreSQL</span>
                    </div>
                </div>
            </div>
        </>
    );
}

