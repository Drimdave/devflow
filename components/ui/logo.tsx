import { cn } from "@/lib/utils";

/** DevFlow mark: two linked nodes inside an ink tile, with a volt "live" dot. */
export function LogoMark({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-foreground text-background",
                className
            )}
        >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="14" width="7" height="7" rx="2" />
                <path d="M10 6.5h3a3 3 0 0 1 3 3V14" />
            </svg>
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-volt" />
        </span>
    );
}

export function Logo({ className, textClassName }: { className?: string; textClassName?: string }) {
    return (
        <span className={cn("inline-flex items-center gap-2.5", className)}>
            <LogoMark />
            <span className={cn("font-display text-[17px] font-semibold tracking-tight text-foreground", textClassName)}>DevFlow</span>
        </span>
    );
}
