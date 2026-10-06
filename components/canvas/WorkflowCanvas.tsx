"use client";

import type { NodeRunStatus, NodeRunResult } from "@/lib/run-types";
import { useCallback, useEffect, useRef, MutableRefObject, useState } from "react";
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    Node,
    Edge,
    Connection,
    addEdge,
    useNodesState,
    useEdgesState,
    ConnectionMode,
    MarkerType,
    ReactFlowProvider,
    useReactFlow,
    Panel,
    getNodesBounds,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import ProNode, { ProNodeData } from "./nodes/ProNode";
import WorkflowLoadingOverlay from "./WorkflowLoadingOverlay";
import { flattenConfig, isSwitchNode, namedBranches, switchCases } from "@/lib/engine/switch";
import NodeConfigPanel from "./NodeConfigPanel";
import { Wand2 } from "lucide-react";
import { editorPositions, type DemoGraph } from "@/lib/demo-graph";

const nodeTypes = {
    pro: ProNode,
};

const EDGE_COLOR = "hsl(var(--muted-foreground) / 0.55)";
const EDGE_LIVE = "hsl(var(--foreground))";
const EDGE_DONE = "hsl(152 60% 42%)";

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

type WorkflowData = {
    nodes: any[];
    edges: any[];
};

interface WorkflowCanvasProps {
    workflowData?: WorkflowData | null;
    isGenerating?: boolean;
    canvasStateRef?: MutableRefObject<{ nodes: any[]; edges: any[] } | null>;
    onUnsavedChange?: () => void;
    nodeStates?: Record<string, NodeRunStatus>;
    nodeResults?: Record<string, NodeRunResult>;
    workflowId?: string | null;
    isLive?: boolean;
}

