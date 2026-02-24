"use client";

import { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import { LucideIcon, MoreHorizontal, Play, Zap, GitBranch, AlertCircle, CheckCircle2, Clock, Trash2, Settings, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { showToast } from "@/components/ui/Toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Unified Node Type Data
export type ProNodeData = {
    label: string;
    description?: string;
    type: "trigger" | "action" | "logic";
    status?: "idle" | "running" | "success" | "error";
    config?: Record<string, any>;
    icon?: LucideIcon;
};

const statusColors = {
    idle: "text-muted-foreground",
    running: "text-blue-500 animate-pulse",
    success: "text-green-500",
    error: "text-red-500",
};

const nodeTypeStyles = {
    trigger: {
        icon: Zap,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        border: "group-hover:border-blue-500/50",
        handle: "bg-blue-500",
    },
    action: {
        icon: Play,
        color: "text-teal-500",
        bg: "bg-teal-500/10",
        border: "group-hover:border-teal-500/50",
        handle: "bg-teal-500",
    },
    logic: {
        icon: GitBranch,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        border: "group-hover:border-amber-500/50",
        handle: "bg-amber-500",
    },
};

function ProNode({ data, id, selected }: NodeProps<ProNodeData>) {
    const { deleteElements } = useReactFlow();
    const style = nodeTypeStyles[data.type] || nodeTypeStyles.action;
    const Icon = data.icon || style.icon;

    const handleDelete = useCallback(() => {
        deleteElements({ nodes: [{ id }] });
        showToast(`"${data.label}" removed`, "error");
    }, [id, data.label, deleteElements]);

    const handleEditConfig = useCallback(() => {
        window.dispatchEvent(new CustomEvent('edit-node-config', { detail: { id } }));
    }, [id]);

    const handleRunNode = useCallback(() => {
        window.dispatchEvent(new CustomEvent('run-single-node', { detail: { id } }));
    }, [id]);

    return (
        <div
            className={cn(
                "group relative min-w-[280px] rounded-xl border border-border bg-card shadow-sm transition-all duration-200",
                "hover:shadow-md hover:ring-1 hover:ring-border",
                selected && "ring-2 ring-primary border-transparent shadow-lg",
                style.border
            )}
        >
            {/* Inputs (Top) */}
            {data.type !== "trigger" && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className={cn(
                        "!h-3 !w-3 !rounded-full !border-2 !border-background transition-colors",
                        style.handle
                    )}
                />
            )}

            {/* Header Section */}
            <div className="flex items-center justify-between border-b border-border/50 p-3">
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                            style.bg,
                            style.color
                        )}
                    >
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                            {data.label}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {data.type}
                        </span>
                    </div>
                </div>

                {/* Actions Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="rounded-md p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleRunNode}>
                            <Rocket className="h-3.5 w-3.5 mr-2" />
                            Run This Node
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleEditConfig}>
                            <Settings className="h-3.5 w-3.5 mr-2" />
                            Edit Configuration
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Body Section */}
            <div className="p-3">
                {data.description && (
                    <p className="mb-3 text-xs text-muted-foreground line-clamp-2">
                        {data.description}
                    </p>
                )}

                {/* Configuration Preview (Mini-Badges) */}
                {data.config && Object.keys(data.config).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {Object.entries(data.config)
                            .filter(([_, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
                            .slice(0, 3)
                            .map(([key, value]) => (
                                <Badge
                                    key={key}
                                    variant="secondary"
                                    className="rounded-[4px] px-1.5 py-0 text-[10px] font-normal text-muted-foreground bg-muted/50"
                                >
                                    {key}: {String(value)}
                                </Badge>
                            ))}
                    </div>
                )}
            </div>

            {/* Footer / Status */}
            {data.status && data.status !== "idle" && (
                <div className="flex items-center gap-2 border-t border-border/50 bg-muted/20 p-2 px-3">
                    <Clock className={cn("h-3 w-3", statusColors[data.status])} />
                    <span className="text-xs text-muted-foreground capitalize">
                        {data.status}
                    </span>
                </div>
            )}

            {/* Outputs (Bottom) */}
            {data.type === 'logic' ? (
                <>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="true"
                        className={cn(
                            "!left-1/3 !h-3 !w-3 !rounded-full !border-2 !border-background transition-colors",
                            style.handle
                        )}
                    />
                    <div className="absolute bottom-[-20px] left-1/3 -translate-x-1/2 text-[10px] font-medium text-muted-foreground">True</div>

                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="false"
                        className={cn(
                            "!left-2/3 !h-3 !w-3 !rounded-full !border-2 !border-background transition-colors",
                            "bg-muted-foreground"
                        )}
                    />
                    <div className="absolute bottom-[-20px] left-2/3 -translate-x-1/2 text-[10px] font-medium text-muted-foreground">False</div>
                </>
            ) : (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className={cn(
                        "!h-3 !w-3 !rounded-full !border-2 !border-background transition-colors",
                        style.handle
                    )}
                />
            )}
        </div>
    );
}

export default memo(ProNode);
