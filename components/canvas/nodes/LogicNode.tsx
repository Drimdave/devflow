"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

export type LogicNodeData = {
    name: string;
    description?: string;
    condition?: string;
    config?: Record<string, any>;
};

function LogicNode({ data, selected }: NodeProps<LogicNodeData>) {
    return (
        <div
            className={cn(
                "min-w-[200px] rounded-lg border bg-card p-4 shadow-sm transition-all",
                "hover:shadow-md",
                selected &&
                "ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
        >
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                className="!h-3 !w-3 !border-2 !border-background !bg-node-logic"
            />

            {/* Node Header */}
            <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-node-logic/10">
                    <GitBranch className="h-4 w-4 text-node-logic" />
                </div>
                <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                        {data.name}
                    </div>
                    {data.description && (
                        <div className="text-xs text-muted-foreground">
                            {data.description}
                        </div>
                    )}
                    {data.condition && (
                        <div className="mt-1 rounded bg-node-logic/5 px-2 py-1 font-mono text-xs text-node-logic">
                            {data.condition}
                        </div>
                    )}
                </div>
            </div>

            {/* Output Handles (for branching) */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="true"
                className="!left-1/3 !h-3 !w-3 !border-2 !border-background !bg-node-logic"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="false"
                className="!left-2/3 !h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
            />
        </div>
    );
}

export default memo(LogicNode);