function WorkflowCanvasInner({ workflowData, isGenerating, canvasStateRef, onUnsavedChange, nodeStates, nodeResults, workflowId, isLive }: WorkflowCanvasProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<Node<ProNodeData> | null>(null);
    const { fitView, screenToFlowPosition, getNodes, getEdges, setViewport } = useReactFlow();
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Never shrink the graph below a readable size. If the whole flow fits at a readable zoom,
    // fit it; otherwise open at the readable zoom anchored on the START of the flow and let the
    // user pan down (the minimap shows where they are).
    const MIN_READABLE_ZOOM = 0.7;
    const smartFit = useCallback(() => {
        const ns = getNodes();
        const el = wrapperRef.current;
        if (!ns.length || !el) return;
        const b = getNodesBounds(ns);
        const vw = el.clientWidth;
        const vh = el.clientHeight;
        const fit = Math.min((vw * 0.85) / Math.max(b.width, 1), (vh * 0.85) / Math.max(b.height, 1));
        if (fit >= MIN_READABLE_ZOOM) {
            fitView({ padding: 0.15, duration: 400, maxZoom: 1 });
            return;
        }
        const zoom = MIN_READABLE_ZOOM;
        setViewport({ x: vw / 2 - (b.x + b.width / 2) * zoom, y: 28 - b.y * zoom, zoom }, { duration: 400 });
    }, [getNodes, fitView, setViewport]);

    // "Tidy up": re-space the nodes into a compact layered layout and refit
    const tidyUp = useCallback(() => {
        const ns = getNodes();
        if (!ns.length) return;
        const graph: DemoGraph = {
            title: "",
            nodes: ns.map((n) => ({ id: n.id, type: "action", label: "", description: "" })),
            edges: getEdges().map((e) => ({ source: e.source, target: e.target })),
        };
        const pos = editorPositions(graph, 330, 150);
        setNodes((nds) => nds.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })));
        onUnsavedChange?.();
        setTimeout(smartFit, 80);
    }, [getNodes, getEdges, setNodes, onUnsavedChange, smartFit]);

    // Keep canvas state ref in sync for external reads (e.g. Save)
    useEffect(() => {
        if (canvasStateRef) {
            canvasStateRef.current = { nodes, edges };
        }
    }, [nodes, edges, canvasStateRef]);

    // Other floating layers (logs drawer, chat button) adapt to the settings panel through this flag
    useEffect(() => {
        if (selectedNode) document.body.dataset.nodePanel = "open";
        else delete document.body.dataset.nodePanel;
        return () => {
            delete document.body.dataset.nodePanel;
        };
    }, [selectedNode]);

    const handleNodesChange = useCallback((changes: any) => {
        onNodesChange(changes);
        const shouldSave = changes.some(
            (c: any) => c.type === "remove" || c.type === "add" || (c.type === "position" && c.dragging === false)
        );
        if (shouldSave) onUnsavedChange?.();
    }, [onNodesChange, onUnsavedChange]);

    // Listen for 'edit-node-config' events from node dropdown menu
    useEffect(() => {
        const handleEditNodeConfig = (e: CustomEvent<{ id: string }>) => {
            const nodeToEdit = nodes.find(n => n.id === e.detail.id);
            if (nodeToEdit) {
                setSelectedNode(nodeToEdit as Node<ProNodeData>);
            }
        };

        window.addEventListener('edit-node-config', handleEditNodeConfig as EventListener);
        return () => {
            window.removeEventListener('edit-node-config', handleEditNodeConfig as EventListener);
        };
    }, [nodes]);

    // Tap-to-add from the node library (drag-and-drop doesn't exist on touch screens)
    useEffect(() => {
        const handleAddNode = (e: CustomEvent<{ type: string; label: string; description?: string; config?: Record<string, any> }>) => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return;
            const jitter = () => (Math.random() - 0.5) * 80;
            const position = screenToFlowPosition({
                x: rect.left + rect.width / 2 - 130 + jitter(),
                y: rect.top + rect.height / 2 - 40 + jitter(),
            });
            const d = e.detail;
            const newNode: Node = {
                id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                type: "pro",
                position,
                data: { type: d.type, label: d.label, description: d.description || "", status: "idle", config: d.config || {} },
            };
            setNodes((nds) => nds.concat(newNode));
            onUnsavedChange?.();
        };
        window.addEventListener("devflow:add-node", handleAddNode as EventListener);
        return () => window.removeEventListener("devflow:add-node", handleAddNode as EventListener);
    }, [screenToFlowPosition, setNodes, onUnsavedChange]);

    // Update string status when execution states change from page.tsx passing `nodeStates`
    useEffect(() => {
        if (!nodeStates) return;

        setNodes((nds) =>
            nds.map((node) => {
                const updatedStatus = nodeStates[node.id];
                if (updatedStatus && node.data.status !== updatedStatus) {
                    return { ...node, data: { ...node.data, status: updatedStatus } };
                }
                return node;
            })
        );
    }, [nodeStates, setNodes]);

    // Light up edges while a run is in progress: live edges flow, finished ones turn green
    useEffect(() => {
        if (!nodeStates) return;
        setEdges((eds) =>
            eds.map((edge) => {
                const src = nodeStates[edge.source];
                const tgt = nodeStates[edge.target];
                const live = tgt === "running";
                const ok = (s?: NodeRunStatus) => s === "success" || s === "simulated";
                const done = ok(src) && (ok(tgt) || tgt === "running");
                const stroke = live ? EDGE_LIVE : done ? EDGE_DONE : EDGE_COLOR;
                const next = { stroke, strokeWidth: live || done ? 2.25 : 1.75 };
                const prev = edge.style as any;
                if (prev?.stroke === next.stroke && !!edge.animated === live) return edge;
                return { ...edge, animated: live, style: { ...edge.style, ...next } };
            })
        );
    }, [nodeStates, setEdges]);

    // Update canvas when new workflow is generated
    useEffect(() => {
        if (workflowData) {
            const formattedNodes: Node[] = workflowData.nodes.map((node, index) => {
                const config = flattenConfig(node.config || node.data || {});
                // A logic node whose branches have names (urgent / normal / ...) is a Switch
                if (node.type === "logic" && !isSwitchNode(node.label, config)) {
                    const names = namedBranches(workflowData.edges as any, node.id);
                    if (names.length) config.cases = names.join(", ");
                }
                return {
                    id: node.id,
                    type: "pro",
                    position: { x: node.position?.x ?? 250, y: node.position?.y ?? (50 + index * 200) },
                    data: {
                        type: node.type,
                        label: node.label,
                        description: node.description,
                        status: "idle",
                        config,
                        revealIndex: index,
                    },
                };
            });
            const switchById = new Map(formattedNodes.filter((n) => n.data.type === "logic" && isSwitchNode(String(n.data.label), n.data.config as any)).map((n) => [n.id, switchCases(n.data.config as any)]));

            const formattedEdges: Edge[] = workflowData.edges.map((edge) => {
                // Branches arrive as a "true"/"false" label (templates, AI) or, once saved, as a sourceHandle
                const fromSwitch = switchById.has(edge.source);
                const branch = fromSwitch
                    ? (edge.sourceHandle ?? edge.label ?? undefined)
                    : [edge.sourceHandle, edge.label].find((v) => v === "true" || v === "false");
                const label = branch ? undefined : edge.label;
                return {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: branch,
                // true/false branches are already labelled Yes/No on the logic node's handles
                label,
                labelStyle: label ? { fill: "hsl(var(--foreground))", fontWeight: 600, fontSize: 11 } : undefined,
                labelBgStyle: label ? { fill: "hsl(var(--card))", fillOpacity: 1 } : undefined,
                labelBgPadding: [6, 3] as [number, number],
                labelBgBorderRadius: 8,
                style: { stroke: EDGE_COLOR, strokeWidth: 1.75 },
                };
            });

            setNodes(formattedNodes);
            setEdges(formattedEdges);

            // Auto-fit the view after nodes render
            setTimeout(smartFit, 150);
        }
    }, [workflowData, setNodes, setEdges, smartFit]);

    const onConnect = useCallback(
        (connection: Connection) => {
            setEdges((eds) => addEdge({
                ...connection,
                style: { stroke: EDGE_COLOR, strokeWidth: 1.75 }
            }, eds));
            onUnsavedChange?.();
        },
        [setEdges, onUnsavedChange]
    );

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNode(node as Node<ProNodeData>);
    }, []);

    const handleUpdateNode = useCallback((id: string, data: Partial<ProNodeData>) => {
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === id) return { ...n, data: { ...n.data, ...data } };
                return n;
            })
        );
        // Also update the selected node state so panel reflects changes immediately
        setSelectedNode((prev: Node<ProNodeData> | null) => prev?.id === id ? { ...prev, data: { ...prev.data, ...data } as ProNodeData } : prev);
        onUnsavedChange?.();
    }, [setNodes, onUnsavedChange]);

    const handleDeleteNode = useCallback((id: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        if (selectedNode?.id === id) {
            setSelectedNode(null);
        }
        onUnsavedChange?.();
    }, [setNodes, setEdges, selectedNode, onUnsavedChange]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const nodeDataStr = event.dataTransfer.getData('application/reactflow');
            if (!nodeDataStr) return;

            try {
                const nodeData = JSON.parse(nodeDataStr);
                const position = screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });

                const newNode: Node = {
                    id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    type: 'pro',
                    position,
                    data: {
                        type: nodeData.type,
                        label: nodeData.label,
                        description: nodeData.description || "",
                        status: "idle",
                        config: nodeData.config || {},
                    },
                };

                setNodes((nds) => nds.concat(newNode));
                // Automatically select the newly dropped node
                setTimeout(() => setSelectedNode(newNode as Node<ProNodeData>), 50);
                onUnsavedChange?.();
            } catch (err) {
                console.error("Failed to parse dropped node data", err);
            }
        },
        [screenToFlowPosition, setNodes, onUnsavedChange]
    );

    return (
        <div ref={wrapperRef} className="relative h-full w-full bg-muted/40">
            {isGenerating && <WorkflowLoadingOverlay />}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={(changes) => {
                    onEdgesChange(changes);
                    onUnsavedChange?.();
                }}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={() => setSelectedNode(null)}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "hsl(var(--muted-foreground) / 0.55)" },
                }}
                fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
                className="bg-transparent"
                proOptions={{ hideAttribution: true }}
            >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="hsl(var(--muted-foreground) / 0.3)" />
                <Panel position="top-right" className="!m-4">
                    <button
                        onClick={tidyUp}
                        title="Re-space the nodes into a compact layout"
                        className="flex h-10 items-center gap-2 rounded-full border border-border bg-card pl-3.5 pr-4 text-sm font-medium shadow-card transition-transform hover:scale-[1.03] active:scale-95"
                    >
                        <Wand2 className="h-4 w-4" />
                        Tidy up
                    </button>
                </Panel>
                <Controls position="bottom-left" showInteractive={false} />
                <MiniMap
                    pannable
                    zoomable
                    className="!hidden xl:!block"
                    position="bottom-right"
                    style={{ width: 150, height: 100, background: "hsl(var(--card))" }}
                    nodeBorderRadius={6}
                    nodeColor={(node) => {
                        const type = node.data.type;
                        if (type === "trigger") return "hsl(258 90% 62%)";
                        if (type === "logic") return "hsl(27 95% 55%)";
                        if (type === "data") return "hsl(205 90% 50%)";
                        return "hsl(0 0% 15%)";
                    }}
                    maskColor="hsl(var(--background) / 0.7)"
                />
            </ReactFlow>

            {selectedNode && (
                <NodeConfigPanel
                    node={selectedNode}
                    workflowId={workflowId}
                    isLive={isLive}
                    result={selectedNode ? nodeResults?.[selectedNode.id] : undefined}
                    onClose={() => setSelectedNode(null)}
                    onUpdateNode={handleUpdateNode}
                    onDeleteNode={handleDeleteNode}
                />
            )}
        </div>
    );
}

// Wrapper with ReactFlowProvider to enable useReactFlow hook
export default function WorkflowCanvas(props: WorkflowCanvasProps) {
    return (
        <ReactFlowProvider>
            <WorkflowCanvasInner {...props} />
        </ReactFlowProvider>
    );
}
