"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Send, Command, X, Maximize2, Minimize2, BotMessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
    onWorkflowGenerated?: (workflow: WorkflowData) => void;
    onGenerationStart?: () => void;
    resetKey?: number;
    pendingPrompt?: string | null;
    onPendingPromptConsumed?: () => void;
}

export interface ChatPanelHandle {
    sendMessage: (text: string) => void;
}

const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel({ getCurrentWorkflow, onWorkflowGenerated, onGenerationStart, resetKey, pendingPrompt, onPendingPromptConsumed }, ref) {
    const [isOpen, setIsOpen] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const initialMessage: Message = {
        role: "assistant",
        content: "Hi! Describe the workflow you want to build, and I'll create it for you. Try something like: 'Create a workflow that enriches new leads from a web form, checks if they're from enterprise companies, and routes them to the right sales channel.'",
    };
    const [messages, setMessages] = useState<Message[]>([initialMessage]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const hasConsumedPromptRef = useRef(false);

    // Reset chat when switching workflows
    useEffect(() => {
        setMessages([initialMessage]);
        setInput("");
        setIsLoading(false);
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

        setInput("");

        // Add user message to chat
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);
        if (onGenerationStart) onGenerationStart();

        try {
            // Read the LATEST canvas state right now (not a stale snapshot)
            const latestWorkflow = getCurrentWorkflow ? getCurrentWorkflow() : null;
            const hasExistingWorkflow = latestWorkflow && latestWorkflow.nodes.length > 0;
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
                    content: hasExisting
                        ? `I've updated the workflow — it now has ${data.workflow.nodes.length} nodes. Check the canvas!`
                        : `I've created a workflow with ${data.workflow.nodes.length} nodes. Check the canvas to see it!`,
                },
            ]);

            // Notify parent component about the new workflow
            if (onWorkflowGenerated) {
                onWorkflowGenerated(data.workflow);
            }
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
                className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg transition-transform hover:scale-110"
            >
                <BotMessageSquare className="h-6 w-6 text-primary-foreground" />
            </button>
        );
    }

    return (
        <div className={`flex h-full flex-col border-l border-border bg-card shadow-xl pointer-events-auto transition-all duration-300 ${isExpanded ? 'w-[600px]' : 'w-[350px]'}`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4 bg-muted/40">
                <div className="flex items-center gap-2">
                    <Command className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold">DevFlow Copilot</h2>
                    <Badge variant="secondary" className="text-[10px] h-5">Beta</Badge>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="rounded-md p-1 hover:bg-muted transition-colors"
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? (
                            <Minimize2 className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <Maximize2 className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="rounded-md p-1 hover:bg-muted transition-colors"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 bg-card/50">
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex flex-col gap-1 text-sm max-w-[85%]",
                            msg.role === "assistant" ? "self-start" : "self-end items-end"
                        )}
                    >
                        <span className="text-[10px] font-medium text-muted-foreground capitalize ml-1">
                            {msg.role}
                        </span>
                        <div
                            className={cn(
                                "rounded-2xl px-4 py-2.5 shadow-sm",
                                msg.role === "assistant"
                                    ? "bg-muted text-foreground rounded-tl-sm border border-border/50"
                                    : "bg-primary text-primary-foreground rounded-tr-sm"
                            )}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Generating workflow...</span>
                    </div>
                )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t border-border p-4 bg-background">
                <div className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe your workflow..."
                        disabled={isLoading}
                        className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute bottom-2 right-2 rounded-md bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Send className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>
                <div className="mt-2 flex justify-center">
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        Powered by Groq Llama 3 • Press Enter to send
                    </span>
                </div>
            </form>
        </div>
    );
});

export default ChatPanel;
