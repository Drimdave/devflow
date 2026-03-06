import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY?.trim(),
});

// Define the workflow schema
const WORKFLOW_SCHEMA = {
    type: "object",
    properties: {
        nodes: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    type: { type: "string", enum: ["trigger", "action", "logic"] },
                    label: { type: "string" },
                    description: { type: "string" },
                    config: { type: "object" },
                },
                required: ["id", "type", "label", "description"],
            },
        },
        edges: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    source: { type: "string" },
                    target: { type: "string" },
                    label: { type: "string" },
                },
                required: ["id", "source", "target"],
            },
        },
    },
    required: ["nodes", "edges"],
};

const SYSTEM_PROMPT = `You are the DevFlow Architect, a specialized AI engine for generating executable automation workflows from natural language.

YOUR GOAL:
Parse the user's intent and generate a precise, logic-complete JSON graph.

### CORE RULES:
1. **Node Types:**
   - "trigger": The event that starts the flow (Webhook, Schedule, App Event).
   - "action": A task performed by a service (e.g., Gmail: Send Email, Slack: Post Message).
   - "logic": Control flow (If/Else, Merge, Loop, Delay).

2. **Data Passing (Crucial):**
   - You MUST attempt to map variables between nodes using valid syntax: \`{{node_id.data_field}}\`.
   - Example: If Node 1 gets a Lead, Node 2 should use \`{{1.email}}\` in the "To" field.

3. **Configuration Schema:**
   - Every node must have a \`data\` object containing:
     - \`provider\`: (e.g., "google", "slack", "http").
     - \`resource\`: (e.g., "message", "contact", "row").
     - \`operation\`: (e.g., "create", "get", "update").
     - \`parameters\`: Key-value pairs for the operation.

4. **Branching:**
   - Logic nodes (like If/Else) must have "edges" labeled "true" or "false" to indicate the path.

5. Layout & UI:
   - **Crucial:** Generate a **VERTICAL** flow (Top to Bottom).
   - **Spacing:**
     - Vertical step: Increase Y by **+300px** (give them breathing room).
     - Horizontal step: Shift X by **+500px** for branches.
   - **Branching Logic:**
     - "True" / "Success" path: Keep same X, increase Y.
     - "False" / "Failure" path: Shift X by +500, increase Y.
   - **Goal:** Maximum readability. No overlapping nodes or crossed wires.

6. **EDITING MODE (When CURRENT WORKFLOW JSON is provided):**
   - The user wants to MODIFY the existing workflow.
   - You MUST return the COMPLETE updated workflow with ALL existing nodes preserved.
   - COPY every existing node exactly as provided (same id, type, label, description, position, data).
   - Only ADD new nodes or REMOVE nodes the user explicitly asks to remove.
   - For new nodes, use IDs that don't conflict with existing ones.
   - Adjust positions of new nodes to fit into the flow (Y += 300 from the last node).
   - Update edges to connect new nodes into the flow.
   - CRITICAL: The output MUST contain at minimum every node from the input, plus any additions.

### RESPONSE FORMAT:
Return ONLY valid JSON. No markdown, no commentary.

### EXAMPLE OUTPUT:
{
  "nodes": [
    {
      "id": "trigger_1",
      "type": "trigger",
      "label": "New Webhook",
      "description": "Receives payload from Typeform",
      "position": { "x": 350, "y": 0 },
      "data": {
        "provider": "webhook",
        "resource": "payload",
        "operation": "receive",
        "parameters": { "method": "POST", "path": "/submit" }
      }
    },
    {
      "id": "logic_1",
      "type": "logic",
      "label": "Check Email",
      "description": "Filter corporate emails",
      "position": { "x": 350, "y": 300 },
      "data": {
        "provider": "filter",
        "resource": "condition",
        "operation": "contains",
        "parameters": {
          "value": "{{trigger_1.body.email}}",
          "match": "@company.com"
        }
      }
    },
    {
      "id": "action_1",
      "type": "action",
      "label": "Send Welcome Slack",
      "description": "Notify team channel",
      "position": { "x": 350, "y": 600 },
      "data": {
        "provider": "slack",
        "resource": "message",
        "operation": "post",
        "parameters": {
          "channel": "#leads",
          "text": "New lead: {{trigger_1.body.name}}"
        }
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "trigger_1", "target": "logic_1", "label": null },
    { "id": "e2", "source": "logic_1", "target": "action_1", "label": "true" }
  ]
}`;

