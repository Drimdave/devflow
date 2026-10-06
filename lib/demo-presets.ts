import type { DemoGraph } from "./demo-graph";
import { TEMPLATES, findTemplateByPrompt } from "./templates";

export interface DemoPreset {
    id: string;
    /** Text shown in the prompt box and on the chip. */
    prompt: string;
    graph: DemoGraph;
}

// The landing demo's chips are just the first few shared templates, and any typed prompt that
// matches a template renders instantly with no API call, so the public endpoint (and your Groq
// quota) only gets used for genuinely custom prompts.
export const DEMO_PRESETS: DemoPreset[] = TEMPLATES.slice(0, 3).map((t) => ({ id: t.id, prompt: t.prompt, graph: t.graph }));

export function findPreset(text: string): DemoPreset | undefined {
    const t = findTemplateByPrompt(text);
    return t ? { id: t.id, prompt: t.prompt, graph: t.graph } : undefined;
}
