import { useState, useEffect, useRef } from "react";
import { Terminal, ChevronDown, CheckCircle2, XCircle, Loader2, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LogEvent {
    id: string;
    timestamp: Date;
    nodeId?: string;
    message: string;
    type: "info" | "success" | "error" | "warning";
}

interface ExecutionConsoleProps {
    isOpen: boolean;
    onClose: () => void;
    onOpen?: () => void;
    logs: LogEvent[];
    status: "idle" | "running" | "success" | "failed";
}

function StatusPill({ status }: { status: ExecutionConsoleProps["status"] }) {
    const map = {
        idle: { label: "Ready", cls: "bg-muted text-muted-foreground", icon: null },
        running: { label: "Running", cls: "bg-volt text-volt-foreground", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
        success: { label: "Success", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", icon: <CheckCircle2 className="h-3 w-3" /> },
        failed: { label: "Failed", cls: "bg-destructive/10 text-destructive", icon: <XCircle className="h-3 w-3" /> },
    }[status];
    return (
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", map.cls)}>
            {map.icon}
            {map.label}
        </span>
    );
}

export default function ExecutionConsole({ isOpen, onClose, onOpen, logs, status }: ExecutionConsoleProps) {
    const endOfLogsRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(280);
    const isDraggingRef = useRef(false);

    useEffect(() => {
        if (isOpen) endOfLogsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs, isOpen]);

    // Drag the top grip to resize
    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            if (!isDraggingRef.current) return;
            const host = document.getElementById("execution-console")?.parentElement;
            const bottom = host ? host.getBoundingClientRect().bottom : window.innerHeight;
            setHeight(Math.max(160, Math.min(bottom - e.clientY - 16, window.innerHeight * 0.7)));
        };
        const onUp = () => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        return () => {
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onUp);
        };
    }, []);

    if (!isOpen) {
        return (
            <button
                onClick={onOpen}
                className="absolute bottom-[76px] left-1/2 z-20 flex -translate-x-1/2 sm:bottom-4 items-center gap-2 rounded-full border border-border bg-card py-2 pl-3.5 pr-4 text-sm font-medium shadow-card transition-transform hover:scale-[1.03]"
            >
                <Terminal className="h-4 w-4 text-muted-foreground" />
                Execution logs
                {status !== "idle" && <StatusPill status={status} />}
            </button>
        );
    }

    return (
        <div
            id="execution-console"
            style={{ height }}
            className="absolute inset-x-4 bottom-4 z-40 flex flex-col overflow-hidden rounded-[22px] border border-border bg-card shadow-2xl sm:[body[data-node-panel=open]_&]:right-[352px]"
        >
            {/* Resize grip */}
            <div
                className="flex h-3 w-full shrink-0 cursor-row-resize touch-none items-center justify-center hover:bg-muted"
                onPointerDown={(e) => {
                    isDraggingRef.current = true;
                    e.preventDefault();
                    document.body.style.userSelect = "none";
                    document.body.style.cursor = "row-resize";
                }}
            >
                <GripHorizontal className="pointer-events-none h-3.5 w-3.5 text-muted-foreground/40" />
            </div>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-1">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="text-sm font-semibold">Execution logs</span>
                    <StatusPill status={status} />
                    {logs.length > 0 && <span className="text-xs text-muted-foreground">{logs.length} events</span>}
                </div>
                <button
                    onClick={onClose}
                    type="button"
                    aria-label="Close execution logs"
                    className="rounded-full p-2 transition-colors hover:bg-muted"
                >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>

            {/* Logs */}
            <div className="mx-3 mb-3 min-h-0 flex-1 overflow-y-auto rounded-2xl bg-[#0B0B0C] p-4 font-mono text-[13px]">
                {logs.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-400">
                        <Terminal className="mb-1 h-6 w-6" />
                        <p>No runs yet</p>
                        <p className="text-xs text-zinc-400">Press Run to execute this workflow</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {logs.map((log) => (
                            <div key={log.id} className="flex items-start gap-3">
                                <span className="mt-0.5 shrink-0 text-xs text-zinc-400">
                                    {log.timestamp.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </span>
                                <div
                                    className={cn(
                                        "min-w-0 flex-1 break-words",
                                        log.type === "info" && "text-zinc-300",
                                        log.type === "success" && "text-[#C8F31D]",
                                        log.type === "error" && "text-red-400",
                                        log.type === "warning" && "text-amber-400"
                                    )}
                                >
                                    {log.nodeId && (
                                        <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-zinc-400">{log.nodeId.slice(0, 14)}</span>
                                    )}
                                    {log.message}
                                </div>
                            </div>
                        ))}
                        <div ref={endOfLogsRef} />
                    </div>
                )}
            </div>
        </div>
    );
}
