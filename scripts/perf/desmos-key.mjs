// Resolves the project's existing Desmos client key for local browser checks.
// The key is only injected into the page at runtime (window.__BINDER_NOTES_DESMOS_API_KEY__);
// it is never logged, written to new files, or recorded in traces.
import { existsSync, readFileSync } from "node:fs";
import { loadClientEnvFiles } from "../client-env-guard.mjs";

function readEnvFileValue(path, name) {
  if (!path || !existsSync(path)) return "";
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match?.[1] === name) return match[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
  return "";
}

export function resolveDesmosKey() {
  const configured = {};
  loadClientEnvFiles({ env: configured });
  return (
    process.env.E2E_DESMOS_API_KEY ||
    process.env.VITE_DESMOS_API_KEY ||
    configured.VITE_DESMOS_API_KEY ||
    // Optional pointer to an existing local client env file (for example a Vercel env pull).
    readEnvFileValue(process.env.PERF_DESMOS_ENV_FILE, "VITE_DESMOS_API_KEY") ||
    ""
  ).trim();
}
