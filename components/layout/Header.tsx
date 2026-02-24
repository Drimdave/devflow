"use client";

import { Play, Save, Share2, MoreHorizontal, Loader2, Pencil, Check, Download, Copy, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
}

export default function Header({ workflowName, isSaving, lastSaved, hasUnsavedChanges, onSave, onNameChange, onShare, onExportJSON, onDuplicate, onDelete, onRunWorkflow }: HeaderProps) {
    const [timeAgo, setTimeAgo] = useState("Not saved yet");
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(workflowName || "");
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync editValue when workflowName changes externally (e.g. loading a workflow)
    useEffect(() => {
        setEditValue(workflowName || "");
    }, [workflowName]);

    useEffect(() => {
        if (hasUnsavedChanges) {
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
        if (onRunWorkflow) {
            onRunWorkflow();
        } else {
            showToast("Workflow execution coming soon!", "success");
        }
    };

    return (
        <header className="flex h-14 w-full items-center justify-between border-b border-border bg-card px-4">
            {/* Left: Workflow Info */}
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <div className="flex items-center gap-1.5">
                                <input
                                    ref={inputRef}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={confirmEdit}
                                    onKeyDown={handleKeyDown}
                                    className="h-6 rounded border border-primary/50 bg-background px-2 text-sm font-semibold text-foreground outline-none focus:border-primary"
                                    autoFocus
                                />
                                <button
                                    onClick={confirmEdit}
                                    className="flex h-5 w-5 items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors"
                                >
                                    <Check className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={startEditing}
                                className="group flex items-center gap-1.5 rounded px-1 -ml-1 hover:bg-muted/50 transition-colors"
                                title="Click to rename"
                            >
                                <h1 className="text-sm font-semibold text-foreground">
                                    {workflowName || "Untitled Workflow"}
                                </h1>
                                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        )}
                        <Badge
                            variant="secondary"
                            className={cn(
                                "font-medium",
                                hasUnsavedChanges
                                    ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                                    : "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                            )}
                        >
                            {hasUnsavedChanges ? "Unsaved" : "Active"}
                        </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo}</span>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Save className="h-3.5 w-3.5" />
                    )}
                    {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                    onClick={onShare}
                    className="flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                </button>
                <div className="mx-1 h-4 w-px bg-border" />
                <button
                    onClick={handleRunWorkflow}
                    className="flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Run Workflow
                </button>

                {/* ··· More Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onExportJSON}>
                            <Download className="h-3.5 w-3.5 mr-2" />
                            Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onDuplicate}>
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Duplicate Workflow
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete Workflow
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
