"use client";

import { useCallback, useEffect, MutableRefObject, useState } from "react";
import ReactFlow, {
    Background,
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
} from "reactflow";
import "reactflow/dist/style.css";

import ProNode, { ProNodeData } from "./nodes/ProNode";
import WorkflowLoadingOverlay from "./WorkflowLoadingOverlay";
import NodeConfigPanel from "./NodeConfigPanel";

const nodeTypes = {
    pro: ProNode,
};

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
    nodeStates?: Record<string, "idle" | "running" | "success" | "failed">;
}

function WorkflowCanvasInner({ workflowData, isGenerating, canvasStateRef, onUnsavedChange, nodeStates }: WorkflowCanvasProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<Node<ProNodeData> | null>(null);
    const { fitView, screenToFlowPosition } = useReactFlow();

    // Keep canvas state ref in sync for external reads (e.g. Save)
    useEffect(() => {
        if (canvasStateRef) {
            canvasStateRef.current = { nodes, edges };
        }
    }, [nodes, edges, canvasStateRef]);

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

    // Update canvas when new workflow is generated
    useEffect(() => {
        if (workflowData) {
            const formattedNodes: Node[] = workflowData.nodes.map((node, index) => ({
                id: node.id,
                type: "pro",
                position: { x: node.position?.x ?? 250, y: node.position?.y ?? (50 + index * 200) },
                data: {
                    type: node.type,
                    label: node.label,
                    description: node.description,
                    status: "idle",
                    config: node.config || node.data || {},
                },
            }));

            const formattedEdges: Edge[] = workflowData.edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: (edge.label === "true" || edge.label === "false") ? edge.label : undefined,
                animated: true,
                label: edge.label,
                labelStyle: edge.label ? { fill: "hsl(var(--foreground))", fontWeight: 600 } : undefined,
                labelBgStyle: edge.label ? { fill: "hsl(var(--background))", fillOpacity: 0.8 } : undefined,
                style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 2 },
            }));

            setNodes(formattedNodes);
            setEdges(formattedEdges);

            // Auto-fit the view after nodes render
            setTimeout(() => {
                fitView({ padding: 0.15, duration: 400 });
            }, 100);
        }
    }, [workflowData, setNodes, setEdges, fitView]);

    const onConnect = useCallback(
        (connection: Connection) => {
            setEdges((eds) => addEdge({
                ...connection,
                animated: true,
                style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 2 }
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
        <div className="h-full w-full bg-background/50 relative">
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
                    markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--muted-foreground))" },
                }}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                className="bg-background"
            >
                <Background gap={20} size={1} color="hsl(var(--muted-foreground))" className="opacity-20" />
                <Controls className="!border-border !bg-card !fill-foreground [&>button]:!border-border [&>button]:!bg-background hover:[&>button]:!bg-accent" />
                <MiniMap
                    className="!border-border !bg-card"
                    nodeColor={(node) => {
                        const type = node.data.type;
                        if (type === "trigger") return "hsl(215 100% 50%)"; // Blue
                        if (type === "action") return "hsl(180 80% 45%)";   // Teal
                        if (type === "logic") return "hsl(40 95% 50%)";     // Amber
                        return "hsl(var(--muted))";
                    }}
                    maskColor="hsl(var(--background) / 0.8)"
                />
            </ReactFlow>

            {selectedNode && (
                <NodeConfigPanel
                    node={selectedNode}
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
