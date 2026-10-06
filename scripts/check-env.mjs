// Prints a checklist of the environment DevFlow needs, without ever printing a secret value.
//   npm run check:env                     (reads .env.local)
//   NODE_ENV=production node scripts/check-env.mjs   (checks what is in the current environment, e.g. in CI)
import { checkEnv, hasErrors } from "../lib/env-check.ts";

const production = process.env.NODE_ENV === "production";
const findings = checkEnv(process.env, { production });
const icon = { ok: "✓", warn: "!", error: "✗" };
console.log(`\nDevFlow environment check (${production ? "production" : "development"} rules)\n`);
for (const f of findings) console.log(`  ${icon[f.level]} ${f.name.padEnd(22)} ${f.message}`);
const errors = findings.filter((f) => f.level === "error").length, warns = findings.filter((f) => f.level === "warn").length;
console.log(`\n${errors} error${errors === 1 ? "" : "s"}, ${warns} warning${warns === 1 ? "" : "s"}.${hasErrors(findings) ? " Fix the errors before deploying." : ""}\n`);
process.exit(hasErrors(findings) ? 1 : 0);
