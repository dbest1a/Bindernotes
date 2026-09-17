import { spawnSync } from "node:child_process";
import path from "node:path";

// Format tracked application/runtime/config sources, not generated marketing artifacts,
// media, historical SQL, credential files or build outputs.
const tracked = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
if (tracked.status !== 0) throw new Error("Could not enumerate tracked sources");
const files = tracked.stdout.split("\0").filter((file) =>
  /^(?:src\/|server\/|api\/|e2e\/|scripts\/(?:ci|database)\/)/.test(file) && /\.(?:ts|tsx|js|mjs|json)$/.test(file) && !file.endsWith("database.generated.ts"),
);
files.push("package.json", "tsconfig.json", "tsconfig.node.json", "tsconfig.server.json", "vercel.json", "vite.config.ts", "eslint.config.mjs", ".prettierrc.json");
const mode = process.argv.includes("--write") ? "--write" : "--check";
for (let offset = 0; offset < files.length; offset += 50) {
  const result = spawnSync(process.execPath, [path.resolve("node_modules/prettier/bin/prettier.cjs"), mode, ...files.slice(offset, offset + 50)], { stdio: "inherit" });
  if (result.status !== 0) process.exitCode = 1;
}
