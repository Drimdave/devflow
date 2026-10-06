"use client";

import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, FileQuestion, GitMerge, Loader2, Plus, RefreshCw, ArrowLeft, Trash2 } from "lucide-react";

const overlay = "fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]";
const content = "fixed left-1/2 top-1/2 z-[61] w-[min(440px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-border bg-card p-6 shadow-2xl outline-none";
const ghost = "h-11 whitespace-nowrap rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50";
const solid = "flex h-11 whitespace-nowrap items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60 disabled:hover:scale-100";
const danger = "h-11 whitespace-nowrap rounded-full px-5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50";

/** Shown before anything that would replace the canvas while it has unsaved changes. */
export function UnsavedChangesDialog({ open, saving, onKeep, onDiscard, onSave }: { open: boolean; saving: boolean; onKeep: () => void; onDiscard: () => void; onSave: () => void }) {
    const keepRef = useRef<HTMLButtonElement>(null);
    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && !saving && onKeep()}>
            <Dialog.Portal>
                <Dialog.Overlay className={overlay} />
                <Dialog.Content
                    className={`${content} !w-[min(520px,calc(100vw-24px))]`}
                    // Land on the safe choice so a stray Enter can't throw work away
                    onOpenAutoFocus={(e) => { e.preventDefault(); keepRef.current?.focus(); }}
                >
                    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-5 w-5" /></span>
                    <Dialog.Title className="font-display text-xl font-semibold">You have unsaved changes</Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        If you continue without saving, the changes you made to this workflow will be lost.
                    </Dialog.Description>
                    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <button type="button" onClick={onDiscard} disabled={saving} className={danger}>Discard changes</button>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <button ref={keepRef} type="button" onClick={onKeep} disabled={saving} className={ghost}>Keep editing</button>
                            <button type="button" onClick={onSave} disabled={saving} className={solid}>
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save &amp; continue
                            </button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

/** The saved copy changed (another tab or device) since this one was opened. */
export function ConflictDialog({ open, busy, onOverwrite, onLoadLatest, onCancel }: { open: boolean; busy: boolean; onOverwrite: () => void; onLoadLatest: () => void; onCancel: () => void }) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
            <Dialog.Portal>
                <Dialog.Overlay className={overlay} />
                <Dialog.Content className={content} onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus(); }}>
                    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400"><GitMerge className="h-5 w-5" /></span>
                    <Dialog.Title className="font-display text-xl font-semibold">This workflow changed somewhere else</Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        A newer version was saved from another tab or device. Saving now would replace it with what you see here.
                    </Dialog.Description>
                    <div className="mt-6 flex flex-col gap-2">
                        <button type="button" onClick={onLoadLatest} disabled={busy} className={solid}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Load the latest (discard my changes)
                        </button>
                        <button type="button" onClick={onOverwrite} disabled={busy} className={ghost}>Overwrite with my version</button>
                        <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="h-10 rounded-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">Cancel</button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

/** Replaces the canvas when a workflow link doesn't open. */
export function LoadErrorState({ kind, onBack, onRetry, onNew }: { kind: "notfound" | "failed"; onBack: () => void; onRetry: () => void; onNew: () => void }) {
    const notFound = kind === "notfound";
    return (
        <div role="alert" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-card/95 px-6 text-center backdrop-blur-sm">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><FileQuestion className="h-6 w-6 text-muted-foreground" /></span>
            <div>
                <h2 className="font-display text-xl font-semibold">{notFound ? "We couldn't find that workflow" : "That workflow didn't load"}</h2>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                    {notFound ? "It may have been deleted, or the link is wrong. Workflows are private to the account that created them." : "Something went wrong while loading it. Check your connection and try again."}
                </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={onBack} className={solid}><ArrowLeft className="h-4 w-4" /> Back to workflows</button>
                {!notFound && <button type="button" onClick={onRetry} className={ghost}>Try again</button>}
                <button type="button" onClick={onNew} className={`${ghost} flex items-center gap-1.5`}><Plus className="h-4 w-4" /> New workflow</button>
            </div>
        </div>
    );
}

/** Confirm before deleting the workflow that's open in the editor. */
export function ConfirmDeleteDialog({ open, name, busy, onCancel, onConfirm }: { open: boolean; name: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
            <Dialog.Portal>
                <Dialog.Overlay className={overlay} />
                <Dialog.Content className={content} onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus(); }}>
                    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></span>
                    <Dialog.Title className="font-display text-xl font-semibold">Delete this workflow?</Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">&ldquo;{name}&rdquo;</span> will be permanently removed, and its webhook URL will stop working. This can&apos;t be undone.
                    </Dialog.Description>
                    <div className="mt-6 flex justify-end gap-2">
                        <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className={ghost}>Cancel</button>
                        <button type="button" onClick={onConfirm} disabled={busy} className="flex h-11 items-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-destructive-foreground transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60">
                            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Delete workflow
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
