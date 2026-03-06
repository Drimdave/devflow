"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

const LOADING_TEXTS = [
    "Cooking up the flow...",
    "Configuring triggers...",
    "Creating actions...",
    "Building logic nodes...",
    "Connecting the pieces...",
    "Almost there...",
];

export default function WorkflowLoadingOverlay() {
    const [textIndex, setTextIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTextIndex((prev) => (prev + 1) % LOADING_TEXTS.length);
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    // Animation variants for nodes
    const nodeVariants: Variants = {
        hidden: { opacity: 0, scale: 0.8 },
        visible: (i: number) => ({
            opacity: 1,
            scale: 1,
            transition: {
                delay: i * 0.4,
                duration: 0.5,
                ease: "easeOut",
            },
        }),
        pulse: {
            scale: [1, 1.05, 1],
            boxShadow: [
                "0 0 0 0px rgba(59, 130, 246, 0.4)",
                "0 0 0 10px rgba(59, 130, 246, 0)",
                "0 0 0 0px rgba(59, 130, 246, 0)",
            ],
            transition: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
            },
        },
    };

    // Animation variants for edges
    const edgeVariants: Variants = {
        hidden: { pathLength: 0, opacity: 0 },
        visible: (i: number) => ({
            pathLength: 1,
            opacity: 1,
            transition: {
                delay: i * 0.4 + 0.3, // Start slightly after node
                duration: 0.6,
                ease: "easeInOut",
            },
        }),
    };

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm pr-[400px]">
            <div className="relative mb-8 h-48 w-64">
                {/* Node 1 (Top - Trigger) */}
                <motion.div
                    custom={0}
                    initial="hidden"
                    animate={["visible", "pulse"]}
                    variants={nodeVariants}
                    className="absolute left-1/2 top-4 h-12 w-12 -translate-x-1/2 rounded-xl bg-blue-500/20 shadow-[0_0_20px_-5px_hsl(215_100%_50%_/_0.5)] border border-blue-500/50 flex items-center justify-center"
                >
                    <div className="h-4 w-4 rounded-full bg-blue-500" />
                </motion.div>

                {/* Edge 1 (Top to Middle) */}
                <svg className="absolute left-0 top-0 h-full w-full overflow-visible">
                    <motion.path
                        d="M 128 60 L 128 92"
                        fill="none"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth="2"
                        strokeLinecap="round"
                        custom={0}
                        initial="hidden"
                        animate="visible"
                        variants={edgeVariants}
                    />
                </svg>

                {/* Node 2 (Middle - Logic/Action) */}
                <motion.div
                    custom={1}
                    initial="hidden"
                    animate={["visible", "pulse"]}
                    variants={nodeVariants}
                    className="absolute left-1/2 top-24 h-12 w-12 -translate-x-1/2 rounded-xl bg-amber-500/20 shadow-[0_0_20px_-5px_hsl(40_95%_50%_/_0.5)] border border-amber-500/50 flex items-center justify-center"
                >
                    <div className="h-4 w-4 rounded-full bg-amber-500" />
                </motion.div>

                {/* Edge 2 (Middle to Bottom) */}
                <svg className="absolute left-0 top-0 h-full w-full overflow-visible">
                    <motion.path
                        d="M 128 140 L 128 172"
                        fill="none"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth="2"
                        strokeLinecap="round"
                        custom={1}
                        initial="hidden"
                        animate="visible"
                        variants={edgeVariants}
                    />
                </svg>

                {/* Node 3 (Bottom - Action) */}
                <motion.div
                    custom={2}
                    initial="hidden"
                    animate={["visible", "pulse"]}
                    variants={nodeVariants}
                    className="absolute left-1/2 top-44 h-12 w-12 -translate-x-1/2 rounded-xl bg-teal-500/20 shadow-[0_0_20px_-5px_hsl(180_80%_45%_/_0.5)] border border-teal-500/50 flex items-center justify-center"
                >
                    <div className="h-4 w-4 rounded-full bg-teal-500" />
                </motion.div>
            </div>

            {/* Rotating Text */}
            <div className="h-6 w-full text-center">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={textIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="text-sm font-medium text-muted-foreground"
                    >
                        {LOADING_TEXTS[textIndex]}
                    </motion.p>
                </AnimatePresence>
            </div>
        </div>
    );
}
