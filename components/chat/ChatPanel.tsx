"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { ArrowUp, Sparkles, X, Maximize2, Minimize2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
    role: "user" | "assistant";
    content: string;
};

type WorkflowData = {
    nodes: any[];
    edges: any[];
};

interface ChatPanelProps {
    getCurrentWorkflow?: () => WorkflowData | null;
    onWorkflowGenerated?: (workflow: WorkflowData, opts?: { fresh?: boolean }) => void;
    /** The canvas has edits that aren't saved yet (starting fresh would discard them). */
    canvasIsDirty?: boolean;
    onGenerationStart?: () => void;
    resetKey?: number;
    pendingPrompt?: string | null;
    onPendingPromptConsumed?: () => void;
}

export interface ChatPanelHandle {
    sendMessage: (text: string) => void;
}

const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel({ getCurrentWorkflow, onWorkflowGenerated, onGenerationStart, canvasIsDirty, resetKey, pendingPrompt, onPendingPromptConsumed }, ref) {
    const [isOpen, setIsOpen] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const initialMessage: Message = {
        role: "assistant",
        content: "Hi! Tell me what you want to automate and I'll draw the workflow on the canvas. You can keep chatting to refine it.",
    };
    const [messages, setMessages] = useState<Message[]>([initialMessage]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const hasConsumedPromptRef = useRef(false);

    // With nodes on the canvas a message edits that workflow, unless the user chooses to start over
    const [mode, setMode] = useState<"edit" | "fresh">("edit");
    const [canvasHasNodes, setCanvasHasNodes] = useState(false);
    useEffect(() => {
        const check = () => setCanvasHasNodes((getCurrentWorkflow?.()?.nodes.length ?? 0) > 0);
        check();
        const t = setInterval(check, 600); // the canvas lives in a ref, so look at it periodically
        return () => clearInterval(t);
    }, [getCurrentWorkflow]);
    const fresh = mode === "fresh" && canvasHasNodes;

    // Docked on wide screens; below xl it's an overlay sheet that starts closed
    const isWide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches;
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- needs the real viewport, which isn't known during SSR
        if (!isWide()) setIsOpen(false);
    }, []);
    const endRef = useRef<HTMLDivElement>(null);

    // Keep the latest message in view
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, isLoading]);

    // Reset chat when switching workflows
    useEffect(() => {
        setMessages([initialMessage]);
        setInput("");
        setIsLoading(false);
        setMode("edit");
        hasConsumedPromptRef.current = false;
    }, [resetKey]);

    // Auto-submit pending template prompt after reset
    useEffect(() => {
        if (pendingPrompt && !isLoading && !hasConsumedPromptRef.current) {
            hasConsumedPromptRef.current = true;
            setIsOpen(true);
            submitMessage(pendingPrompt);
            if (onPendingPromptConsumed) onPendingPromptConsumed();
        }
    }, [pendingPrompt, resetKey]);

    // Expose sendMessage to parent for template auto-generation
    useImperativeHandle(ref, () => ({
        sendMessage: (text: string) => {
            if (isLoading) return;
            setIsOpen(true);
            submitMessage(text);
        },
    }));

    const submitMessage = async (userMessage: string) => {
        if (!userMessage.trim() || isLoading) return;
        if (fresh && canvasIsDirty && !window.confirm("Start a new workflow? The unsaved changes on this canvas will be discarded.")) return;
        const startingFresh = fresh;

        setInput("");

        // Add user message to chat
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);
        if (onGenerationStart) onGenerationStart();

        try {
            // Read the LATEST canvas state right now (not a stale snapshot)
            const latestWorkflow = getCurrentWorkflow ? getCurrentWorkflow() : null;
            const hasExistingWorkflow = !startingFresh && latestWorkflow && latestWorkflow.nodes.length > 0;
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    ...(hasExistingWorkflow && { currentWorkflow: latestWorkflow }),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to generate workflow");
            }

            // Add assistant response
            const hasExisting = hasExistingWorkflow;
            setMessages(prev => [
                ...prev,
                {
                    role: "assistant",
                    content: startingFresh
                        ? `I've started a new workflow with ${data.workflow.nodes.length} nodes. Your previous one is untouched.`
                        : hasExisting
                        ? `I've updated the workflow — it now has ${data.workflow.nodes.length} nodes. Check the canvas!`
                        : `I've created a workflow with ${data.workflow.nodes.length} nodes. Check the canvas to see it!`,
                },
            ]);

            // Notify parent component about the new workflow
            if (onWorkflowGenerated) {
                onWorkflowGenerated(data.workflow, { fresh: startingFresh });
                if (startingFresh) setMode("edit"); // the new canvas is now the one being refined
            }
            // On small screens the chat overlays the canvas; get out of the way so the result is visible
            if (!isWide()) setTimeout(() => setIsOpen(false), 900);
        } catch (error: any) {
            setMessages(prev => [
                ...prev,
                {
                    role: "assistant",
                    content: `Sorry, I encountered an error: ${error.message}. Please try again!`,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        submitMessage(input.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-30 flex h-14 items-center gap-2 rounded-full bg-foreground pl-4 pr-5 text-sm font-semibold text-background shadow-card transition-transform hover:scale-105 [body[data-node-panel=open]_&]:hidden"
            >
                <Sparkles className="h-5 w-5 text-volt" />
                Ask DevFlow
            </button>
        );
    }

    const suggestions = [
        "Send a Slack alert when a webhook receives an error",
        "Summarize new emails with AI every morning",
        "Sync new Typeform leads to a spreadsheet",
    ];

    return (
        <div className={cn("flex h-full flex-col overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-card transition-all duration-300 max-xl:w-[min(400px,calc(100vw-24px))] max-xl:shadow-2xl", isExpanded ? "xl:w-[520px]" : "xl:w-[360px]")}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-volt">
                        <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                        <h2 className="text-sm font-semibold leading-tight">Ask DevFlow</h2>
                        <p className="text-[11px] text-muted-foreground">Describe it, I&apos;ll build it</p>
                    </div>
                </div>
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="hidden rounded-lg p-1.5 transition-colors hover:bg-muted xl:block"
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? <Minimize2 className="h-4 w-4 text-muted-foreground" /> : <Maximize2 className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <button onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 transition-colors hover:bg-muted" title="Close">
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3">
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={cn(
                            "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                            msg.role === "assistant"
                                ? "self-start rounded-tl-md bg-muted text-foreground"
                                : "self-end rounded-tr-md bg-foreground text-background"
                        )}
                    >
                        {msg.content}
                    </div>
                ))}

                {messages.length === 1 && !isLoading && (
                    <div className="mt-1 flex flex-col gap-2">
                        {suggestions.map((s) => (
                            <button
                                key={s}
                                onClick={() => submitMessage(s)}
                                className="group flex items-center justify-between gap-3 rounded-2xl border border-border px-3.5 py-2.5 text-left text-[13px] text-muted-foreground transition-all hover:border-foreground/25 hover:text-foreground"
                            >
                                {s}
                                <ArrowUp className="h-3.5 w-3.5 shrink-0 rotate-45 opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                        ))}
                    </div>
                )}

                {isLoading && (
                    <div className="flex items-center gap-2 self-start rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                        <span className="flex gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.3s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.15s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60" />
                        </span>
                        Building your workflow
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3">
                {canvasHasNodes && (
                    <div role="radiogroup" aria-label="What should your message do?" className="mb-2 flex gap-1 rounded-full bg-muted p-1 text-xs font-medium">
                        {([["edit", "Edit this workflow"], ["fresh", "Start fresh"]] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={mode === value}
                                disabled={isLoading}
                                onClick={() => setMode(value)}
                                className={cn("h-8 flex-1 rounded-full px-3 transition-colors disabled:opacity-60", mode === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                <div className="relative rounded-3xl bg-muted p-1.5 transition-shadow focus-within:ring-2 focus-within:ring-foreground/15">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={fresh ? "Describe the new workflow…" : canvasHasNodes ? "Describe a change…" : "Describe your workflow…"}
                        disabled={isLoading}
                        rows={2}
                        className="min-h-[56px] w-full resize-none bg-transparent px-3 py-2 pr-12 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 disabled:scale-100 disabled:opacity-30"
                        aria-label="Send"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
                    </button>
                </div>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                    {fresh ? "Your current workflow stays saved." : "Enter to send · Shift+Enter for a new line"}
                </p>
            </form>
        </div>
    );
});

export default ChatPanel;
