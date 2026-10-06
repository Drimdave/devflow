"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { cn } from "@/lib/utils";
import { nodeKindStyles } from "@/lib/node-visuals";

const LOADING_TEXTS = [
    "Reading your request…",
    "Picking the right nodes…",
    "Wiring up the data…",
    "Connecting the pieces…",
    "Almost there…",
];

// A tiny preview of what's coming: the same card shape the canvas uses, one per node kind
const STEPS = [
    { kind: "trigger" as const, title: "w-16", sub: "w-24" },
    { kind: "logic" as const, title: "w-20", sub: "w-28" },
    { kind: "action" as const, title: "w-14", sub: "w-20" },
];

export default function WorkflowLoadingOverlay() {
    const [textIndex, setTextIndex] = useState(0);
    const [active, setActive] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setTextIndex((i) => (i + 1) % LOADING_TEXTS.length), 1800);
        // Starts after the cards have drawn in, then the highlight keeps travelling down the chain
        const a = setInterval(() => setActive((i) => (i + 1) % STEPS.length), 900);
        return () => { clearInterval(t); clearInterval(a); };
    }, []);

    return (
        <MotionConfig reducedMotion="user">
            <div role="status" aria-live="polite" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-7 bg-background/75 px-6 backdrop-blur-sm">
                <div className="flex flex-col items-center">
                    {STEPS.map((step, i) => {
                        const style = nodeKindStyles[step.kind];
                        return (
                            <div key={step.kind} className="flex flex-col items-center">
                                <motion.div
                                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ delay: i * 0.35, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                                    className={cn(
                                        "flex h-[60px] w-[220px] items-center gap-3 rounded-2xl border bg-card px-3.5 shadow-card transition-all duration-500",
                                        active === i ? "border-volt ring-4 ring-volt/40" : "border-border"
                                    )}
                                >
                                    <span className={cn("h-9 w-9 shrink-0 rounded-xl", style.chip)} />
                                    <span className="flex flex-col gap-1.5">
                                        <span className={cn("h-2.5 animate-pulse rounded-full bg-foreground/15", step.title)} />
                                        <span className={cn("h-2 animate-pulse rounded-full bg-foreground/10", step.sub)} />
                                    </span>
                                </motion.div>
                                {i < STEPS.length - 1 && (
                                    <motion.span
                                        initial={{ scaleY: 0 }}
                                        animate={{ scaleY: 1 }}
                                        style={{ originY: 0 }}
                                        transition={{ delay: i * 0.35 + 0.3, duration: 0.35, ease: "easeOut" }}
                                        className="block h-7 w-0.5 rounded-full bg-border"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="h-6 text-center">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={textIndex}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="text-sm font-medium text-foreground"
                        >
                            {LOADING_TEXTS[textIndex]}
                        </motion.p>
                    </AnimatePresence>
                </div>
            </div>
        </MotionConfig>
    );
}
