"use client";

import { memo, useCallback, useEffect } from "react";
import { Handle, Position, useReactFlow, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { LucideIcon, MoreVertical, Check, X, Loader2, Settings, Rocket, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/Toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SWITCH_DEFAULT, isSwitchNode, switchCases } from "@/lib/engine/switch";
import { iconForNode, nodeKindStyles, normalizeKind, subtitleForNode } from "@/lib/node-visuals";

// Unified Node Type Data
export type ProNodeData = {
    label: string;
    description?: string;
    type: "trigger" | "action" | "logic" | "data";
    status?: "idle" | "running" | "success" | "failed" | "error" | "simulated" | "skipped";
    config?: Record<string, any>;
    icon?: LucideIcon;
    /** Position in a freshly generated graph; staggers the entrance animation. */
    revealIndex?: number;
};

function kindOfLogic(data: ProNodeData) {
    return data.type === "logic" && isSwitchNode(data.label, data.config);
}

function ProNode({ data, id, selected }: NodeProps<Node<ProNodeData>>) {
    const { deleteElements } = useReactFlow();
    const updateNodeInternals = useUpdateNodeInternals();
    const switchOutputs = kindOfLogic(data) ? [...switchCases(data.config), SWITCH_DEFAULT] : null;
    const switchKey = switchOutputs?.join("\u0000") ?? "";
    // Handles come and go when cases are edited; tell React Flow to re-measure them
    useEffect(() => { if (switchKey) updateNodeInternals(id); }, [switchKey, id, updateNodeInternals]);
    const kind = normalizeKind(data.type);
    const style = nodeKindStyles[kind];
    const Icon = data.icon || iconForNode(data.label, kind, data.config);
    const subtitle = subtitleForNode(data.description, data.config);
    const status = data.status === "error" ? "failed" : data.status;

    const handleDelete = useCallback(() => {
        deleteElements({ nodes: [{ id }] });
        showToast(`"${data.label}" removed`, "error");
    }, [id, data.label, deleteElements]);

    const handleEditConfig = useCallback(() => {
        window.dispatchEvent(new CustomEvent("edit-node-config", { detail: { id } }));
    }, [id]);

    const handleRunNode = useCallback(() => {
        window.dispatchEvent(new CustomEvent("run-single-node", { detail: { id } }));
    }, [id]);

    const handleClass = cn(
        "!h-2.5 !w-2.5 !rounded-full !border-2 !border-card transition-transform hover:!scale-150",
        style.handle
    );

    const configChips = data.config
        ? Object.entries(data.config)
            .filter(([, v]) => ["string", "number", "boolean"].includes(typeof v) && String(v) !== "" && String(v) !== subtitle)
            .slice(0, 2)
        : [];

    return (
        <div
            style={{ animationDelay: `${Math.min(data.revealIndex ?? 0, 12) * 70}ms` }}
            className={cn(
                "animate-node-in group relative w-[260px] rounded-2xl border bg-card shadow-card transition-all duration-200",
                "hover:-translate-y-0.5",
                selected ? "border-foreground ring-4 ring-foreground/10" : "border-border",
                status === "running" && "border-volt ring-4 ring-volt/40 animate-ring-pulse",
                status === "success" && "border-emerald-500/60",
                status === "simulated" && "border-amber-500/60",
                status === "skipped" && "opacity-60",
                status === "failed" && "border-destructive ring-4 ring-destructive/15"
            )}
        >
            {kind !== "trigger" && <Handle type="target" position={Position.Top} className={handleClass} />}

            <div className="flex items-start gap-3 p-3.5">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", style.chip)}>
                    {/* eslint-disable-next-line react-hooks/static-components -- iconForNode returns a stable icon from a lookup table */}
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold leading-tight text-foreground">{data.label}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle || style.label}</p>
                </div>

                {/* Status / menu */}
                <div className="flex shrink-0 items-center gap-1">
                    {status === "running" && <Loader2 className="h-4 w-4 animate-spin text-foreground" />}
                    {status === "success" && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                            <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                        </span>
                    )}
                    {status === "simulated" && (
                        <span title="Simulated: nothing external happened" className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">Simulated</span>
                    )}
                    {status === "skipped" && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Skipped</span>
                    )}
                    {status === "failed" && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white">
                            <X className="h-2.5 w-2.5" strokeWidth={3.5} />
                        </span>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Actions for ${data.label}`}
                                className="nodrag rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100">
                                <MoreVertical className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        {/* Menu items live in a portal, but React still bubbles their clicks to the node, which would also select it and open its settings */}
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={handleRunNode}>
                                <Rocket className="mr-2 h-3.5 w-3.5" />
                                Run this node
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleEditConfig}>
                                <Settings className="mr-2 h-3.5 w-3.5" />
                                Edit configuration
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {configChips.length > 0 && (
                <div className="flex flex-wrap gap-1 border-t border-border/60 px-3.5 py-2">
                    {configChips.map(([key, value]) => (
                        <span
                            key={key}
                            className="max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                        >
                            {key}: {String(value)}
                        </span>
                    ))}
                </div>
            )}

            {/* Outputs */}
            {switchOutputs ? (
                <>
                    <div className="h-7" aria-hidden />
                    {switchOutputs.map((name, i) => {
                        const left = `${((i + 0.5) / switchOutputs.length) * 100}%`;
                        const isDefault = name === SWITCH_DEFAULT && i === switchOutputs.length - 1;
                        return (
                            <span key={name}>
                                <Handle type="source" position={Position.Bottom} id={name} className={cn(handleClass, isDefault && "!bg-muted-foreground")} style={{ left }} />
                                <span
                                    title={name}
                                    style={{ left, maxWidth: `${88 / switchOutputs.length}%` }}
                                    className={cn("absolute bottom-2 -translate-x-1/2 truncate rounded-full px-1.5 py-px text-[10px] font-semibold", isDefault ? "bg-muted text-muted-foreground" : "bg-amber-500/15 text-amber-800 dark:text-amber-300")}
                                >
                                    {name}
                                </span>
                            </span>
                        );
                    })}
                </>
            ) :             kind === "logic" ? (
                <>
                    {/* Labels live inside the card so the connector lines start cleanly at the dots */}
                    <div className="h-6" aria-hidden />
                    <Handle type="source" position={Position.Bottom} id="true" className={cn(handleClass, "!left-[30%] !bg-emerald-500")} />
                    <span className="absolute bottom-2 left-[30%] -translate-x-1/2 rounded-full bg-emerald-500/10 px-2 py-px text-[10px] font-semibold text-emerald-700">
                        Yes
                    </span>
                    <Handle type="source" position={Position.Bottom} id="false" className={cn(handleClass, "!left-[70%] !bg-destructive")} />
                    <span className="absolute bottom-2 left-[70%] -translate-x-1/2 rounded-full bg-destructive/10 px-2 py-px text-[10px] font-semibold text-destructive">
                        No
                    </span>
                </>
            ) : (
                <Handle type="source" position={Position.Bottom} className={handleClass} />
            )}
        </div>
    );
}

export default memo(ProNode);
