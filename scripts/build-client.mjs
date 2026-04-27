import { spawnSync } from "node:child_process";
import { join } from "node:path";

import {
  assertRequiredClientEnv,
  loadClientEnvFiles,
  validateBuiltClientOutput,
} from "./client-env-guard.mjs";

const mode = process.env.MODE || "production";
const cwd = process.cwd();

const loadedFiles = loadClientEnvFiles({ cwd, env: process.env, mode });
assertRequiredClientEnv(process.env);

runNodeBin("typescript", "bin/tsc", ["-b"]);
runNodeBin("vite", "bin/vite.js", ["build", "--mode", mode]);

validateBuiltClientOutput({ cwd, env: process.env, outDir: "dist" });
console.log(
  `Client build guard passed: Supabase auth config was present and embedded. Env files checked: ${
    loadedFiles.length ? loadedFiles.join(", ") : "process environment"
  }.`,
);

function runNodeBin(packageName, binPath, args) {
  const scriptPath = join(cwd, "node_modules", packageName, ...binPath.split("/"));
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}
