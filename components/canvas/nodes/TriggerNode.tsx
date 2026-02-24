"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type TriggerNodeData = {
    name: string;
    description?: string;
    config?: Record<string, any>;
};

function TriggerNode({ data, selected }: NodeProps<TriggerNodeData>) {
    return (
        <div
            className={cn(
                "min-w-[200px] rounded-lg border bg-card p-4 shadow-sm transition-all",
                "hover:shadow-md",
                selected &&
                "ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
        >
            {/* Node Header */}
            <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-node-trigger/10">
                    <Zap className="h-4 w-4 text-node-trigger" />
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
                </div>
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="!h-3 !w-3 !border-2 !border-background !bg-node-trigger"
            />
        </div>
    );
}

export default memo(TriggerNode);
