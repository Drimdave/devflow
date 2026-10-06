import { ImageResponse } from "next/og";

export const alt = "DevFlow: Describe it. Watch it run.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share card for links to the landing page (Twitter/X, LinkedIn, Slack, iMessage...).
export default function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: "#0B0B0C",
                    padding: 72,
                    color: "white",
                    fontFamily: "sans-serif",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: "white", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: "4px solid #0B0B0C", position: "absolute", top: 12, left: 12 }} />
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: "4px solid #0B0B0C", position: "absolute", bottom: 12, right: 12 }} />
                        <div style={{ width: 16, height: 16, borderRadius: 999, background: "#C8F31D", position: "absolute", top: -4, right: -4, border: "3px solid #0B0B0C" }} />
                    </div>
                    <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>DevFlow</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", fontSize: 108, fontWeight: 700, letterSpacing: -4, lineHeight: 1.02 }}>
                    <div>Describe it.</div>
                    <div style={{ display: "flex" }}>
                        <span>Watch it&nbsp;</span>
                        <span style={{ background: "#C8F31D", color: "#0B0B0C", padding: "0 18px", borderRadius: 14 }}>run.</span>
                    </div>
                </div>

                <div style={{ fontSize: 30, color: "#a1a1aa" }}>Plain English in. A working automation graph out.</div>
            </div>
        ),
        size
    );
}
