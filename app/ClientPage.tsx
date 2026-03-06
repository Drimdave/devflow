"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import WorkflowCanvas from "@/components/canvas/WorkflowCanvas";
import Sidebar, { SidebarView } from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import ChatPanel from "@/components/chat/ChatPanel";
import type { ChatPanelHandle } from "@/components/chat/ChatPanel";
import HomeDashboard from "@/components/dashboard/HomeDashboard";
import ExecutionConsole, { LogEvent } from "@/components/canvas/ExecutionConsole";
import { showToast } from "@/components/ui/Toast";

type WorkflowData = {
  nodes: any[];
  edges: any[];
};

export default function Home({ initialSlug }: { initialSlug?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();

  const initIsHome = !initialSlug || initialSlug[0] === "home" || initialSlug.length === 0;
  const initIsWorkflows = initialSlug && initialSlug[0] === "workflows";
  const initId = initIsWorkflows && initialSlug[1] ? initialSlug[1] : null;

  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [savedWorkflowId, setSavedWorkflowId] = useState<string | null>(initId);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [chatResetKey, setChatResetKey] = useState(0);
  const [showDashboard, setShowDashboard] = useState(initIsHome && !initId);
  const [sidebarView, setSidebarView] = useState<SidebarView>(
    initialSlug && initialSlug[0] === "templates" ? "templates" :
      initialSlug && initialSlug[0] === "settings" ? "settings" :
        (initIsWorkflows || initId ? "workflows" : "home")
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [executionLogs, setExecutionLogs] = useState<LogEvent[]>([]);
  const [executionStatus, setExecutionStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [nodeExecutionStates, setNodeExecutionStates] = useState<Record<string, "idle" | "running" | "success" | "failed">>({});

  // Ref to get current canvas state from WorkflowCanvas
  const canvasStateRef = useRef<{ nodes: any[]; edges: any[] } | null>(null);

  // Ref to programmatically send messages to ChatPanel
  const chatRef = useRef<ChatPanelHandle>(null);

  // Ref to hold a pending template prompt that should be sent after ChatPanel resets
  const pendingPromptRef = useRef<string | null>(null);

  // Send the pending prompt after ChatPanel has fully re-rendered with the new resetKey
  useEffect(() => {
    if (pendingPromptRef.current && chatRef.current) {
      const prompt = pendingPromptRef.current;
      pendingPromptRef.current = null;
      // Small delay to ensure the ChatPanel's useEffect for resetKey has fired
      setTimeout(() => chatRef.current?.sendMessage(prompt), 300);
    }
  }, [chatResetKey]);

  const handleWorkflowGenerated = useCallback((workflow: WorkflowData) => {
    setWorkflowData(workflow);
    setIsGenerating(false);
    setSavedWorkflowId(null); // New workflow, not saved yet
    setLastSaved(null);
    setHasUnsavedChanges(true);

    // Try to extract a name from the first trigger node
    const triggerNode = workflow.nodes.find((n) => n.type === "trigger");
    if (triggerNode) {
      setWorkflowName(triggerNode.label || "Generated Workflow");
    }
  }, []);

  const handleSave = useCallback(async () => {
    const state = canvasStateRef.current;
    if (!state || (state.nodes.length === 0 && !workflowData)) return;

    setIsSaving(true);
    try {
      const payload = {
        name: workflowName,
        description: `Workflow with ${(state?.nodes || workflowData?.nodes || []).length} nodes`,
        nodes: state?.nodes || workflowData?.nodes || [],
        edges: state?.edges || workflowData?.edges || [],
      };

      let res: Response;
      if (savedWorkflowId) {
        // Update existing
        res = await fetch(`/api/workflows/${savedWorkflowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new
        res = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const data = await res.json();
        setSavedWorkflowId(data.workflow.id);
        setLastSaved(new Date());
        setSidebarRefreshKey((k) => k + 1);
        setHasUnsavedChanges(false);
        showToast("Workflow saved successfully!", "success");
      } else {
        showToast("Failed to save workflow", "error");
      }
    } catch (error) {
      console.error("Save failed:", error);
      showToast("Something went wrong while saving", "error");
    } finally {
      setIsSaving(false);
    }
  }, [workflowName, workflowData, savedWorkflowId]);

  // ── Load a saved workflow from the database ──
  const handleLoadWorkflow = useCallback(async (id: string, force = false) => {
    setShowDashboard(false);
    setSidebarView("workflows");
    if (id === savedWorkflowId && !force) return; // Already loaded

    try {
      const res = await fetch(`/api/workflows/${id}`);
      if (!res.ok) {
        showToast("Failed to load workflow", "error");
        return;
      }

      const data = await res.json();
      const wf = data.workflow;

      // DB returns nodes_json / edges_json (JSONB columns)
      const rawNodes = wf.nodes_json || wf.nodes || [];
      const rawEdges = wf.edges_json || wf.edges || [];

      // Saved nodes are in React Flow format {id, type:"pro", position, data:{type, label, ...}}
      // WorkflowCanvas expects flat format {id, type, label, description, position, config}
      const normalizedNodes = rawNodes.map((n: any) => {
        if (n.data && n.data.label) {
          // Already in React Flow format — unwrap
          return {
            id: n.id,
            type: n.data.type || "action",
            label: n.data.label,
            description: n.data.description || "",
            position: n.position,
            config: n.data.config || {},
          };
        }
        // Already in flat format
        return n;
      });

      const normalizedEdges = rawEdges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
      }));

      setWorkflowData({
        nodes: normalizedNodes,
        edges: normalizedEdges,
      });
      setSavedWorkflowId(wf.id);
      setWorkflowName(wf.name || "Untitled Workflow");
      setLastSaved(new Date(wf.updated_at));
      setHasUnsavedChanges(false);
      showToast(`Loaded "${wf.name}"`, "success");
      setChatResetKey((k) => k + 1);
    } catch (error) {
      console.error("Load failed:", error);
      showToast("Something went wrong while loading", "error");
    }
  }, [savedWorkflowId]);

  // Initial load if ID exists in URL slug
  useEffect(() => {
    if (initId && !workflowData) {
      handleLoadWorkflow(initId, true);
    }
  }, [initId, handleLoadWorkflow, workflowData]);

  // URL routing synchronization
  useEffect(() => {
    let newPath = "/home";
    if (showDashboard) {
      newPath = "/home";
    } else if (savedWorkflowId) {
      newPath = `/workflows/${savedWorkflowId}`;
    } else if (sidebarView === "nodes") {
      newPath = "/workflows";
    } else if (sidebarView === "workflows") {
      newPath = "/workflows";
    } else if (sidebarView === "templates") {
      newPath = "/templates";
    } else if (sidebarView === "settings") {
      newPath = "/settings";
    }

    if (pathname !== newPath && pathname !== `${newPath}/`) {
      router.replace(newPath, { scroll: false });
    }
  }, [showDashboard, savedWorkflowId, sidebarView, pathname, router]);

  // ── Create a fresh canvas ──
  const handleNewWorkflow = useCallback(() => {
    setShowDashboard(false);
    setSidebarView("nodes");
    setWorkflowData({ nodes: [], edges: [] });
    setSavedWorkflowId(null);
    setLastSaved(null);
    setWorkflowName("Untitled Workflow");
    setHasUnsavedChanges(false);
    setChatResetKey((k) => k + 1);
    showToast("New workflow created", "success");
  }, []);

  // ── Handle deletion of workflows from the sidebar ──
  const handleWorkflowDeleted = useCallback((id: string) => {
    // Always trigger a refresh so the Dashboard's "Recent Workflows" list updates
    setSidebarRefreshKey((k) => k + 1);

    if (id === savedWorkflowId) {
      // Clear the canvas if the active workflow was deleted
      setWorkflowData({ nodes: [], edges: [] });
      setSavedWorkflowId(null);
      setLastSaved(null);
      setWorkflowName("Untitled Workflow");
      setHasUnsavedChanges(false);
      setChatResetKey((k) => k + 1);
    }
  }, [savedWorkflowId]);

  // ── Rename workflow ──
  const handleNameChange = useCallback(async (newName: string) => {
    setWorkflowName(newName);
    // If already saved, persist the name change
    if (savedWorkflowId) {
      try {
        await fetch(`/api/workflows/${savedWorkflowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });
        showToast(`Renamed to "${newName}"`, "success");
        setSidebarRefreshKey((k) => k + 1);
      } catch {
        showToast("Failed to rename", "error");
      }
    }
  }, [savedWorkflowId]);

  // ── Share workflow (copy JSON to clipboard) ──
  const handleShare = useCallback(() => {
    const state = canvasStateRef.current;
    if (!state || state.nodes.length === 0) {
      showToast("Nothing to share — canvas is empty", "error");
      return;
    }
    const json = JSON.stringify({ name: workflowName, ...state }, null, 2);
    navigator.clipboard.writeText(json);
    showToast("Workflow JSON copied to clipboard!", "success");
  }, [workflowName]);

  // ── Export workflow as JSON file download ──
  const handleExportJSON = useCallback(() => {
    const state = canvasStateRef.current;
    if (!state || state.nodes.length === 0) {
      showToast("Nothing to export — canvas is empty", "error");
      return;
    }
    const json = JSON.stringify({ name: workflowName, ...state }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(workflowName || "workflow").replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Workflow exported!", "success");
  }, [workflowName]);

  // ── Duplicate workflow (save a copy) ──
  const handleDuplicate = useCallback(async () => {
    const state = canvasStateRef.current;
    if (!state || state.nodes.length === 0) {
      showToast("Nothing to duplicate — canvas is empty", "error");
      return;
    }
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${workflowName || "Workflow"} (Copy)`,
          nodes: state.nodes,
          edges: state.edges,
        }),
      });
      if (!res.ok) throw new Error();
      setSidebarRefreshKey((k) => k + 1);
      showToast("Workflow duplicated!", "success");
    } catch {
      showToast("Failed to duplicate workflow", "error");
    }
  }, [workflowName]);

  // ── Delete current workflow from header ··· menu ──
  const handleDeleteWorkflow = useCallback(async () => {
    if (!savedWorkflowId) {
      showToast("Workflow not saved yet", "error");
      return;
    }
    try {
      const res = await fetch(`/api/workflows/${savedWorkflowId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setWorkflowData({ nodes: [], edges: [] });
      setSavedWorkflowId(null);
      setLastSaved(null);
      setWorkflowName("Untitled Workflow");
      setChatResetKey((k) => k + 1);
      setSidebarRefreshKey((k) => k + 1);
      showToast("Workflow deleted", "error");
    } catch {
      showToast("Failed to delete workflow", "error");
    }
  }, [savedWorkflowId]);

  // ── Run Workflow ──
  const handleRunWorkflow = useCallback(async (nodeIdOrEvent?: string | React.MouseEvent | Event) => {
    const nodeIdToRun = typeof nodeIdOrEvent === 'string' ? nodeIdOrEvent : undefined;
    const state = canvasStateRef.current;
    if (!state || state.nodes.length === 0) {
      showToast("Cannot run an empty workflow", "error");
      return;
    }

    setIsConsoleOpen(true);
    setExecutionStatus("running");
    setExecutionLogs([]);

    // Reset all nodes to idle initially
    const initialNodeStates: Record<string, "idle"> = {};
    state.nodes.forEach(n => initialNodeStates[n.id] = "idle");
    setNodeExecutionStates(initialNodeStates);

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state, nodeIdToRun }),
      });

      if (!res.ok) throw new Error("Failed to start execution");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || ""; // keep the last incomplete chunk

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = "message";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.substring(7);
            else if (line.startsWith('data: ')) eventData = line.substring(6);
          }

          if (eventData) {
            try {
              const data = JSON.parse(eventData);
              const logId = Math.random().toString(36).substring(7);

              if (["log", "info", "error", "success"].includes(eventType)) {
                setExecutionLogs(prev => [...prev, {
                  id: logId,
                  timestamp: new Date(),
                  nodeId: data.nodeId,
                  message: data.message,
                  type: (eventType === "log" ? data.type : eventType) as any
                }]);
              } else if (eventType === "workflow-complete") {
                setExecutionStatus(data.status);
              } else if (eventType === "node-started") {
                setNodeExecutionStates(prev => ({ ...prev, [data.nodeId]: "running" }));
              } else if (eventType === "node-finished") {
                setNodeExecutionStates(prev => ({ ...prev, [data.nodeId]: data.status }));
              }
            } catch (e) {
              console.error("Failed to parse SSE data", e);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setExecutionStatus("failed");
      setExecutionLogs(prev => [...prev, {
        id: "err", timestamp: new Date(), message: "Failed to connect to execution engine", type: "error"
      }]);
    }
  }, []);

  // Listen for 'run-single-node' events from node dropdown menu
  useEffect(() => {
    const handleRunSingleNode = (e: CustomEvent<{ id: string }>) => {
      handleRunWorkflow(e.detail.id);
    };

    window.addEventListener('run-single-node', handleRunSingleNode as EventListener);
    return () => {
      window.removeEventListener('run-single-node', handleRunSingleNode as EventListener);
    };
  }, [handleRunWorkflow]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans text-foreground">
      {/* 1. Left Sidebar (Fixed) */}
      <Sidebar
        activeWorkflowId={savedWorkflowId}
        refreshKey={sidebarRefreshKey}
        currentView={sidebarView}
        onLoadWorkflow={handleLoadWorkflow}
        onNewWorkflow={handleNewWorkflow}
        onWorkflowDeleted={handleWorkflowDeleted}
        onUseTemplate={(prompt) => {
          pendingPromptRef.current = prompt;
          handleNewWorkflow();
          setShowDashboard(false);
          setSidebarView("workflows");
        }}
        onViewChange={(view) => {
          setSidebarView(view);
          if (view === "home") {
            setShowDashboard(true);
          } else {
            setShowDashboard(false);
          }
        }}
      />

      {/* 2. Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Top Header – only shown when viewing a workflow */}
        {!showDashboard && (
          <Header
            workflowName={workflowName}
            isSaving={isSaving}
            lastSaved={lastSaved}
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={handleSave}
            onNameChange={handleNameChange}
            onShare={handleShare}
            onExportJSON={handleExportJSON}
            onDuplicate={handleDuplicate}
            onDelete={handleDeleteWorkflow}
            onRunWorkflow={handleRunWorkflow}
          />
        )}

        {/* Canvas / Dashboard Area */}
        <div className="flex-1 relative bg-muted/5 overflow-hidden">
          {/* Dashboard View */}
          <div className={cn("absolute inset-0 z-10 transition-opacity duration-200 bg-background", showDashboard ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
            <HomeDashboard
              onLoadWorkflow={(id) => {
                setShowDashboard(false);
                handleLoadWorkflow(id);
              }}
              onNewWorkflow={() => {
                setShowDashboard(false);
                handleNewWorkflow();
              }}
              onUseTemplate={(prompt) => {
                pendingPromptRef.current = prompt;
                setShowDashboard(false);
                handleNewWorkflow();
              }}
              onViewAllTemplates={() => {
                setSidebarView("templates");
              }}
              refreshKey={sidebarRefreshKey}
            />
          </div>

          {/* Canvas View */}
          <div className={cn("absolute inset-0 transition-opacity duration-200", !showDashboard ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
            <WorkflowCanvas
              workflowData={workflowData}
              isGenerating={isGenerating}
              canvasStateRef={canvasStateRef}
              onUnsavedChange={() => setHasUnsavedChanges(true)}
              nodeStates={nodeExecutionStates}
            />

            <ExecutionConsole
              isOpen={isConsoleOpen}
              onClose={() => setIsConsoleOpen(false)}
              onOpen={() => setIsConsoleOpen(true)}
              logs={executionLogs}
              status={executionStatus}
            />

            {/* Floating Chat Panel (Absolute Overlay on Right) */}
            <div className="absolute top-0 right-0 h-full z-20 pointer-events-none p-4 w-[400px]">
              <div className="pointer-events-auto h-full flex justify-end">
                <ChatPanel
                  ref={chatRef}
                  getCurrentWorkflow={() => canvasStateRef.current}
                  onWorkflowGenerated={handleWorkflowGenerated}
                  onGenerationStart={() => setIsGenerating(true)}
                  resetKey={chatResetKey}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
