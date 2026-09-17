import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const manifest = JSON.parse(await readFile(process.env.BINDERNOTES_E2E_MANIFEST ?? ".tmp/ci-supabase/runtime.json", "utf8"));
assert(["localhost", "127.0.0.1"].includes(new URL(manifest.apiUrl).hostname), "E2E backend must be disposable and local");
const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", "vite.config.ts", "--configLoader", "runner", "--host", "127.0.0.1", "--port", "5174", "--strictPort"], {
  stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: manifest.apiUrl, VITE_SUPABASE_ANON_KEY: manifest.anonKey, VITE_TELEMETRY_ENABLED: "false" },
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
