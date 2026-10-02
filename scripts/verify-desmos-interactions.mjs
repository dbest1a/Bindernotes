import { spawnSync } from "node:child_process";
import { loadClientEnvFiles } from "./client-env-guard.mjs";

const configured = {};
loadClientEnvFiles({ env: configured });
const apiKey = process.env.E2E_DESMOS_API_KEY || process.env.VITE_DESMOS_API_KEY || configured.VITE_DESMOS_API_KEY;
if (!apiKey) throw new Error("Set E2E_DESMOS_API_KEY or configure VITE_DESMOS_API_KEY to verify the real graph. No mock calculator is substituted.");
const result = spawnSync(process.execPath, [
  "node_modules/@playwright/test/cli.js", "test", "e2e/desmos.spec.ts", "--workers=1", ...process.argv.slice(2),
], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...(process.platform === "win32" && !process.env.PLAYWRIGHT_CHANNEL ? { PLAYWRIGHT_CHANNEL: "chrome" } : {}),
    E2E_DESMOS_API_KEY: apiKey,
  },
});
process.exit(result.status ?? 1);
