"use client";

import type { NodeRunStatus, NodeRunResult } from "@/lib/run-types";
import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { PanelLeft } from "lucide-react";
import WorkflowCanvas from "@/components/canvas/WorkflowCanvas";
import Sidebar, { SidebarView } from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import TopNav from "@/components/layout/TopNav";
import ChatPanel from "@/components/chat/ChatPanel";
import type { ChatPanelHandle } from "@/components/chat/ChatPanel";
import HomeDashboard from "@/components/dashboard/HomeDashboard";
import ExecutionConsole, { LogEvent } from "@/components/canvas/ExecutionConsole";
import { showToast } from "@/components/ui/Toast";
import { getTemplate, toEditorWorkflow } from "@/lib/templates";
import TemplateGallery from "@/components/templates/TemplateGallery";
import WorkflowsPage from "@/components/workflows/WorkflowsPage";
import SettingsPage from "@/components/settings/SettingsPage";
import { ConfirmDeleteDialog, ConflictDialog, LoadErrorState, UnsavedChangesDialog } from "@/components/editor/EditorDialogs";
import AppSidebar from "@/components/layout/AppSidebar";
import RunsPage from "@/components/runs/RunsPage";

type WorkflowData = {
  nodes: any[];
  edges: any[];
};

export default function Home({ initialSlug }: { initialSlug?: string[] }) {

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
      initialSlug && initialSlug[0] === "runs" ? "runs" :
        (initId ? "nodes" : initIsWorkflows ? "workflows" : "home")
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Below the lg breakpoint the left panel is a slide-over sheet instead of a fixed column
  const [panelOpen, setPanelOpen] = useState(false);
  // On desktop the library can be collapsed to give the canvas more room (remembered per browser)
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("devflow-library-collapsed") === "1") setLibraryCollapsed(true);
    } catch { /* storage unavailable */ }
  }, []);
  const setCollapsedPersist = useCallback((collapsed: boolean) => {
    setLibraryCollapsed(collapsed);
    try { localStorage.setItem("devflow-library-collapsed", collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, []);
  // One button, two behaviours: a slide-over sheet below lg, collapse/expand from lg up
  const handleTogglePanel = useCallback(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setCollapsedPersist(!libraryCollapsed);
    else setPanelOpen((o) => !o);
  }, [libraryCollapsed, setCollapsedPersist]);

  const [executionLogs, setExecutionLogs] = useState<LogEvent[]>([]);
  const [executionStatus, setExecutionStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [nodeExecutionStates, setNodeExecutionStates] = useState<Record<string, NodeRunStatus>>({});
  const [nodeResults, setNodeResults] = useState<Record<string, NodeRunResult>>({});
  // Each run gets a token; anything arriving from an older run (or an older workflow) is ignored
  const runTokenRef = useRef(0);
  const runAbortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  // ── Protecting unsaved work ──
  // Version of the saved copy this canvas was loaded from / last saved as (null = never saved)
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  // Live = answers its webhook and runs on its schedule. New workflows start live.
  const [isLive, setIsLive] = useState(true);
  const [leavePrompt, setLeavePrompt] = useState<{ action: () => void } | null>(null);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [conflict, setConflict] = useState<{ currentVersion: number; then?: () => void } | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<{ id: string; kind: "notfound" | "failed" } | null>(null);
  const [editTick, setEditTick] = useState(0);
  const [autosave, setAutosave] = useState(false);
  const isSavingRef = useRef(false);
  useEffect(() => {
    try { if (localStorage.getItem("devflow-autosave") === "1") setAutosave(true); } catch { /* storage unavailable */ }
  }, []);
  const toggleAutosave = useCallback(() => {
    setAutosave((on) => {
      try { localStorage.setItem("devflow-autosave", on ? "0" : "1"); } catch { /* ignore */ }
      return !on;
    });
  }, []);

  /** Forget the last run entirely: logs, node badges and per-node results belong to one graph only. */
  const resetExecution = useCallback(() => {
    runTokenRef.current += 1;
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    runningRef.current = false;
    setExecutionLogs([]);
    setExecutionStatus("idle");
    setNodeExecutionStates({});
    setNodeResults({});
    setIsConsoleOpen(false);
  }, []);

  // Ref to get current canvas state from WorkflowCanvas
  const canvasStateRef = useRef<{ nodes: any[]; edges: any[] } | null>(null);

  // Ref to programmatically send messages to ChatPanel
  const chatRef = useRef<ChatPanelHandle>(null);

  // State to hold a pending template prompt that should be sent after ChatPanel resets
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const handleWorkflowGenerated = useCallback((workflow: WorkflowData, opts?: { fresh?: boolean }) => {
    // Chatting on top of a canvas that already has nodes edits that workflow; it must stay the same saved record
    const isEdit = !opts?.fresh && (canvasStateRef.current?.nodes.length ?? 0) > 0;
    setWorkflowData(workflow);
    setIsGenerating(false);
    setHasUnsavedChanges(true);
    setLoadError(null);
    resetExecution();

    if (!isEdit) {
      setSavedWorkflowId(null); // Brand new workflow, not saved yet
      setSavedVersion(null);
      setIsLive(true);
      setLastSaved(null);
      // Try to extract a name from the first trigger node
      const triggerNode = workflow.nodes.find((n) => n.type === "trigger");
      if (triggerNode) {
        setWorkflowName(triggerNode.label || "Generated Workflow");
      }
    }
  }, [resetExecution]);

  /**
   * Save the canvas. Returns true when it was stored. An existing workflow is saved against the version we last saw,
   * so a newer copy saved elsewhere (another tab or device) is detected instead of silently overwritten.
   */
  const handleSave = useCallback(async (opts?: unknown): Promise<boolean> => {
    const { silent = false, overwriteVersion, then } = (opts && typeof opts === "object" && !("nativeEvent" in (opts as object)) ? opts : {}) as { silent?: boolean; overwriteVersion?: number; then?: () => void };
    const state = canvasStateRef.current;
    if (!state || (state.nodes.length === 0 && !workflowData)) return false;
    if (isSavingRef.current) return false;

    isSavingRef.current = true;
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
        // Update existing, but only if nobody saved a newer version meanwhile
        const base = overwriteVersion ?? savedVersion;
        res = await fetch(`/api/workflows/${savedWorkflowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, ...(base !== null && base !== undefined ? { base_version: base } : {}) }),
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
        setSavedVersion(typeof data.workflow.version === "number" ? data.workflow.version : null);
        setLastSaved(new Date());
        setSidebarRefreshKey((k) => k + 1);
        setHasUnsavedChanges(false);
        setConflict(null);
        if (!silent) showToast("Workflow saved successfully!", "success");
        return true;
      }
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setConflict({ currentVersion: typeof data.current_version === "number" ? data.current_version : 0, then });
        return false;
      }
      const data = await res.json().catch(() => ({}));
      showToast(silent ? "Autosave failed. Your changes are still here." : data.error || "Failed to save workflow", "error");
      return false;
    } catch (error) {
      console.error("Save failed:", error);
      showToast(silent ? "Autosave failed. Your changes are still here." : "Something went wrong while saving", "error");
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [workflowName, workflowData, savedWorkflowId, savedVersion]);

  // ── Load a saved workflow from the database ──
  const loadWorkflowNow = useCallback(async (id: string, force = false) => {
    setShowDashboard(false);
    setSidebarView("nodes");
    if (id === savedWorkflowId && !force && !loadError) return; // Already loaded
    resetExecution();
    setLoadError(null);

    // Leave a coherent empty canvas behind when a workflow can't be opened (never a half-loaded one)
    const fail = (kind: "notfound" | "failed") => {
      setWorkflowData({ nodes: [], edges: [] });
      setSavedWorkflowId(null);
      setSavedVersion(null);
      setLastSaved(null);
      setWorkflowName("Untitled Workflow");
      setHasUnsavedChanges(false);
      setLoadError({ id, kind });
    };

    try {
      const res = await fetch(`/api/workflows/${id}`);
      if (!res.ok) {
        fail(res.status === 404 ? "notfound" : "failed");
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
        sourceHandle: e.sourceHandle,
      }));

      setWorkflowData({
        nodes: normalizedNodes,
        edges: normalizedEdges,
      });
      setSavedWorkflowId(wf.id);
      setSavedVersion(typeof wf.version === "number" ? wf.version : null);
      setIsLive(wf.is_active !== false);
      setWorkflowName(wf.name || "Untitled Workflow");
      setLastSaved(new Date(wf.updated_at));
      setHasUnsavedChanges(false);
      showToast(`Loaded "${wf.name}"`, "success");
      setChatResetKey((k) => k + 1);
    } catch (error) {
      console.error("Load failed:", error);
      fail("failed");
    }
  }, [savedWorkflowId, loadError, resetExecution]);

  // Initial load if ID exists in URL slug
  const initialLoadStartedRef = useRef(false);
  useEffect(() => {
    if (initId && !workflowData && !initialLoadStartedRef.current) {
      initialLoadStartedRef.current = true; // once only: re-renders and dev double-effects would load (and toast) twice
      loadWorkflowNow(initId, true);
    }
  }, [initId, loadWorkflowNow, workflowData]);

  // URL routing synchronization
  useEffect(() => {
    let newPath = "/home";
    if (showDashboard) {
      newPath = "/home";
    } else if (sidebarView === "templates") {
      newPath = "/templates";
    } else if (sidebarView === "workflows") {
      newPath = "/workflows";
    } else if (sidebarView === "settings") {
      newPath = "/settings";
    } else if (sidebarView === "runs") {
      newPath = "/runs";
    } else if (savedWorkflowId) {
      newPath = `/workflows/${savedWorkflowId}`;
    } else if (sidebarView === "nodes") {
      newPath = "/workflows";
    }

    // Compare with the real location: usePathname() does not follow history.replaceState
    const current = window.location.pathname.replace(/\/$/, "") || "/";
    if (current !== newPath) {
      // History API instead of router.replace(): a real navigation changes the
      // [[...slug]] param, which remounts this whole page and wipes the canvas and chat.
      window.history.replaceState(window.history.state, "", newPath);
    }
  }, [showDashboard, savedWorkflowId, sidebarView]);

  // ── Create a fresh canvas ──
  const newWorkflowNow = useCallback(() => {
    setShowDashboard(false);
    setSidebarView("nodes");
    setLoadError(null);
    setIsLive(true);
    setWorkflowData({ nodes: [], edges: [] });
    setSavedWorkflowId(null);
    setSavedVersion(null);
    setLastSaved(null);
    setWorkflowName("Untitled Workflow");
    setHasUnsavedChanges(false);
    setChatResetKey((k) => k + 1);
    resetExecution();
    showToast("New workflow created", "success");
  }, [resetExecution]);

  // ── Load a template's exact graph straight onto the canvas (no AI call) ──
  const loadTemplateNow = useCallback((id: string) => {
    const template = getTemplate(id);
    if (!template) return;
    setShowDashboard(false);
    setSidebarView("nodes");
    setPanelOpen(false);
    setLoadError(null);
    setIsLive(true);
    setWorkflowData(toEditorWorkflow(template));
    setSavedWorkflowId(null);
    setSavedVersion(null);
    setLastSaved(null);
    setWorkflowName(template.name);
    setHasUnsavedChanges(true);
    setChatResetKey((k) => k + 1);
    resetExecution();
    showToast(`Loaded "${template.name}"`, "success");
  }, [resetExecution]);

  // ── Guard: anything that replaces the canvas goes through here ──
  const guard = useCallback((action: () => void) => {
    if (hasUnsavedChanges && (canvasStateRef.current?.nodes.length ?? 0) > 0) setLeavePrompt({ action });
    else action();
  }, [hasUnsavedChanges]);

  const handleLoadWorkflow = useCallback((id: string, force = false) => {
    if (id === savedWorkflowId && !force && !loadError) {
      // Already open: just bring the editor forward, nothing is replaced
      setShowDashboard(false);
      setSidebarView("nodes");
      return;
    }
    guard(() => { loadWorkflowNow(id, force); });
  }, [guard, loadWorkflowNow, savedWorkflowId, loadError]);
  const handleNewWorkflow = useCallback(() => guard(newWorkflowNow), [guard, newWorkflowNow]);
  const handleUseTemplateId = useCallback((id: string) => guard(() => loadTemplateNow(id)), [guard, loadTemplateNow]);

  // Closing or reloading the tab with unsaved work shows the browser's own warning
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (e: BeforeUnloadEvent) => {
      if ((canvasStateRef.current?.nodes.length ?? 0) === 0) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  // Opt-in autosave: only for workflows that already exist (it never creates new ones) and never mid-run or mid-generation
  useEffect(() => {
    if (!autosave || !savedWorkflowId || !hasUnsavedChanges || isGenerating || executionStatus === "running" || conflict || leavePrompt || loadError) return;
    const t = setTimeout(() => { handleSave({ silent: true }); }, 3000);
    return () => clearTimeout(t);
  }, [autosave, savedWorkflowId, hasUnsavedChanges, editTick, isGenerating, executionStatus, conflict, leavePrompt, loadError, handleSave]);

  // Dialog actions
  const leaveKeep = () => { if (!leaveSaving) setLeavePrompt(null); };
  const leaveDiscard = () => {
    const action = leavePrompt?.action;
    setLeavePrompt(null);
    action?.();
  };
  const leaveSave = async () => {
    if (!leavePrompt) return;
    const action = leavePrompt.action;
    setLeaveSaving(true);
    const ok = await handleSave({ then: action });
    setLeaveSaving(false);
    setLeavePrompt(null);
    if (ok) action(); // on a conflict the conflict dialog takes over and runs it after the user decides
  };
  const conflictOverwrite = async () => {
    if (!conflict) return;
    const then = conflict.then;
    setConflictBusy(true);
    const ok = await handleSave({ overwriteVersion: conflict.currentVersion });
    setConflictBusy(false);
    if (ok) then?.();
  };
  const conflictLoadLatest = async () => {
    if (!conflict) return;
    const then = conflict.then;
    setConflict(null);
    if (then) { then(); return; } // they were on their way somewhere else anyway
    if (savedWorkflowId) {
      setConflictBusy(true);
      await loadWorkflowNow(savedWorkflowId, true);
      setConflictBusy(false);
    }
  };

  // ── Handle deletion of workflows from the sidebar ──
  const handleWorkflowDeleted = useCallback((id: string) => {
    // Always trigger a refresh so the Dashboard's "Recent Workflows" list updates
    setSidebarRefreshKey((k) => k + 1);

    if (id === savedWorkflowId) {
      // Clear the canvas if the active workflow was deleted
      resetExecution();
      setWorkflowData({ nodes: [], edges: [] });
      setSavedWorkflowId(null);
      setSavedVersion(null);
      setLastSaved(null);
      setWorkflowName("Untitled Workflow");
      setHasUnsavedChanges(false);
      setChatResetKey((k) => k + 1);
    }
  }, [savedWorkflowId, resetExecution]);

  // ── Pause / resume (Live switch) ──
  const handleToggleLive = useCallback(async () => {
    if (!savedWorkflowId) return;
    const next = !isLive;
    setIsLive(next); // optimistic
    try {
      const res = await fetch(`/api/workflows/${savedWorkflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
      if (!res.ok) throw new Error();
      setSidebarRefreshKey((k) => k + 1);
      showToast(next ? "Workflow is live" : "Workflow paused. It will not answer webhooks or run on its schedule.", "success");
    } catch {
      setIsLive(!next);
      showToast("Couldn't change that. Try again.", "error");
    }
  }, [savedWorkflowId, isLive]);

  // ── Rename workflow ──
  const handleNameChange = useCallback(async (newName: string) => {
    setWorkflowName(newName);
    // If already saved, persist the name change (against the version we know, so it can't clobber a newer copy)
    if (savedWorkflowId) {
      try {
        const res = await fetch(`/api/workflows/${savedWorkflowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName, ...(savedVersion !== null ? { base_version: savedVersion } : {}) }),
        });
        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          setConflict({ currentVersion: typeof data.current_version === "number" ? data.current_version : 0 });
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (typeof data.workflow?.version === "number") setSavedVersion(data.workflow.version);
        showToast(`Renamed to "${newName}"`, "success");
        setSidebarRefreshKey((k) => k + 1);
      } catch {
        showToast("Failed to rename", "error");
      }
    }
  }, [savedWorkflowId, savedVersion]);

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
      resetExecution();
      setWorkflowData({ nodes: [], edges: [] });
      setSavedWorkflowId(null);
      setSavedVersion(null);
      setLastSaved(null);
      setWorkflowName("Untitled Workflow");
      setHasUnsavedChanges(false);
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

    if (runningRef.current) {
      showToast("A run is already in progress", "error");
      return;
    }
    runningRef.current = true;
    const token = ++runTokenRef.current;
    const controller = new AbortController();
    runAbortRef.current = controller;
    const stale = () => token !== runTokenRef.current;

    setIsConsoleOpen(true);
    setExecutionStatus("running");
    setExecutionLogs([]);
    setNodeResults({});

    // Reset all nodes to idle initially
    const initialNodeStates: Record<string, NodeRunStatus> = {};
    state.nodes.forEach(n => initialNodeStates[n.id] = "idle");
    setNodeExecutionStates(initialNodeStates);

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ ...state, nodeIdToRun, workflowId: savedWorkflowId ?? undefined }),
      });

      if (!res.ok) throw new Error("Failed to start execution");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done || stale()) break;

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

          if (eventData && !stale()) {
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
                if (data.result) setNodeResults(prev => ({ ...prev, [data.nodeId]: data.result }));
              }
            } catch (e) {
              console.error("Failed to parse SSE data", e);
            }
          }
        }
      }
    } catch (error) {
      if (stale() || (error as Error)?.name === "AbortError") return; // the workflow was switched while running
      console.error(error);
      setExecutionStatus("failed");
      setExecutionLogs(prev => [...prev, {
        id: "err", timestamp: new Date(), message: "Failed to connect to execution engine", type: "error"
      }]);
    } finally {
      // Always free the Run button, even if the stream ended without a final "complete" event
      if (!stale()) {
        runningRef.current = false;
        setExecutionStatus((prev) => (prev === "running" ? "failed" : prev));
      }
    }
  }, [savedWorkflowId]);

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

  const handleViewChange = useCallback((view: SidebarView) => {
    setSidebarView(view);
    setShowDashboard(view === "home");
    // On small screens the panel is the content of the chosen view, so open it
    setPanelOpen(view === "nodes");
  }, []);

  // Home, Templates, Workflows and Settings are full-width pages; everything else is the editor (panel + canvas + Ask DevFlow)
  const showGallery = sidebarView === "templates" && !showDashboard;
  const showWorkflows = sidebarView === "workflows" && !showDashboard;
  const showSettings = sidebarView === "settings" && !showDashboard;
  const showRuns = sidebarView === "runs" && !showDashboard;
  const fullPage = showDashboard || showGallery || showWorkflows || showSettings || showRuns;

  return (
    <div className="flex h-screen w-screen gap-3 overflow-hidden bg-background p-3 font-sans text-foreground">
      {/* 1. Left navigation (md and up) */}
      <AppSidebar
        currentView={sidebarView}
        activeWorkflowId={savedWorkflowId}
        onViewChange={handleViewChange}
        onNewWorkflow={handleNewWorkflow}
        onOpenWorkflow={(id) => handleLoadWorkflow(id)}
        refreshKey={sidebarRefreshKey}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
      {/* Compact top bar (below md) */}
      <TopNav
        currentView={sidebarView}
        onViewChange={handleViewChange}
        onNewWorkflow={handleNewWorkflow}
      />

      <div className="flex min-h-0 flex-1 gap-3">
        {/* 2. Contextual left panel (hidden on the dashboard) */}
        {panelOpen && !fullPage && (
          <div className="fixed inset-0 z-[45] bg-black/30 lg:hidden" onClick={() => setPanelOpen(false)} aria-hidden />
        )}
        <Sidebar
          className={cn(
            "max-lg:fixed max-lg:inset-y-3 max-lg:left-3 max-lg:z-50 max-lg:h-auto max-lg:w-[min(320px,calc(100vw-24px))] max-lg:shadow-2xl",
            !panelOpen && "max-lg:hidden",
            fullPage && "hidden",
            libraryCollapsed && "lg:hidden"
          )}
          onNodeAdded={() => setPanelOpen(false)}
          onCollapse={() => setCollapsedPersist(true)}
          currentView={sidebarView}
        />

        {/* 3. Main column */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {!fullPage && (
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
              onDelete={() => (savedWorkflowId ? setConfirmingDelete(true) : showToast("Workflow not saved yet", "error"))}
              autosave={autosave}
              onToggleAutosave={toggleAutosave}
              isLive={isLive}
              onToggleLive={savedWorkflowId ? handleToggleLive : undefined}
              onRunWorkflow={handleRunWorkflow}
              isRunning={executionStatus === "running"}
              onBack={() => handleViewChange("workflows")}
            />
          )}

          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-card">
            {/* Dashboard View */}
            <div className={cn("absolute inset-0 z-10 bg-card transition-opacity duration-200", showDashboard ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")}>
              <HomeDashboard
                onLoadWorkflow={(id) => handleLoadWorkflow(id)}
                onNewWorkflow={handleNewWorkflow}
                onUseTemplate={(prompt) => guard(() => {
                  // Only once it's certain the canvas is being replaced, so the prompt can't land on the old workflow
                  setPendingPrompt(prompt);
                  newWorkflowNow();
                })}
                onUseTemplateId={handleUseTemplateId}
                onViewAllTemplates={() => {
                  handleViewChange("templates");
                }}
                refreshKey={sidebarRefreshKey}
              />
            </div>

            {/* Settings (full page) */}
            {showSettings && (
              <div className="absolute inset-0 z-10 bg-card">
                <SettingsPage />
              </div>
            )}

            {/* Runs (full page) */}
            {showRuns && (
              <div className="absolute inset-0 z-10 bg-card">
                <RunsPage onOpenWorkflow={(id) => handleLoadWorkflow(id)} onBrowseWorkflows={() => handleViewChange("workflows")} />
              </div>
            )}

            {/* Workflows (full page) */}
            {showWorkflows && (
              <div className="absolute inset-0 z-10 bg-card">
                <WorkflowsPage
                  onOpen={(id) => handleLoadWorkflow(id)}
                  onNew={handleNewWorkflow}
                  onBrowseTemplates={() => handleViewChange("templates")}
                  onChanged={() => setSidebarRefreshKey((k) => k + 1)}
                  onDeleted={handleWorkflowDeleted}
                  refreshKey={sidebarRefreshKey}
                />
              </div>
            )}

            {/* Template gallery (full page) */}
            {showGallery && (
              <div className="absolute inset-0 z-10 bg-card">
                <TemplateGallery onUseTemplate={handleUseTemplateId} />
              </div>
            )}

            {/* A workflow link that didn't open */}
            {loadError && !fullPage && (
              <LoadErrorState
                kind={loadError.kind}
                onBack={() => handleViewChange("workflows")}
                onRetry={() => loadWorkflowNow(loadError.id, true)}
                onNew={newWorkflowNow}
              />
            )}

            {/* Canvas View */}
            <div className={cn("absolute inset-0 transition-opacity duration-200", !fullPage ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")}>
              {/* Node library toggle: sheet below lg, shown on desktop only while the panel is collapsed */}
              <button
                onClick={handleTogglePanel}
                aria-label="Open node library"
                className={cn(
                  "absolute left-4 top-4 z-20 flex h-10 items-center gap-2 rounded-full border border-border bg-card pl-3.5 pr-4 text-sm font-medium shadow-card transition-transform hover:scale-[1.03] active:scale-95",
                  !libraryCollapsed && "lg:hidden"
                )}
              >
                <PanelLeft className="h-4 w-4" />
                Nodes
              </button>

              <WorkflowCanvas
                workflowData={workflowData}
                isGenerating={isGenerating}
                canvasStateRef={canvasStateRef}
                onUnsavedChange={() => { setHasUnsavedChanges(true); setEditTick((t) => t + 1); }}
                nodeStates={nodeExecutionStates}
                nodeResults={nodeResults}
                workflowId={savedWorkflowId}
                isLive={isLive}
              />

              <ExecutionConsole
                isOpen={isConsoleOpen}
                onClose={() => setIsConsoleOpen(false)}
                onOpen={() => setIsConsoleOpen(true)}
                logs={executionLogs}
                status={executionStatus}
              />
            </div>
          </div>
        </div>

        {/* 4. Ask DevFlow chat, docked on the right (kept mounted so templates can auto-generate) */}
        <div className={cn("shrink-0 max-xl:fixed max-xl:inset-y-3 max-xl:right-3 max-xl:z-40", fullPage && "hidden")}>
          <ChatPanel
            ref={chatRef}
            getCurrentWorkflow={() => canvasStateRef.current}
            onWorkflowGenerated={handleWorkflowGenerated}
            onGenerationStart={() => setIsGenerating(true)}
            canvasIsDirty={hasUnsavedChanges}
            resetKey={chatResetKey}
            pendingPrompt={pendingPrompt}
            onPendingPromptConsumed={() => setPendingPrompt(null)}
          />
        </div>
      </div>
      </div>
      <UnsavedChangesDialog open={!!leavePrompt} saving={leaveSaving} onKeep={leaveKeep} onDiscard={leaveDiscard} onSave={leaveSave} />
      <ConflictDialog open={!!conflict} busy={conflictBusy} onOverwrite={conflictOverwrite} onLoadLatest={conflictLoadLatest} onCancel={() => { if (!conflictBusy) setConflict(null); }} />
      <ConfirmDeleteDialog
        open={confirmingDelete}
        name={workflowName}
        busy={deleting}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => { setDeleting(true); await handleDeleteWorkflow(); setDeleting(false); setConfirmingDelete(false); }}
      />
    </div>
  );
}
