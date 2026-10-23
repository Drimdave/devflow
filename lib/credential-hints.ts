// Helpers for telling people what a generated workflow still needs before it can run.
// Pure functions with no framework imports, so they are covered by the plain node test runner.

/** Every {{secrets.NAME}} a workflow refers to, in order of first appearance. */
export function secretRefs(workflow: { nodes?: unknown[] } | null | undefined): string[] {
    const found: string[] = [];
    const seen = new Set<string>();
    const text = JSON.stringify(workflow?.nodes ?? []);
    for (const m of text.matchAll(/\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g)) {
        if (!seen.has(m[1])) {
            seen.add(m[1]);
            found.push(m[1]);
        }
    }
    return found;
}

/** The credentials a workflow uses that the account has not saved yet. */
export function missingCredentials(workflow: { nodes?: unknown[] } | null | undefined, savedNames: Iterable<string>): string[] {
    const saved = new Set(savedNames);
    return secretRefs(workflow).filter((name) => !saved.has(name));
}

const HINTS: Array<{ test: RegExp; text: string }> = [
    { test: /^SLACK/, text: "In Slack, create an Incoming Webhook for the channel and paste its URL." },
    { test: /^DISCORD/, text: "In Discord, open the channel's Integrations, create a Webhook and paste its URL." },
    { test: /^RESEND/, text: "Create an API key at resend.com/api-keys and paste it." },
    { test: /^(POSTGRES|DATABASE|NEON)/, text: "Paste your Neon connection string (Neon dashboard, Connect). Use a read-only role if you can." },
    {
        test: /^(GMAIL|GOOGLE)/,
        text: "DevFlow cannot connect to Gmail with one click yet. Calling Gmail directly needs a Google OAuth access token, which expires after about an hour, so this is not a practical setup today.",
    },
];

/** One plain sentence on where to get a credential, or a generic fallback. */
export function credentialHint(name: string): string {
    const hit = HINTS.find((h) => h.test.test(name.toUpperCase()));
    return hit ? hit.text : "Paste the API key or URL for this service. You can get it from the service's own settings or developer page.";
}

/** Pulls the credential name out of the engine's "isn't saved" error, or null for any other message. */
export function missingCredentialFromError(message: string): string | null {
    const m = /Credential ([A-Za-z0-9_]+) isn't saved/.exec(message);
    return m ? m[1] : null;
}

/** Credential names are upper-case letters, digits and underscores. Used to sanitise a ?add= value. */
export function safeCredentialName(raw: string | null | undefined): string {
    return (raw ?? "").toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 60);
}

/** Trim and bound the model's note to the user (untrusted text), dropping it when empty. */
export function cleanAssistantMessage(raw: string): string | undefined {
    const text = raw.replace(/\s+/g, " ").trim().slice(0, 600);
    return text || undefined;
}
