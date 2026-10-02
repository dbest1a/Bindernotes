import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const buildInfo = (() => {
  try {
    return {
      commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: configDir, encoding: "utf8" }).trim(),
      dirty: Boolean(execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: configDir, encoding: "utf8" }).trim()),
      builtAt: new Date().toISOString(),
    };
  } catch {
    return { commit: "unavailable", dirty: true, builtAt: new Date().toISOString() };
  }
})();

export default defineConfig({
  define: { __BUILD_INFO__: JSON.stringify(buildInfo) },
  plugins: [react(), {
    name: "build-identity",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "build-info.json", source: JSON.stringify(buildInfo, null, 2) });
    },
  }],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (!normalizedId.includes("/node_modules/")) {
            return undefined;
          }

          if (normalizedId.includes("/@supabase/")) {
            return "supabase";
          }

          if (normalizedId.includes("/katex/")) {
            return "katex";
          }

          if (
            normalizedId.includes("/react/") ||
            normalizedId.includes("/react-dom/") ||
            normalizedId.includes("/react-router/") ||
            normalizedId.includes("/scheduler/")
          ) {
            return "react-vendor";
          }

          if (normalizedId.includes("/@tanstack/react-query/")) {
            return "query-vendor";
          }

          return undefined;
        },
      },
    },
  },
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/.tmp/**",
      "**/e2e/**",
      "**/.codex-deploy-*/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(configDir, "./src"),
    },
  },
});
