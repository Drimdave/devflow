// Runs once when the server starts. A production deploy with a broken setup should say so immediately, not fail strangely later.
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;

    const { checkEnv, hasErrors } = await import("./lib/env-check");
    const findings = checkEnv(process.env, { production: true });
    for (const f of findings) {
        if (f.level === "warn") console.warn(`[config] ${f.name}: ${f.message}`);
        if (f.level === "error") console.error(`[config] ${f.name}: ${f.message}`);
    }
    if (hasErrors(findings)) {
        throw new Error("DevFlow can't start: fix the [config] errors above (run `npm run check:env` for the full list).");
    }
}
