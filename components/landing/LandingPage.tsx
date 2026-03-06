"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight, Box, Cpu, Eye, Infinity, LayoutGrid, Sparkles, TerminalSquare, Workflow, ChevronRight, Code2 } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";
import dynamic from "next/dynamic";
const DottedSurface = dynamic(() => import("@/components/ui/dotted-surface").then(mod => ({ default: mod.DottedSurface })), { ssr: false });
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { LogoCloud } from "@/components/ui/logo-cloud";
import { InfiniteSlider } from "@/components/ui/infinite-slider";

const logos = [
    { src: "https://svgl.app/library/nvidia-wordmark-light.svg", alt: "Nvidia Logo" },
    { src: "https://svgl.app/library/supabase_wordmark_light.svg", alt: "Supabase Logo" },
    { src: "https://svgl.app/library/openai_wordmark_light.svg", alt: "OpenAI Logo" },
    { src: "https://svgl.app/library/turso-wordmark-light.svg", alt: "Turso Logo" },
    { src: "https://svgl.app/library/vercel_wordmark.svg", alt: "Vercel Logo" },
    { src: "https://svgl.app/library/github_wordmark_light.svg", alt: "GitHub Logo" },
    { src: "https://svgl.app/library/claude-ai-wordmark-icon_light.svg", alt: "Claude AI Logo" },
    { src: "https://svgl.app/library/clerk-wordmark-light.svg", alt: "Clerk Logo" },
];

