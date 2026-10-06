import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export const LEGAL_NAME = process.env.NEXT_PUBLIC_LEGAL_NAME?.trim() || "the operator of this DevFlow service";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "";

export function Contact() {
    return CONTACT_EMAIL
        ? <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground underline underline-offset-4">{CONTACT_EMAIL}</a>
        : <span>the contact address shown by the operator of this service</span>;
}

/** Shared frame for the legal pages: plain, readable, no app chrome. */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background p-3">
            <div className="mx-auto max-w-3xl rounded-[28px] border border-border/70 bg-card p-8 shadow-card sm:p-12">
                <Link href="/" className="mb-10 block w-fit"><Logo /></Link>
                <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
                <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-muted-foreground [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mt-1.5 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
                    {children}
                </div>
                <nav className="mt-12 flex gap-5 border-t border-border/70 pt-6 text-sm">
                    <Link href="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">Privacy</Link>
                    <Link href="/terms" className="text-muted-foreground transition-colors hover:text-foreground">Terms</Link>
                    <Link href="/login" className="ml-auto font-medium text-foreground">Back to sign in</Link>
                </nav>
            </div>
        </div>
    );
}
