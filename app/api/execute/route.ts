import { NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = 'force-dynamic';

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { nodes, edges, nodeIdToRun } = body;

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
        return NextResponse.json({ error: "No nodes provided" }, { status: 400 });
    }

    // Set up SSE headers
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            function sendEvent(type: string, data: any) {
                const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            }

            try {
                sendEvent("info", { message: "Initializing execution engine..." });
                await sleep(500);

                // Build a quick map for edges to find children easily
                // For a given node ID, what are the target node IDs?
                const adjacencyList: Record<string, string[]> = {};
                edges?.forEach((edge: any) => {
                    if (!adjacencyList[edge.source]) {
                        adjacencyList[edge.source] = [];
                    }
                    adjacencyList[edge.source].push(edge.target);
                });

                // Find trigger node(s) or the specific node to run
                let startingNodes = [];
                if (nodeIdToRun) {
                    const specificNode = nodes.find((n: any) => n.id === nodeIdToRun);
                    if (specificNode) {
                        startingNodes.push(specificNode);
                    } else {
                        sendEvent("error", { message: `Node with ID ${nodeIdToRun} not found.` });
                        sendEvent("workflow-complete", { status: "failed" });
                        controller.close();
                        return;
                    }
                    sendEvent("info", { message: `Starting isolated execution for node: ${specificNode.data?.label || nodeIdToRun}` });
                } else {
                    startingNodes = nodes.filter((n: any) => n.data?.type === 'trigger');
                    if (startingNodes.length === 0) {
                        sendEvent("error", { message: "No trigger node found in workflow." });
                        sendEvent("workflow-complete", { status: "failed" });
                        controller.close();
                        return;
                    }
                    sendEvent("info", { message: `Found ${startingNodes.length} trigger(s). Starting execution.` });
                }

                await sleep(500);

                const queue = [...startingNodes];
                const visited = new Set<string>();

                while (queue.length > 0) {
                    const currentNode = queue.shift();
                    if (!currentNode || visited.has(currentNode.id)) continue;

                    visited.add(currentNode.id);
                    const nodeId = currentNode.id;
                    const nodeLabel = currentNode.data?.label || "Unknown Node";

                    // 1. Mark Node as Running
                    sendEvent("node-started", { nodeId });
                    sendEvent("log", { nodeId, message: `Starting: ${nodeLabel}`, type: "info" });

                    // 2. Simulate processing time (0.8s to 2s)
                    const processingTime = Math.floor(Math.random() * 1200) + 800;

                    // Send some intermediate logs based on node type
                    await sleep(processingTime / 3);
                    if (currentNode.data?.type === 'trigger') {
                        sendEvent("log", { nodeId, message: "Listening for incoming payload...", type: "info" });
                        await sleep(processingTime / 3);
                        sendEvent("log", { nodeId, message: "Payload received successfully. 1 record found.", type: "success" });
                    } else if (currentNode.data?.type === 'action') {
                        sendEvent("log", { nodeId, message: `Connecting to ${currentNode.data?.config?.provider || 'external service'}...`, type: "info" });
                        await sleep(processingTime / 3);
                        sendEvent("log", { nodeId, message: "Data processed and action completed.", type: "success" });
                    } else {
                        sendEvent("log", { nodeId, message: "Processing logic conditions...", type: "info" });
                        await sleep(processingTime / 3);
                        sendEvent("log", { nodeId, message: "Conditions evaluated.", type: "success" });
                    }

                    await sleep(processingTime / 3);

                    // Random subtle failure chance (5%) for realism in a demo
                    // But we want a "Happy Path" demo most times, so let's stick to success unless it's specifically named 'fail'
                    const forceFail = nodeLabel.toLowerCase().includes('fail');

                    if (forceFail) {
                        sendEvent("log", { nodeId, message: "Critical error encountered during execution.", type: "error" });
                        sendEvent("node-finished", { nodeId, status: "failed" });

                        sendEvent("error", { message: `Workflow halted due to failure at node: ${nodeLabel}` });
                        sendEvent("workflow-complete", { status: "failed" });
                        controller.close();
                        return;
                    }

                    // 3. Mark Node as Success
                    sendEvent("node-finished", { nodeId, status: "success" });

                    // 4. Enqueue children (only if we're not running an isolated node)
                    if (!nodeIdToRun) {
                        const childrenIds = adjacencyList[nodeId] || [];
                        for (const childId of childrenIds) {
                            const childNode = nodes.find((n: any) => n.id === childId);
                            if (childNode && !visited.has(childId)) {
                                queue.push(childNode);
                            }
                        }

                        if (childrenIds.length > 0) {
                            sendEvent("log", { message: `Routing data to ${childrenIds.length} connected node(s)...`, type: "info" });
                            await sleep(300);
                        }
                    } else {
                        sendEvent("log", { message: "Isolated node execution completed. Downstream nodes skipped.", type: "info" });
                    }
                }

                sendEvent("success", { message: "Workflow executed successfully!" });
                sendEvent("workflow-complete", { status: "success" });

            } catch (err: any) {
                sendEvent("error", { message: `Execution error: ${err.message}` });
                sendEvent("workflow-complete", { status: "failed" });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