export async function POST(request: NextRequest) {
    try {
        const reqHeaders = await headers();
        const session = await auth.api.getSession({ headers: reqHeaders });
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message, currentWorkflow } = await request.json();

        if (!message || typeof message !== "string") {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        const isEditMode = currentWorkflow && currentWorkflow.nodes && currentWorkflow.nodes.length > 0;

        // Build the user prompt — include existing workflow context if editing
        let userPrompt = message;
        if (isEditMode) {
            // Send full node data so the AI can faithfully preserve existing nodes
            const cleanNodes = currentWorkflow.nodes.map((n: any) => ({
                id: n.id,
                type: n.data?.nodeType || n.type,
                label: n.data?.label || n.label,
                description: n.data?.description || n.description || "",
                position: n.position,
                data: n.data?.provider ? {
                    provider: n.data.provider,
                    resource: n.data.resource,
                    operation: n.data.operation,
                    parameters: n.data.parameters || {},
                } : (n.data || {}),
            }));
            const cleanEdges = currentWorkflow.edges.map((e: any) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label || null,
            }));

            userPrompt = `CURRENT WORKFLOW (you MUST include ALL of these nodes in your output, plus any new ones):\n${JSON.stringify({ nodes: cleanNodes, edges: cleanEdges }, null, 2)}\n\nUSER REQUEST: ${message}`;
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: userPrompt,
                },
            ],
            model: "llama-3.3-70b-versatile", // Fast and powerful for workflow generation
            temperature: 0.2, // Even lower temp for editing consistency
            max_tokens: 4096,
        });

        const response = completion.choices[0]?.message?.content;

        if (!response) {
            throw new Error("No response from Groq");
        }

        // Parse and validate the JSON response
        let workflow;
        try {
            workflow = JSON.parse(response);
        } catch (e) {
            // If Groq returns markdown wrapped JSON, extract it
            const jsonMatch = response.match(/```(?:json)?\n?([\s\S]+?)\n?```/);
            if (jsonMatch) {
                workflow = JSON.parse(jsonMatch[1]);
            } else {
                throw new Error("Failed to parse workflow JSON");
            }
        }

        // Basic validation
        if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
            throw new Error("Invalid workflow: missing nodes array");
        }

        if (!workflow.edges || !Array.isArray(workflow.edges)) {
            throw new Error("Invalid workflow: missing edges array");
        }

        // SERVER-SIDE MERGE: If editing, ensure all original nodes are preserved
        if (isEditMode) {
            const aiNodeIds = new Set(workflow.nodes.map((n: any) => n.id));
            const originalNodes = currentWorkflow.nodes.map((n: any) => ({
                id: n.id,
                type: n.data?.nodeType || n.type,
                label: n.data?.label || n.label,
                description: n.data?.description || n.description || "",
                position: n.position,
                data: n.data?.provider ? {
                    provider: n.data.provider,
                    resource: n.data.resource,
                    operation: n.data.operation,
                    parameters: n.data.parameters || {},
                } : (n.data || {}),
            }));

            // Add back any original nodes the AI dropped
            for (const origNode of originalNodes) {
                if (!aiNodeIds.has(origNode.id)) {
                    workflow.nodes.push(origNode);
                }
            }

            // Preserve original edges that are still valid
            const aiEdgeKeys = new Set(workflow.edges.map((e: any) => `${e.source}->${e.target}`));
            const allNodeIds = new Set(workflow.nodes.map((n: any) => n.id));
            for (const origEdge of currentWorkflow.edges) {
                const key = `${origEdge.source}->${origEdge.target}`;
                if (!aiEdgeKeys.has(key) && allNodeIds.has(origEdge.source) && allNodeIds.has(origEdge.target)) {
                    workflow.edges.push({
                        id: origEdge.id,
                        source: origEdge.source,
                        target: origEdge.target,
                        label: origEdge.label || null,
                    });
                }
            }
        }

        return NextResponse.json({
            workflow,
            message: "Workflow generated successfully",
        });
    } catch (error: any) {
        console.error("Groq API Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate workflow" },
            { status: 500 }
        );
    }
}
