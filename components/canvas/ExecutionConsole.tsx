import { useState, useEffect, useRef } from "react";
import { Terminal, X, ChevronUp, ChevronDown, CheckCircle2, XCircle, Loader2, GripHorizontal, GripVertical } from "lucide-react";
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

export default function ExecutionConsole({ isOpen, onClose, onOpen, logs, status }: ExecutionConsoleProps) {
    const endOfLogsRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(300); // Initial drawer height in px
    const [width, setWidth] = useState<number | undefined>(undefined);
    const isDraggingHeightRef = useRef(false);
    const isDraggingWidthRef = useRef(false);

    // Set initial width based on window size
    useEffect(() => {
        if (typeof window !== "undefined" && width === undefined) {
            setWidth(window.innerWidth - 420 - 16);
        }
    }, [width]);

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
        if (isOpen) {
            endOfLogsRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, isOpen]);

    // Drag to resize logic
    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (isDraggingHeightRef.current) {
                const newHeight = window.innerHeight - e.clientY - 16;
                setHeight(Math.max(150, Math.min(newHeight, window.innerHeight * 0.8)));
            }
            if (isDraggingWidthRef.current) {
                const consoleEl = document.getElementById('execution-console');
                if (consoleEl) {
                    const rect = consoleEl.getBoundingClientRect();
                    const newWidth = e.clientX - rect.left;
                    // Max width ensures we don't overlap the right sidebar/chat panel space (~420px total clearance)
                    const maxWidth = window.innerWidth - rect.left - 420;
                    setWidth(Math.max(300, Math.min(newWidth, maxWidth)));
                }
            }
        };

        const handlePointerUp = () => {
            if (isDraggingHeightRef.current || isDraggingWidthRef.current) {
                isDraggingHeightRef.current = false;
                isDraggingWidthRef.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.body.style.pointerEvents = '';
            }
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);

        return () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };
    }, []);

    if (!isOpen) {
        // Return a floating toggle button when closed
        return (
            <button
                onClick={onOpen}
                className="absolute bottom-4 left-[72px] z-20 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-lg hover:bg-muted transition-colors animate-in fade-in"
            >
                <Terminal className="h-4 w-4" />
                Execution Console
                {status === "running" && <Loader2 className="ml-1 h-3 w-3 animate-spin text-blue-500" />}
                {status === "success" && <CheckCircle2 className="ml-1 h-3 w-3 text-green-500" />}
                {status === "failed" && <XCircle className="ml-1 h-3 w-3 text-red-500" />}
            </button>
        );
    }

    // If width hasn't mounted yet, default to CSS calculation
    const styleObj = {
        height: `${height}px`,
        // Remove `right-[420px]` class when using dynamic width, since width dictates the right edge.
        width: width ? `${width}px` : 'calc(100vw - 436px)'
    };

    return (
        <div id="execution-console" style={styleObj} className="absolute bottom-4 left-[72px] z-50 flex rounded-lg border border-border bg-card shadow-2xl overflow-hidden transition-all duration-0">
            <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                {/* Drag Handle Top */}
                <div
                    className="w-full h-1.5 cursor-row-resize bg-muted/20 hover:bg-muted/80 transition-colors shrink-0 flex items-center justify-center touch-none"
                    onPointerDown={(e) => {
                        isDraggingHeightRef.current = true;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        e.stopPropagation();
                        e.preventDefault();
                        document.body.style.userSelect = 'none';
                        document.body.style.cursor = 'row-resize';
                        document.body.style.pointerEvents = 'none'; // Prevents other elements from intercepting mouse state
                    }}
                >
                    <GripHorizontal className="h-4 w-4 text-muted-foreground/30 pointer-events-none" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-semibold truncate">Execution Console</span>
                        {/* Status Badge */}
                        <div className="ml-2 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-background border border-border shrink-0">
                            {status === "idle" && <span className="text-muted-foreground">Ready</span>}
                            {status === "running" && (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                    <span className="text-blue-500">Running...</span>
                                </>
                            )}
                            {status === "success" && (
                                <>
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    <span className="text-green-500">Success</span>
                                </>
                            )}
                            {status === "failed" && (
                                <>
                                    <XCircle className="h-3 w-3 text-red-500" />
                                    <span className="text-red-500">Failed</span>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        aria-label="Close Execution Console"
                        className="rounded-md p-2 hover:bg-muted transition-colors cursor-pointer shrink-0 z-50 pointer-events-auto"
                    >
                        <ChevronDown className="h-4 w-4 text-muted-foreground pointer-events-none" />
                    </button>
                </div>

                {/* Logs Area */}
                <div className="flex-1 overflow-y-auto bg-[#0A0A0A] p-4 font-mono text-sm min-w-0">
                    {logs.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-muted-foreground opacity-50">
                            <Terminal className="mb-2 h-8 w-8" />
                            <p>No execution logs yet.</p>
                            <p className="text-xs">Click "Run Workflow" to start.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {logs.map((log) => (
                                <div key={log.id} className="flex items-start gap-3">
                                    <span className="shrink-0 text-xs text-muted-foreground/50 mt-0.5">
                                        {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                    <div className={cn(
                                        "flex-1 break-words",
                                        log.type === "info" && "text-slate-300",
                                        log.type === "success" && "text-green-400",
                                        log.type === "error" && "text-red-400",
                                        log.type === "warning" && "text-amber-400"
                                    )}>
                                        {log.nodeId && <span className="mr-2 rounded bg-muted/30 px-1 py-0.5 text-xs font-medium text-muted-foreground">[{log.nodeId}]</span>}
                                        {log.message}
                                    </div>
                                </div>
                            ))}
                            <div ref={endOfLogsRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Right Drag Handle (Width) */}
            <div
                className="h-full w-1.5 cursor-col-resize bg-muted/20 hover:bg-muted/80 transition-colors shrink-0 flex items-center justify-center touch-none pointer-events-auto z-10"
                onPointerDown={(e) => {
                    isDraggingWidthRef.current = true;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    e.stopPropagation();
                    e.preventDefault();
                    document.body.style.userSelect = 'none';
                    document.body.style.cursor = 'col-resize';
                    document.body.style.pointerEvents = 'none'; // Prevents other elements from intercepting mouse state
                }}
            >
                <GripVertical className="h-4 w-4 text-muted-foreground/30 pointer-events-none" />
            </div>
        </div>
    );
}
