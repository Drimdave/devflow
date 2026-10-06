"use client";

import { Play, Save, Share2, MoreHorizontal, Loader2, Pencil, Check, Download, Copy, Trash2, ArrowLeft } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/Toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
    workflowName?: string;
    isSaving?: boolean;
    lastSaved?: Date | null;
    onSave?: () => void;
    onNameChange?: (name: string) => void;
    onShare?: () => void;
    onExportJSON?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    hasUnsavedChanges?: boolean;
    onRunWorkflow?: () => void;
    /** A run is in progress: the Run button is disabled until it finishes. */
    isRunning?: boolean;
    /** Opt-in: saved workflows save themselves a few seconds after each change. */
    autosave?: boolean;
    onToggleAutosave?: () => void;
    /** Live workflows answer webhooks and run on their schedule; paused ones do neither. Only saved workflows have the switch. */
    isLive?: boolean;
    onToggleLive?: () => void;
    onBack?: () => void;
}

export default function Header({ workflowName, isSaving, lastSaved, hasUnsavedChanges, onSave, onNameChange, onShare, onExportJSON, onDuplicate, onDelete, onRunWorkflow, isRunning, autosave, onToggleAutosave, isLive, onToggleLive, onBack }: HeaderProps) {
    const [timeAgo, setTimeAgo] = useState("Not saved yet");
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(workflowName || "");
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync editValue when workflowName changes externally (e.g. loading a workflow)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the field in sync with the loaded workflow name
        setEditValue(workflowName || "");
    }, [workflowName]);

    useEffect(() => {
        if (hasUnsavedChanges) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- show the unsaved state immediately
            setTimeAgo("Unsaved changes");
            return;
        }

        if (!lastSaved) {
            setTimeAgo("Not saved yet");
            return;
        }

        const update = () => {
            const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
            if (seconds < 10) setTimeAgo("Just saved");
            else if (seconds < 60) setTimeAgo(`Saved ${seconds}s ago`);
            else if (seconds < 3600) setTimeAgo(`Saved ${Math.floor(seconds / 60)}m ago`);
            else setTimeAgo(`Saved ${Math.floor(seconds / 3600)}h ago`);
        };

        update();
        const interval = setInterval(update, 10000);
        return () => clearInterval(interval);
    }, [lastSaved, hasUnsavedChanges]);

    const startEditing = () => {
        setIsEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const confirmEdit = () => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== workflowName) {
            onNameChange?.(trimmed);
        } else {
            setEditValue(workflowName || "");
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") confirmEdit();
        if (e.key === "Escape") {
            setEditValue(workflowName || "");
            setIsEditing(false);
        }
    };

    const handleRunWorkflow = () => {
        if (isRunning) return;
        if (onRunWorkflow) {
            onRunWorkflow();
        } else {
            showToast("Workflow execution coming soon!", "success");
        }
    };

    return (
        <header className="flex h-[60px] w-full shrink-0 items-center justify-between rounded-[22px] border border-border/70 bg-card px-4 shadow-card">
            {/* Left: Workflow Info */}
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent"
                        aria-label="Back to all workflows"
                        title="All workflows"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex min-w-0 items-center gap-2.5">
                        {isEditing ? (
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <input
                                    ref={inputRef}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={confirmEdit}
                                    onKeyDown={handleKeyDown}
                                    className="h-8 min-w-0 flex-1 rounded-lg border border-foreground/30 bg-background px-2.5 text-[15px] font-semibold text-foreground outline-none focus:border-foreground"
                                    autoFocus
                                />
                                <button
                                    onClick={confirmEdit}
                                    className="flex h-6 w-6 items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors"
                                >
                                    <Check className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={startEditing}
                                className="group -ml-1.5 flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-muted"
                                title="Click to rename"
                            >
                                <h1 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                                    {workflowName || "Untitled Workflow"}
                                </h1>
                                <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                        )}
                    </div>
                    <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground" aria-live="polite">
                        <span
                            className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                hasUnsavedChanges ? "bg-amber-500" : lastSaved ? "bg-emerald-500" : "bg-muted-foreground/40"
                            )}
                        />
                        <span className="truncate">{timeAgo}</span>
                    </span>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="flex h-10 items-center gap-2 rounded-full bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span className="hidden sm:inline">{isSaving ? "Saving…" : "Save"}</span>
                </button>
                {onToggleLive && (
                    <button
                        onClick={onToggleLive}
                        role="switch"
                        aria-checked={!!isLive}
                        aria-label={isLive ? "Live: click to pause this workflow" : "Paused: click to turn this workflow on"}
                        title={isLive ? "Live: responds to its webhook and runs on its schedule. Click to pause." : "Paused: ignores its webhook and schedule. Click to turn on."}
                        className="flex h-10 items-center gap-2 rounded-full bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                        <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <span className="hidden sm:inline">{isLive ? "Live" : "Paused"}</span>
                    </button>
                )}
                <button
                    onClick={onShare}
                    className="hidden h-10 items-center gap-2 rounded-full bg-muted px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent sm:flex"
                >
                    <Share2 className="h-4 w-4" />
                    Share
                </button>
                <button
                    onClick={handleRunWorkflow}
                    disabled={isRunning}
                    aria-label={isRunning ? "Workflow is running" : "Run workflow"}
                    aria-busy={isRunning}
                    className="flex h-10 items-center gap-2 rounded-full bg-foreground px-2.5 text-sm font-semibold text-background transition-transform hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 disabled:active:scale-100 sm:pl-3.5 sm:pr-5"
                >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-volt text-volt-foreground">
                        {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-2.5 w-2.5 fill-current" />}
                    </span>
                    <span className="hidden sm:inline">{isRunning ? "Running…" : "Run"}</span>
                </button>

                {/* ··· More Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onExportJSON}>
                            <Download className="mr-2 h-3.5 w-3.5" />
                            Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onDuplicate}>
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            Duplicate workflow
                        </DropdownMenuItem>
                        {onToggleAutosave && (
                            <DropdownMenuItem onClick={onToggleAutosave} className="items-start" aria-checked={!!autosave} role="menuitemcheckbox">
                                <Check className={`mr-2 mt-0.5 h-3.5 w-3.5 ${autosave ? "opacity-100" : "opacity-0"}`} />
                                <span>
                                    Autosave
                                    <span className="block max-w-[210px] text-[11px] font-normal leading-snug text-muted-foreground">
                                        Saves existing workflows a few seconds after each change. Saved changes go live for webhooks.
                                    </span>
                                </span>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete workflow
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
