"use client";

import dynamic from "next/dynamic";

// The editor (React Flow, panels, chat) is a big chunk of JS that landing-page visitors never
// need. Loading it lazily keeps it out of the public page's bundle; it only downloads once
// a signed-in user actually renders the app.
// ssr: false because the app is entirely client-driven (canvas, local state) and server-rendering
// it inside a lazy boundary shifts React's useId values, causing Radix hydration mismatches.
const ClientPage = dynamic(() => import("./ClientPage"), {
    ssr: false,
    loading: () => <div className="h-screen w-screen bg-background" aria-busy="true" />,
});

export default function AppLoader({ initialSlug }: { initialSlug?: string[] }) {
    return <ClientPage initialSlug={initialSlug} />;
}
