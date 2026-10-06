"use client";

import { useRouter } from "next/navigation";
import { Home, Workflow, Box, History, Settings, Plus, LogOut, Loader2, Menu, Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
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
    { icon: Settings, label: "Settings", view: "settings" },
];

interface TopNavProps {
    currentView: SidebarView;
    onViewChange: (view: SidebarView) => void;
    onNewWorkflow: () => void;
}

export default function TopNav({ currentView, onViewChange, onNewWorkflow }: TopNavProps) {
    const { data: session, isPending } = useSession();
    const router = useRouter();
    // The editor (view "nodes") is part of Workflows, so that tab stays lit while you build
    const activeView: SidebarView = currentView === "nodes" ? "workflows" : currentView;

    return (
        <header className="flex h-[60px] shrink-0 md:hidden items-center justify-between rounded-[22px] border border-border/70 bg-card px-3 pl-4 shadow-card">
            <button
                onClick={() => onViewChange("home")}
                className="rounded-xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-foreground/30"
                aria-label="DevFlow home"
            >
                <Logo />
            </button>

            <nav className="hidden items-center gap-1 rounded-full bg-muted p-1 md:flex">
                {NAV.map((item) => {
                    const active = activeView === item.view;
                    return (
                        <button
                            key={item.view}
                            onClick={() => onViewChange(item.view)}
                            className={cn(
                                "flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all",
                                active
                                    ? "bg-foreground text-background shadow-sm"
                                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            <span className="hidden lg:inline">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="flex items-center gap-2">
                {/* Compact navigation for small screens */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground outline-none transition-colors hover:bg-accent md:hidden"
                            aria-label="Open navigation"
                        >
                            <Menu className="h-4 w-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        {NAV.map((item) => (
                            <DropdownMenuItem key={item.view} onClick={() => onViewChange(item.view)}>
                                <item.icon className="mr-2.5 h-4 w-4" />
                                {item.label}
                                {activeView === item.view && <Check className="ml-auto h-3.5 w-3.5" />}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <button
                    onClick={onNewWorkflow}
                    className="flex h-10 items-center gap-1.5 rounded-full bg-volt px-4 text-sm font-semibold text-volt-foreground transition-transform hover:scale-[1.03] active:scale-95"
                >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    <span className="hidden sm:inline">New workflow</span>
                </button>

                {isPending ? (
                    <div className="flex h-10 w-10 items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                ) : session ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background outline-none ring-offset-2 ring-offset-card transition-shadow hover:ring-2 hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-foreground/30"
                                aria-label="Account menu"
                            >
                                {session.user.name.charAt(0).toUpperCase()}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="font-normal">
                                <p className="truncate text-sm font-semibold">{session.user.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={async () => {
                                    await signOut();
                                    router.refresh();
                                }}
                            >
                                <LogOut className="mr-2 h-3.5 w-3.5" />
                                Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <button
                        onClick={() => router.push("/login")}
                        className="h-10 rounded-full bg-foreground px-4 text-sm font-medium text-background"
                    >
                        Sign in
                    </button>
                )}
            </div>
        </header>
    );
}
