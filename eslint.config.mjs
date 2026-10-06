import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not source: compiled test output, other tools' working copies, docs assets
    ".test-build/**",
    ".kilo/**",
    ".claude/**",
    "docs/**",
  ]),
  {
    // Workflow settings, AI output and webhook payloads are JSON of unknown shape, so `any` is sometimes the honest type.
    // It stays visible as a warning in application code and is allowed in tests.
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
  {
    files: ["tests/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);

export default eslintConfig;
