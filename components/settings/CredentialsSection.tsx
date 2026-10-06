"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, KeyRound, Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/Toast";

interface Credential {
    id: string;
    name: string;
    description: string;
    hint: string;
    updated_at: string;
}

const inputCls = "h-12 w-full rounded-2xl bg-muted px-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/20 disabled:opacity-60";
const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

export default function CredentialsSection() {
    const [items, setItems] = useState<Credential[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [editing, setEditing] = useState<Credential | "new" | null>(null);
    const [deleting, setDeleting] = useState<Credential | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const [name, setName] = useState("");
    const [value, setValue] = useState("");
    const [description, setDescription] = useState("");
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState("");
    const cancelRef = useRef<HTMLButtonElement>(null);

    const load = useCallback(async () => {
        setFailed(false);
        try {
            const r = await fetch("/api/credentials");
            if (!r.ok) throw new Error();
            setItems((await r.json()).credentials);
        } catch {
            setFailed(true);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const openForm = (target: Credential | "new") => {
        setEditing(target);
        setFormError("");
        setValue("");
        setName(target === "new" ? "" : target.name);
        setDescription(target === "new" ? "" : target.description);
    };

    const save = async () => {
        if (!editing || busy) return;
        setBusy(true);
        setFormError("");
        try {
            const isNew = editing === "new";
            const res = await fetch(isNew ? "/api/credentials" : `/api/credentials/${editing.id}`, {
                method: isNew ? "POST" : "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(isNew ? { name, value, description } : { value: value || undefined, description }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { setFormError(data.error || "Couldn't save"); return; }
            showToast(isNew ? "Credential saved" : "Credential updated", "success");
            setEditing(null);
            setValue("");
            await load();
        } catch {
            setFormError("Couldn't reach the server");
        } finally {
            setBusy(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleting) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/credentials/${deleting.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            showToast(`${deleting.name} deleted`, "error");
            setDeleting(null);
            await load();
        } catch {
            showToast("Couldn't delete the credential", "error");
        } finally {
            setBusy(false);
        }
    };

    const copyRef = async (n: string) => {
        try {
            await navigator.clipboard.writeText(`{{secrets.${n}}}`);
            setCopied(n);
            setTimeout(() => setCopied(null), 1500);
        } catch {
            showToast("Couldn't copy", "error");
        }
    };

    const isNew = editing === "new";

    return (
        <>
            <div className="mb-4 flex items-start gap-3 rounded-2xl bg-muted/70 p-4 text-sm text-muted-foreground">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                <p>
                    Saved values are encrypted and never shown again. Use one in any node with <code className="rounded bg-card px-1.5 py-0.5 font-mono text-xs text-foreground">{"{{secrets.NAME}}"}</code>, for example a header of{" "}
                    <code className="rounded bg-card px-1.5 py-0.5 font-mono text-xs text-foreground">{"Bearer {{secrets.API_KEY}}"}</code>. They&apos;re hidden from run results and can&apos;t be used in AI prompts.
                </p>
            </div>

            {!items && !failed && <div className="h-16 animate-pulse rounded-2xl bg-muted" />}
            {failed && (
                <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Couldn&apos;t load credentials. <button onClick={load} className="font-semibold underline">Try again</button>
                </p>
            )}

            {items && items.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-8 text-center">
                    <KeyRound className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-medium">No credentials yet</p>
                    <p className="max-w-xs text-xs text-muted-foreground">Add an API key, token or Slack/Discord webhook URL once, then reuse it across workflows.</p>
                </div>
            )}

            {items && items.length > 0 && (
                <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70">
                    {items.map((c) => (
                        <li key={c.id} className="flex items-center gap-3 p-3.5 sm:px-4">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted"><KeyRound className="h-4 w-4" /></span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-mono text-sm font-medium">{c.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{c.description || "No note"} · ••••{c.hint}</p>
                            </div>
                            <button onClick={() => copyRef(c.name)} aria-label={`Copy reference to ${c.name}`} title="Copy {{secrets…}} reference" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                {copied === c.name ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            </button>
                            <button onClick={() => openForm(c)} aria-label={`Edit ${c.name}`} title="Edit" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`} title="Delete" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <button onClick={() => openForm("new")} className="mt-4 flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-transform hover:scale-[1.03] active:scale-95">
                <Plus className="h-4 w-4" /> Add credential
            </button>

            {/* Add / edit */}
            <Dialog.Root open={!!editing} onOpenChange={(o) => !o && !busy && setEditing(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] w-[min(460px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-border bg-card p-6 shadow-2xl outline-none">
                        <Dialog.Title className="font-display text-xl font-semibold">{isNew ? "Add credential" : `Edit ${typeof editing === "object" && editing ? editing.name : ""}`}</Dialog.Title>
                        <Dialog.Description className="mt-1 text-sm text-muted-foreground">{isNew ? "The value is encrypted as soon as you save it." : "Leave the value empty to keep the current one."}</Dialog.Description>
                        <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }} autoComplete="off">
                            {isNew && (
                                <div>
                                    <label htmlFor="cred-name" className={labelCls}>Name</label>
                                    <input id="cred-name" value={name} onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))} placeholder="SLACK_WEBHOOK" maxLength={40} className={cn(inputCls, "font-mono")} />
                                    <p className="mt-1.5 text-xs text-muted-foreground">Used as <span className="font-mono">{`{{secrets.${name || "NAME"}}}`}</span></p>
                                </div>
                            )}
                            <div>
                                <label htmlFor="cred-value" className={labelCls}>{isNew ? "Value" : "New value"}</label>
                                <input id="cred-value" type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder={isNew ? "Paste the key, token or URL" : "Unchanged"} autoComplete="new-password" className={cn(inputCls, "font-mono")} />
                            </div>
                            <div>
                                <label htmlFor="cred-desc" className={labelCls}>Note <span className="font-normal normal-case tracking-normal">(optional)</span></label>
                                <input id="cred-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is it for?" maxLength={200} className={inputCls} />
                            </div>
                            {formError && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
                            <div className="flex justify-end gap-2 pt-1">
                                <Dialog.Close type="button" disabled={busy} className="h-11 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50">Cancel</Dialog.Close>
                                <button type="submit" disabled={busy || (isNew && (!name || !value))} className="flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:hover:scale-100">
                                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
                                </button>
                            </div>
                        </form>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Delete */}
            <Dialog.Root open={!!deleting} onOpenChange={(o) => !o && !busy && setDeleting(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]" />
                    <Dialog.Content
                        className="fixed left-1/2 top-1/2 z-[61] w-[min(420px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-border bg-card p-6 shadow-2xl outline-none"
                        onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus(); }}
                    >
                        {deleting && (
                            <>
                                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></span>
                                <Dialog.Title className="font-display text-xl font-semibold">Delete this credential?</Dialog.Title>
                                <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    <span className="font-mono font-medium text-foreground">{deleting.name}</span> will be permanently removed. Any workflow that uses <span className="font-mono">{`{{secrets.${deleting.name}}}`}</span> will fail until you add it again.
                                </Dialog.Description>
                                <div className="mt-6 flex justify-end gap-2">
                                    <Dialog.Close ref={cancelRef} disabled={busy} className="h-11 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50">Cancel</Dialog.Close>
                                    <button onClick={confirmDelete} disabled={busy} className="flex h-11 items-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-destructive-foreground transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60">
                                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Delete credential
                                    </button>
                                </div>
                            </>
                        )}
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}