export default function LandingPage() {
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
    const yImage1 = useTransform(scrollYProgress, [0, 1], [0, -10]);
    const yImage2 = useTransform(scrollYProgress, [0, 1], [0, -10]);

    return (
        <div ref={containerRef} className="min-h-screen bg-black text-white selection:bg-indigo-500/30 overflow-x-hidden font-sans relative">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[120vw] h-[600px] bg-indigo-600/20 rounded-[100%] blur-[120px] mix-blend-screen" />
                <div className="absolute top-[40%] left-[-10%] w-[50vw] h-[500px] bg-blue-600/10 rounded-full blur-[140px] mix-blend-screen" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[600px] bg-purple-600/10 rounded-full blur-[150px] mix-blend-screen" />
            </div>

            {/* Navigation */}
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[800px] px-4 sm:px-6">
                <nav className="flex items-center justify-between h-14 px-4 sm:px-6 rounded-full border border-white/10 bg-black/30 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center space-x-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 via-blue-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)] shrink-0">
                            <Workflow className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-base sm:text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">DevFlow</span>
                    </div>
                    <div className="flex items-center space-x-3 sm:space-x-6 text-sm font-medium">
                        <Link href="/login" className="text-zinc-400 hover:text-white transition-colors hidden sm:block">
                            Log in
                        </Link>
                        <Link href="/login" className="relative group overflow-hidden rounded-full p-[1px]">
                            <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 rounded-full opacity-70 group-hover:opacity-100 transition-opacity duration-300 animate-spin-slow" style={{ animationDuration: '4s' }} />
                            <div className="relative bg-black px-3 py-1.5 sm:px-4 rounded-full transition-all group-hover:bg-zinc-900/90 text-white flex items-center space-x-1">
                                <span className="whitespace-nowrap hidden min-[360px]:block">Sign Up</span>
                                <span className="whitespace-nowrap min-[360px]:hidden">Start</span>
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                            </div>
                        </Link>
                    </div>
                </nav>
            </div>

            <main className="relative z-10 pt-24 sm:pt-32 pb-16 sm:pb-24">
                {/* Hero Section */}
                <section className="max-w-[90rem] mx-auto px-4 sm:px-6 pt-10 pb-12 sm:pb-20 text-center relative">
                    <div className="absolute inset-0 pointer-events-none overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]">
                        <DottedSurface className="opacity-[0.6]" />
                    </div>

                    <ContainerScroll
                        titleComponent={
                            <>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                    transition={{ duration: 0.7, ease: "easeOut" }}
                                    className="inline-flex items-center space-x-2 px-3 sm:px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 backdrop-blur-md mb-6 sm:mb-8 shadow-[0_0_30px_rgba(99,102,241,0.15)] mt-4 sm:mt-14"
                                >
                                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
                                    <span className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-indigo-200">The Automation Platform of 2026</span>
                                </motion.div>

                                <motion.h1
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                                    className="text-4xl min-[400px]:text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] font-bold tracking-tighter mb-4 sm:mb-8 leading-[1.1] sm:leading-[1.05]"
                                >
                                    Build workflows at the
                                    <br className="hidden sm:block" />
                                    <span className="bg-gradient-to-b from-white via-white/90 to-white/40 text-transparent bg-clip-text pb-2 block sm:inline">
                                        speed of thought.
                                    </span>
                                </motion.h1>

                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.3 }}
                                    className="max-w-3xl mx-auto text-base min-[400px]:text-lg sm:text-xl md:text-2xl text-zinc-400 mb-8 sm:mb-12 leading-relaxed font-light px-4 sm:px-0"
                                >
                                    With visual node-based execution, AI-powered generation, and out-of-the-box observability, DevFlow makes complex automations feel like magic.
                                </motion.p>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.4 }}
                                    className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 relative z-20 mb-8 sm:mb-10 px-4 sm:px-0"
                                >
                                    <Link href="/login" className="h-12 sm:h-14 px-8 rounded-full bg-white text-black flex items-center justify-center font-semibold text-base sm:text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] w-full sm:w-auto">
                                        Start Building Free
                                    </Link>
                                    <div className="group h-12 sm:h-14 px-6 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs sm:text-sm font-mono text-zinc-300 hover:text-white transition-all w-full sm:w-auto cursor-pointer relative overflow-hidden backdrop-blur-sm">
                                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
                                        npx create-devflow@latest
                                    </div>
                                </motion.div>
                            </>
                        }
                    >
                        {/* Hero Image / Mockup inside Card */}
                        <div className="relative w-full h-full rounded-xl md:rounded-2xl overflow-hidden bg-[#0a0a0a]">
                            <div className="h-6 sm:h-8 border-b border-white/5 bg-white/[0.02] flex items-center px-3 sm:px-4 space-x-1.5 sm:space-x-2">
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500/80" />
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500/80" />
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500/80" />
                                <div className="w-full text-center text-[10px] sm:text-xs font-mono text-zinc-500 pr-10 sm:pr-12">devflow-studio</div>
                            </div>
                            <Image
                                src="/landing/dashboard.png"
                                width={2400}
                                height={1400}
                                alt="DevFlow Dashboard"
                                className="w-full h-full object-cover opacity-90 object-left-top"
                                priority
                                draggable={false}
                            />
                            {/* Overlay Gradient for depth */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                        </div>
                    </ContainerScroll>
                </section>

                {/* Brand Logos */}
                <section className="py-8 sm:py-12 border-y border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent relative">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-hidden relative z-10">
                        <p className="text-center text-[10px] sm:text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-6 sm:mb-8">Trusted by experts. Used by the leaders.</p>
                        <LogoCloud logos={logos} />
                    </div>
                </section>

                {/* Visual Logic Section */}
                <section className="max-w-[90rem] mx-auto px-4 sm:px-6 py-20 sm:py-40">
                    <div className="grid lg:grid-cols-12 gap-10 sm:gap-12 lg:gap-20 items-center">
                        <div className="space-y-6 sm:space-y-8 lg:col-span-5 text-center lg:text-left">
                            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-[10px] sm:text-xs font-medium uppercase tracking-wide mb-4 sm:mb-8">
                                <Workflow className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />
                                <span>Architecture</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mb-6 sm:mb-8 leading-[1.1]">Visual logic as code. <br className="hidden sm:block" /><span className="text-zinc-500">Unleashed.</span></h2>
                            <p className="text-zinc-400 text-lg sm:text-xl leading-relaxed mb-6 sm:mb-8 font-light max-w-xl mx-auto lg:mx-0">
                                Move from fragile scripts, untracked API calls, and custom retries to durable, visual node graphs within a single, powerful platform.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-6 sm:mt-8">
                                {/* Feature 1 */}
                                <div className="group p-5 sm:p-6 md:p-8 rounded-3xl sm:rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent hover:bg-white/[0.08] transition-all duration-500 relative overflow-hidden backdrop-blur-sm shadow-xl text-left">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-400/30 transition-colors duration-500" />
                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 sm:mb-6 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                                            <Code2 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">No more parsing spaghetti code.</h4>
                                            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-light">Your architecture is literally drawn on screen. Understand complex flows in seconds.</p>
                                        </div>
                                    </div>
                                </div>
                                {/* Feature 2 */}
                                <div className="group p-5 sm:p-6 md:p-8 rounded-3xl sm:rounded-[2rem] border border-white/10 bg-gradient-to-bl from-white/[0.05] to-transparent hover:bg-white/[0.08] transition-all duration-500 relative overflow-hidden backdrop-blur-sm shadow-xl text-left">
                                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-[50px] translate-y-1/2 -translate-x-1/2 group-hover:bg-blue-400/30 transition-colors duration-500" />
                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 sm:mb-6 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                                            <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">React Flow Engine.</h4>
                                            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-light">Butter-smooth zooming, panning, and connection making powered by industry standard tech.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <motion.div style={{ y: yImage1 }} className="lg:col-span-7 relative isolate pt-8 sm:pt-10 lg:pt-0">
                            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-3xl -z-10 rounded-full" />
                            <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-black overflow-hidden shadow-2xl relative">
                                <div className="h-6 sm:h-8 border-b border-white/5 bg-white/[0.02] flex items-center px-3 sm:px-4 space-x-1.5 sm:space-x-2">
                                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500/80" />
                                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500/80" />
                                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500/80" />
                                    <div className="w-full text-center text-[8px] sm:text-[10px] font-mono text-zinc-500 pr-10 sm:pr-12 tracking-wider">devflow-canvas</div>
                                </div>
                                <div className="relative min-h-[250px] sm:min-h-[400px]">
                                    <Image
                                        src="/landing/canvas.png"
                                        width={1400}
                                        height={1000}
                                        alt="DevFlow Builder Interface"
                                        className="absolute inset-0 w-full h-full object-cover object-left-top opacity-100 transition-opacity duration-1000"
                                    />
                                </div>
                                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl sm:rounded-2xl pointer-events-none" />
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* AI Native Section */}
                < section className="py-20 sm:py-40 border-y border-white/5 relative overflow-hidden" >
                    <div className="absolute inset-0 bg-white/[0.02]" />
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
                        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wide mb-6 sm:mb-8 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                            <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>AI Cloud</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 sm:mb-8">Generated by AI.<br /><span className="bg-gradient-to-r from-blue-400 to-indigo-500 text-transparent bg-clip-text">Perfected by you.</span></h2>
                        <p className="max-w-2xl mx-auto text-zinc-400 text-lg sm:text-xl mb-12 sm:mb-20 font-light">
                            Describe your automation in plain English. DevFlow's Groq-powered engine compiles the entire node graph instantly. Skip the blank canvas.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-left max-w-6xl mx-auto">
                            {/* Large Feature Card - Spans 2 columns */}
                            <div className="md:col-span-2 group p-6 sm:p-8 rounded-3xl sm:rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent hover:bg-white/[0.08] transition-all duration-500 relative overflow-hidden shadow-2xl backdrop-blur-sm">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-400/30 transition-colors duration-500" />
                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-6 sm:mb-8 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                        <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 text-white tracking-tight">Prompt to Flow</h3>
                                        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-light sm:text-lg max-w-md">Type &apos;Create a slack bot that summarizes emails&apos; and watch the graph orchestrate itself. Natural language translates directly to actionable nodes.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Smaller Feature Card */}
                            <div className="group p-6 sm:p-8 rounded-3xl sm:rounded-[2rem] border border-white/10 bg-gradient-to-bl from-white/[0.03] to-white/[0.01] hover:bg-white/[0.06] transition-all duration-500 relative overflow-hidden shadow-xl backdrop-blur-sm">
                                <div className="absolute top-0 left-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-[60px] -translate-x-1/2 -translate-y-1/2 group-hover:bg-indigo-400/30 transition-colors duration-500" />
                                <div className="relative z-10">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 sm:mb-6">
                                        <Box className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
                                    </div>
                                    <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white tracking-tight">Durable Execution</h3>
                                    <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-light">High-performance streaming, state persistence, and resumable runs work out of the box.</p>
                                </div>
                            </div>

                            {/* Smaller Feature Card */}
                            <div className="group p-6 sm:p-8 rounded-3xl sm:rounded-[2rem] border border-white/10 bg-gradient-to-tr from-white/[0.03] to-white/[0.01] hover:bg-white/[0.06] transition-all duration-500 relative overflow-hidden shadow-xl backdrop-blur-sm">
                                <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-500/20 rounded-full blur-[60px] translate-x-1/3 translate-y-1/3 group-hover:bg-purple-400/30 transition-colors duration-500" />
                                <div className="relative z-10">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 sm:mb-6">
                                        <Cpu className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                                    </div>
                                    <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white tracking-tight">Multi-Model</h3>
                                    <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-light">Leverage Groq&apos;s Llama 3 models for lightning-fast speeds, or bring your own API keys.</p>
                                </div>
                            </div>

                            {/* Wide Feature Card - Spans 2 columns */}
                            <div className="md:col-span-2 group p-6 sm:p-8 rounded-3xl sm:rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.02] via-white/[0.05] to-transparent hover:bg-white/[0.08] transition-all duration-500 relative overflow-hidden shadow-2xl backdrop-blur-sm flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/4 group-hover:bg-emerald-400/20 transition-colors duration-500" />
                                <div className="relative z-10 flex-1 w-full text-center md:text-left">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto md:mx-0 rounded-xl sm:rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 sm:mb-6 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                                        <TerminalSquare className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white tracking-tight">Code Export & Ejection</h3>
                                    <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-light sm:text-lg">Never get locked in. Export your entire visual workflow as clean, production-ready TypeScript code that you can run anywhere.</p>
                                </div>
                                <div className="relative z-10 flex-1 w-full flex justify-center md:justify-end">
                                    <div className="w-full max-w-sm rounded-xl border border-white/10 bg-black/50 p-3 sm:p-4 font-mono text-[10px] sm:text-sm text-green-400/80 shadow-inner overflow-hidden relative text-left whitespace-pre overflow-x-auto custom-scrollbar">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/50 to-transparent" />
                                        <div className="flex space-x-1.5 sm:space-x-2 mb-2 sm:mb-3 opacity-50">
                                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500" />
                                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-500" />
                                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500" />
                                        </div>
                                        <pre className="opacity-90"><code><span className="text-emerald-300">import</span> &#123; Workflow &#125; <span className="text-emerald-300">from</span> <span className="text-emerald-200">'devflow'</span>;<br /><br /><span className="text-emerald-300">const</span> flow = <span className="text-emerald-300">new</span> Workflow();<br />flow.<span className="text-emerald-200">compile</span>();</code></pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section >

                {/* Observability Section */}
                <section className="max-w-[90rem] mx-auto px-4 sm:px-6 py-24 sm:py-40">
                    <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-center">
                        <motion.div style={{ y: yImage2 }} className="lg:col-span-7 relative isolate order-2 lg:order-1 pt-10 lg:pt-0">
                            <div className="absolute inset-0 bg-gradient-to-tr from-green-500/20 to-emerald-500/20 blur-3xl -z-10 rounded-full" />
                            <div className="rounded-2xl border border-white/10 bg-black overflow-hidden shadow-2xl relative">
                                <div className="h-8 border-b border-white/5 bg-white/[0.02] flex items-center px-4 space-x-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                                    <div className="w-full text-center text-[10px] font-mono text-zinc-500 pr-12 tracking-wider">devflow-console</div>
                                </div>
                                <Image
                                    src="/landing/console.png"
                                    width={1400}
                                    height={1000}
                                    alt="DevFlow Execution Console"
                                    className="w-full h-auto opacity-100 transition-opacity duration-1000"
                                />
                                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
                            </div>
                        </motion.div>

                        <div className="lg:col-span-5 order-1 lg:order-2 text-center lg:text-left">
                            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wide mb-6 sm:mb-8 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span>Observability</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mb-6 sm:mb-8 leading-[1.1]">Inspect every run <br className="hidden sm:block" /><span className="text-zinc-500">end-to-end.</span></h2>
                            <p className="text-zinc-400 text-lg sm:text-xl leading-relaxed mb-6 sm:mb-8 font-light max-w-xl mx-auto lg:mx-0">
                                When running workflows in DevFlow, deep execution observability is built into the sliding console. No extra configuration required.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 sm:mt-8 text-left">
                                <div className="group p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all relative overflow-hidden backdrop-blur-sm">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2" />
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                    </div>
                                    <h4 className="text-sm font-semibold text-white mb-1">Live Streaming</h4>
                                    <p className="text-xs text-zinc-400 font-light">Real-time node status & logs.</p>
                                </div>
                                <div className="group p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all relative overflow-hidden backdrop-blur-sm">
                                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-green-500/20 rounded-full blur-[40px] translate-y-1/2 -translate-x-1/2" />
                                    <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                    </div>
                                    <h4 className="text-sm font-semibold text-white mb-1">Execution History</h4>
                                    <p className="text-xs text-zinc-400 font-light">Persistent runs via Neon DB.</p>
                                </div>
                                <div className="group sm:col-span-2 p-5 rounded-2xl border border-white/10 bg-gradient-to-r from-red-500/5 to-transparent hover:from-red-500/10 transition-all relative overflow-hidden backdrop-blur-sm flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-red-500" /> Error Tracing
                                        </h4>
                                        <p className="text-xs text-zinc-400 font-light">Instant failing node highlighting.</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full border border-red-500/20 bg-red-500/10 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section >

                {/* Testimonials */}
                < section className="py-16 sm:py-24 relative z-10" >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12 sm:mb-16">
                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
                                Loved by developers
                            </h2>
                            <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto">
                                Join thousands of engineers building faster with DevFlow.
                            </p>
                        </div>

                        <div
                            className="relative h-[600px] sm:h-[800px] overflow-hidden"
                            style={{
                                maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
                                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)'
                            }}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 h-full">
                                {[
                                    // Column 1
                                    [
                                        {
                                            quote: "DevFlow feels like magic. I was able to build a complex data processing pipeline in minutes instead of days. The visual feedback is invaluable.",
                                            author: "Sarah Jenkins",
                                            role: "Senior Backend Engineer",
                                            company: "TechNova"
                                        },
                                        {
                                            quote: "We migrated our legacy scraping scripts to DevFlow. The built-in observability and error handling saved us countless hours of debugging.",
                                            author: "Michael Chang",
                                            role: "Data Engineering Manager",
                                            company: "DataFirst"
                                        },
                                        {
                                            quote: "Audit logs and versioning are critical for us. DevFlow provides everything we need to stay compliant while moving fast.",
                                            author: "James Wilson",
                                            role: "DevOps Lead",
                                            company: "FinTech Solutions"
                                        }
                                    ],
                                    // Column 2
                                    [
                                        {
                                            quote: "The ability to mix logic with AI prompts directly in the canvas has completely transformed our prototyping speed. It's the ultimate DX.",
                                            author: "David Chen",
                                            role: "CTO",
                                            company: "StartupX"
                                        },
                                        {
                                            quote: "The integration with our existing CI/CD pipelines was seamless. DevFlow is now a core part of our deployment strategy.",
                                            author: "Alex Rivera",
                                            role: "Full-stack Developer",
                                            company: "OpenSource Labs"
                                        },
                                        {
                                            quote: "User testing our flows has never been easier. We can iterate on the logic in real-time based on user feedback.",
                                            author: "Priya Sharma",
                                            role: "Product Engineer",
                                            company: "SwiftShip"
                                        }
                                    ],
                                    // Column 3
                                    [
                                        {
                                            quote: "Finally, a visual builder that doesn't feel like a toy. It generates clean, durable code under the hood. I trust it for production workloads.",
                                            author: "Elena Rodriguez",
                                            role: "Lead Architect",
                                            company: "GlobalScale"
                                        },
                                        {
                                            quote: "The automatic scaling and fault tolerance features are world-class. We haven't had a single outage since moving our mission-critical flows to DevFlow.",
                                            author: "Samantha Wu",
                                            role: "SRE",
                                            company: "CloudNative"
                                        },
                                        {
                                            quote: "The security-first approach is refreshing. DevFlow's sandboxing and secret management are top-notch.",
                                            author: "Tom Baker",
                                            role: "Security Engineer",
                                            company: "SecureNet"
                                        }
                                    ]
                                ].map((column, colIdx) => (
                                    <InfiniteSlider
                                        key={colIdx}
                                        direction="vertical"
                                        duration={colIdx === 1 ? 50 : colIdx === 2 ? 40 : 45}
                                        reverse={colIdx === 1}
                                        className={cn("h-full", colIdx > 0 && "hidden md:flex", colIdx > 1 && "hidden lg:flex")}
                                        gap={32}
                                    >
                                        {column.map((testimonial, i) => (
                                            <div key={i} className="bg-zinc-900/40 border border-white/10 p-6 sm:p-8 rounded-3xl flex flex-col justify-between w-full backdrop-blur-sm hover:bg-zinc-900/60 transition-colors duration-300">
                                                <div className="mb-6">
                                                    <div className="flex gap-1 mb-4 sm:mb-6 text-yellow-500/80">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <svg key={star} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                                                                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                                                            </svg>
                                                        ))}
                                                    </div>
                                                    <p className="text-zinc-300 leading-relaxed text-sm sm:text-base">"{testimonial.quote}"</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center text-indigo-400 font-bold text-xs sm:text-sm shrink-0">
                                                        {testimonial.author[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-white text-sm sm:text-base">{testimonial.author}</div>
                                                        <div className="text-zinc-500 text-xs sm:text-sm">{testimonial.role} <br className="sm:hidden" />at {testimonial.company}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </InfiniteSlider>
                                ))}
                            </div>
                        </div>
                    </div>
                </section >

                {/* CTA */}
                <section className="relative py-24 sm:py-40 overflow-hidden border-t border-white/10">
                    <div className="absolute inset-0 bg-gradient-to-b from-black to-indigo-950/20" />
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 text-center">
                        <p className="text-zinc-400 mb-6 sm:mb-8 font-light tracking-wide uppercase text-xs sm:text-sm">Start from scratch or use our pre-built templates</p>
                        <div className="relative group inline-block">
                            {/* Spotlight Effect */}
                            <div className="absolute -inset-10 sm:-inset-20 bg-indigo-500/20 rounded-full blur-[60px] sm:blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none animate-pulse" />

                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <Link href="/login" className="group/btn relative inline-flex items-center space-x-4 sm:space-x-6 text-3xl sm:text-6xl md:text-8xl font-bold tracking-tighter">
                                    <span className="relative z-10 bg-gradient-to-r from-white to-white/60 text-transparent bg-clip-text">Build workflows</span>
                                    <div className="relative z-10 w-12 h-12 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-white flex items-center justify-center group-hover/btn:bg-indigo-500 transition-colors duration-500 shadow-[0_0_40px_rgba(255,255,255,0.2)] group-hover/btn:shadow-[0_0_60px_rgba(99,102,241,0.6)] shrink-0">
                                        <ArrowRight className="w-6 h-6 sm:w-10 sm:h-10 md:w-12 md:h-12 text-black group-hover/btn:text-white group-hover/btn:translate-x-1 sm:group-hover/btn:translate-x-2 transition-all duration-300" />
                                    </div>

                                    {/* Inner Glow */}
                                    <div className="absolute inset-x-0 -bottom-2 sm:-bottom-4 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                                </Link>
                            </motion.div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 bg-black pt-16 sm:pt-20 overflow-hidden relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-5 gap-8 sm:gap-12 text-sm text-zinc-400 mb-16 sm:mb-20 relative z-10">
                    <div className="col-span-2">
                        <div className="flex items-center space-x-2 text-white font-bold text-lg tracking-tight mb-4 sm:mb-6">
                            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                                <Workflow className="w-3 h-3 text-white" />
                            </div>
                            <span>DevFlow</span>
                        </div>
                        <p className="font-light leading-relaxed max-w-xs mb-6 text-sm sm:text-base">Built for the future of automation. Visually craft, execute, and monitor complex systems at scale.</p>
                        <div className="flex items-center space-x-4 mb-6">
                            <Link href="https://twitter.com" className="text-zinc-500 hover:text-white transition-colors">
                                <span className="sr-only">Twitter</span>
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                                </svg>
                            </Link>
                            <Link href="https://github.com" className="text-zinc-500 hover:text-white transition-colors">
                                <span className="sr-only">GitHub</span>
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                </svg>
                            </Link>
                        </div>
                        <p className="text-xs text-zinc-600">DevFlow, Inc. © {new Date().getFullYear()}</p>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-white font-semibold mb-4 sm:mb-6">Product</h4>
                        <p className="hover:text-white cursor-pointer transition-colors">Workflows</p>
                        <p className="hover:text-white cursor-pointer transition-colors">AI Engine</p>
                        <p className="hover:text-white cursor-pointer transition-colors">Templates</p>
                        <p className="hover:text-white cursor-pointer transition-colors">Pricing</p>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-white font-semibold mb-4 sm:mb-6">Resources</h4>
                        <p className="hover:text-white cursor-pointer transition-colors">Documentation</p>
                        <p className="hover:text-white cursor-pointer transition-colors">Guides</p>
                        <p className="hover:text-white cursor-pointer transition-colors">API Reference</p>
                        <p className="hover:text-white cursor-pointer transition-colors">Community</p>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-white font-semibold mb-4 sm:mb-6">Company</h4>
                        <p className="hover:text-white cursor-pointer transition-colors">About</p>
                        <p className="hover:text-white cursor-pointer transition-colors">Blog</p>
                        <p className="hover:text-white cursor-pointer transition-colors">Careers</p>
                        <p className="hover:text-white cursor-pointer transition-colors">Legal</p>
                    </div>
                </div>

                {/* Big Text */}
                <div className="w-full flex justify-center items-end mt-10 pointer-events-none select-none relative z-0">
                    <h1 className="text-[20vw] sm:text-[24vw] leading-[0.8] font-black text-zinc-900 tracking-tighter mb-[-4vw] sm:mb-[-5vw] opacity-80 backdrop-blur-sm">
                        devflow
                    </h1>
                </div>
            </footer>
        </div>
    );
}
