"use client";

import { useState, useEffect } from "react";
import {
    Workflow,
    Sparkles,
    Plus,
    Loader2,
    ArrowUpRight,
    Activity,
    Clock,
    Zap,
    Layers,
    Bell,
    Rocket,
    Box,
    Search,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/Toast";

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

const starterTemplates = [
    {
        name: "Lead Enrichment Pipeline",
        description: "Capture leads, enrich with company data, route to CRM",
        icon: Sparkles,
        gradient: "from-blue-500/20 to-cyan-500/20",
        border: "group-hover:border-blue-500/50",
        iconColor: "text-blue-500",
        iconBg: "bg-blue-500/10",
        nodeCount: "5-8",
        prompt: "Create a lead enrichment pipeline: webhook trigger receives new leads, enrich with company data from Clearbit, check company size, route enterprise leads to Slack sales channel, add SMB leads to nurture sequence",
    },
    {
        name: "Data Sync Workflow",
        description: "Sync data between databases on a schedule",
        icon: Layers,
        gradient: "from-violet-500/20 to-purple-500/20",
        border: "group-hover:border-purple-500/50",
        iconColor: "text-purple-500",
        iconBg: "bg-purple-500/10",
        nodeCount: "3-5",
        prompt: "Create a data sync workflow: scheduled trigger every hour, query source PostgreSQL database for updated records, transform data format, upsert into destination MongoDB",
    },
    {
        name: "Alert Pipeline",
        description: "Monitor metrics and alert on anomalies",
        icon: Bell,
        gradient: "from-amber-500/20 to-orange-500/20",
        border: "group-hover:border-amber-500/50",
        iconColor: "text-amber-500",
        iconBg: "bg-amber-500/10",
        nodeCount: "4-6",
        prompt: "Create an alert pipeline: scheduled trigger every 5 minutes, fetch metrics from monitoring API, check if any metric exceeds threshold, send Slack alert with details for anomalies",
    },
    {
        name: "Content Pipeline",
        description: "Generate and publish content with AI",
        icon: Rocket,
        gradient: "from-emerald-500/20 to-teal-500/20",
        border: "group-hover:border-emerald-500/50",
        iconColor: "text-emerald-500",
        iconBg: "bg-emerald-500/10",
        nodeCount: "5-10",
        prompt: "Create a content pipeline: manual trigger, fetch trending topics from RSS feed, generate blog post draft with AI, review content for quality, publish to WordPress CMS",
    },
];

function timeAgo(dateString: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

interface HomeDashboardProps {
    onLoadWorkflow: (id: string) => void;
    onNewWorkflow: () => void;
    onUseTemplate: (prompt: string) => void;
    onViewAllTemplates?: () => void;
    refreshKey?: number;
}

export default function HomeDashboard({ onLoadWorkflow, onNewWorkflow, onUseTemplate, onViewAllTemplates, refreshKey }: HomeDashboardProps) {
    const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchWorkflows();
    }, [refreshKey]);

    const fetchWorkflows = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/workflows");
            if (res.ok) {
                const data = await res.json();
                setWorkflows(data.workflows || []);
            }
        } catch (error) {
            console.error("Failed to fetch workflows:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const totalNodes = workflows.reduce((sum, w) => {
        const nodes = w.nodes_json || [];
        return sum + (Array.isArray(nodes) ? nodes.length : 0);
    }, 0);

    const recentWorkflows = workflows.slice(0, 5);

    return (
        <div className="h-full overflow-y-auto bg-background/50">
            <div className="px-8 py-12 max-w-[1600px] mx-auto">

                {/* ── Welcome Hero ─────────────────────────────── */}
                <div className="relative mb-16">
                    {/* Background Glow */}
                    <div className="absolute -top-24 -left-20 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-30 pointer-events-none" />

                    <div className="relative z-10">

                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div>
                                <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight leading-tight">
                                    Build workflows <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">at the speed of thought.</span>
                                </h1>
                                <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                                    Design, automate, and deploy AI agents with natural language.
                                    Start from a template or just ask for what you need.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={onNewWorkflow}
                                    className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-all hover:scale-105 shadow-lg shadow-primary/25"
                                >
                                    <Plus className="h-5 w-5" />
                                    New Workflow
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Stats Overview ─────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                    <div className="group relative rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm p-6 overflow-hidden hover:border-border/80 transition-all">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Total Workflows</p>
                                <p className="text-4xl font-bold text-foreground tracking-tight">{isLoading ? "—" : workflows.length}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <Workflow className="h-5 w-5 text-blue-500" />
                            </div>
                        </div>
                    </div>

                    <div className="group relative rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm p-6 overflow-hidden hover:border-border/80 transition-all">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Active Nodes</p>
                                <p className="text-4xl font-bold text-foreground tracking-tight">{isLoading ? "—" : totalNodes}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <Box className="h-5 w-5 text-emerald-500" />
                            </div>
                        </div>
                    </div>

                    <div className="group relative rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm p-6 overflow-hidden hover:border-border/80 transition-all">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Latest Activity</p>
                                <p className="text-4xl font-bold text-foreground tracking-tight">
                                    {isLoading ? "—" : workflows.length > 0 ? timeAgo(workflows[0].updated_at).replace(" ago", "") : "—"}
                                </p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                                <Activity className="h-5 w-5 text-amber-500" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Start Building Section ────────────────────── */}
                <div className="mb-16">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-foreground tracking-tight">Start Building</h2>
                        <button
                            onClick={() => onViewAllTemplates?.()}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                            View all templates <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {starterTemplates.map((t) => (
                            <button
                                key={t.name}
                                onClick={() => {
                                    onUseTemplate(t.prompt);
                                    showToast(`Generating "${t.name}"...`, "success");
                                }}
                                className={cn(
                                    "group relative text-left rounded-2xl border border-border/60 bg-card/40 p-5 transition-all duration-300",
                                    "hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:bg-card/60",
                                    t.border
                                )}
                            >
                                <div className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", t.gradient)} />

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={cn(
                                            "flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 transition-colors",
                                            t.iconBg
                                        )}>
                                            <t.icon className={cn("h-5 w-5", t.iconColor)} />
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                            <div className="bg-background/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm border border-border/50">
                                                <ArrowUpRight className="h-3.5 w-3.5 text-foreground/70" />
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{t.name}</h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-grow">{t.description}</p>

                                    <div className="flex items-center gap-2 pt-4 border-t border-border/30">
                                        <span className="text-xs text-muted-foreground font-medium">{t.nodeCount} nodes</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Workflows Table ──────────────────────────── */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-foreground tracking-tight">Recent Workflows</h2>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : recentWorkflows.length === 0 ? (
                        <div className="text-center py-20 rounded-2xl border border-dashed border-border/60 bg-card/20">
                            <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Workflow className="h-8 w-8 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground mb-2">No workflows yet</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                                Create your first workflow using natural language or customize one of the templates above.
                            </p>
                            <button
                                onClick={onNewWorkflow}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all shadow-md hover:shadow-lg hover:shadow-primary/20"
                            >
                                <Plus className="h-4 w-4" />
                                Create Workflow
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {recentWorkflows.map((wf) => (
                                <button
                                    key={wf.id}
                                    onClick={() => onLoadWorkflow(wf.id)}
                                    className="group flex items-center justify-between p-4 rounded-xl border border-border/40 bg-card/40 hover:bg-card/80 hover:border-primary/20 transition-all hover:shadow-md hover:shadow-primary/5"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-muted to-muted/50 border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                                            <Workflow className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">{wf.name}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Edited {timeAgo(wf.updated_at)}
                                                </span>
                                                <span className="h-1 w-1 rounded-full bg-border" />
                                                <span className="flex items-center gap-1">
                                                    {Array.isArray(wf.nodes_json) ? wf.nodes_json.length : 0} nodes
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-medium text-green-500 hidden sm:block">
                                            Active
                                        </div>
                                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/30 group-hover:text-foreground group-hover:bg-muted transition-all">
                                            <ChevronRight className="h-5 w-5" />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
