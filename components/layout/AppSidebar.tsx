"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Workflow, Box, History, Settings, Plus, LogOut, PanelLeftClose, PanelLeftOpen, ChevronsUpDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/ui/logo";
import { signOut, useSession } from "@/lib/auth-client";
import type { SidebarView } from "@/components/layout/Sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV: { icon: LucideIcon; label: string; view: SidebarView }[] = [
    { icon: Home, label: "Home", view: "home" },
    { icon: Workflow, label: "Workflows", view: "workflows" },
    { icon: Box, label: "Templates", view: "templates" },
    { icon: History, label: "Runs", view: "runs" },
];

interface RecentWorkflow {
    id: string;
    name: string;
}

interface AppSidebarProps {
    currentView: SidebarView;
    activeWorkflowId: string | null;
    onViewChange: (view: SidebarView) => void;
    onNewWorkflow: () => void;
    onOpenWorkflow: (id: string) => void;
    /** Bumps when workflows are created, renamed or deleted so Recent stays fresh. */
    refreshKey: number;
}

const STORAGE_KEY = "devflow-nav-collapsed";

export default function AppSidebar({ currentView, activeWorkflowId, onViewChange, onNewWorkflow, onOpenWorkflow, refreshKey }: AppSidebarProps) {
    const { data: session } = useSession();
    const router = useRouter();
    // null = follow the view: expanded on full pages, a slim rail in the editor (which has its own panels)
    const [pinned, setPinned] = useState<boolean | null>(null);
    const [recent, setRecent] = useState<RecentWorkflow[]>([]);
    // On mid-size screens the editor needs every pixel (node library + canvas + chat), so the sidebar stays a slim rail there
    const [narrow, setNarrow] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 1535px)");
        const update = () => setNarrow(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        try {
            const v = localStorage.getItem(STORAGE_KEY);
            // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved preference after mount (localStorage is browser-only)
            if (v === "1") setPinned(true);
            else if (v === "0") setPinned(false);
        } catch { /* storage unavailable */ }
    }, []);

    useEffect(() => {
        let live = true;
        fetch("/api/workflows")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => live && setRecent((d.workflows ?? []).slice(0, 5).map((w: any) => ({ id: w.id, name: w.name || "Untitled Workflow" }))))
            .catch(() => {});
        return () => { live = false; };
    }, [refreshKey]);

    const inEditor = currentView === "nodes";
    const forcedRail = inEditor && narrow;
    const collapsed = forcedRail || (pinned ?? inEditor);
    const activeView: SidebarView = inEditor ? "workflows" : currentView;

    const toggle = () => {
        const next = !collapsed;
        setPinned(next);
        try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
    };

    const itemCls = (active: boolean) =>
        cn(
            "flex h-10 items-center gap-3 rounded-xl text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-foreground/30",
            collapsed ? "w-10 justify-center" : "w-full px-3",
            active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        );

    const name = session?.user?.name ?? "";

    return (
        <aside
            className={cn(
                "hidden shrink-0 flex-col rounded-[22px] border border-border/70 bg-card py-4 shadow-card transition-[width] duration-200 md:flex",
                collapsed ? "w-[68px] items-center px-3" : "w-[236px] px-3"
            )}
        >
            {/* Brand + collapse */}
            <div className={cn("flex items-center", collapsed ? "flex-col gap-3" : "justify-between pl-1")}>
                <button onClick={() => onViewChange("home")} aria-label="DevFlow home" className="rounded-xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-foreground/30">
                    {collapsed ? <LogoMark /> : <Logo />}
                </button>
                {!forcedRail && <button
                    onClick={toggle}
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>}
            </div>

            <button
                onClick={onNewWorkflow}
                title="New workflow"
                className={cn(
                    "mt-5 flex h-10 items-center justify-center gap-2 rounded-full bg-volt text-sm font-semibold text-volt-foreground transition-transform hover:scale-[1.03] active:scale-95",
                    collapsed ? "w-10" : "w-full"
                )}
            >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                {!collapsed && "New workflow"}
            </button>

            <nav className="mt-5 flex flex-col gap-1" aria-label="Main">
                {NAV.map((item) => (
                    <button key={item.view} onClick={() => onViewChange(item.view)} title={collapsed ? item.label : undefined} aria-label={item.label} aria-current={activeView === item.view ? "page" : undefined} className={itemCls(activeView === item.view)}>
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && item.label}
                    </button>
                ))}
            </nav>

            {/* Recent workflows */}
            {!collapsed && recent.length > 0 && (
                <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
                    <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
                    <ul className="space-y-0.5">
                        {recent.map((w) => {
                            const active = inEditor && w.id === activeWorkflowId;
                            return (
                                <li key={w.id}>
                                    <button onClick={() => onOpenWorkflow(w.id)} title={w.name} className={cn("flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-foreground/30", active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-foreground" : "bg-border")} />
                                        <span className="truncate">{w.name}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            {(collapsed || recent.length === 0) && <div className="flex-1" />}

            {/* Settings + account */}
            <div className={cn("flex flex-col gap-1 border-t border-border/60 pt-3", collapsed && "items-center")}>
                <button onClick={() => onViewChange("settings")} title={collapsed ? "Settings" : undefined} aria-label="Settings" aria-current={currentView === "settings" ? "page" : undefined} className={itemCls(currentView === "settings")}>
                    <Settings className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && "Settings"}
                </button>

                {session && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button aria-label="Account menu" className={cn("mt-1 flex items-center gap-3 rounded-xl outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-foreground/30", collapsed ? "h-10 w-10 justify-center" : "h-12 w-full px-2")}>
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">{name.charAt(0).toUpperCase()}</span>
                                {!collapsed && (
                                    <>
                                        <span className="min-w-0 flex-1 text-left">
                                            <span className="block truncate text-sm font-medium leading-tight">{name}</span>
                                            <span className="block truncate text-[11px] leading-tight text-muted-foreground">{session.user.email}</span>
                                        </span>
                                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    </>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side={collapsed ? "right" : "top"} align="end" className="w-56">
                            <DropdownMenuLabel className="font-normal">
                                <p className="truncate text-sm font-semibold">{name}</p>
                                <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={async () => { await signOut(); router.refresh(); }}>
                                <LogOut className="mr-2 h-3.5 w-3.5" />
                                Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </aside>
    );
}
