import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

// Production build of the isolated board fixture, for performance budgets without React
// development-mode overhead. Build: vite build --config e2e/fixtures/perf-board.vite.config.ts
// Serve: vite preview --config e2e/fixtures/perf-board.vite.config.ts (http://127.0.0.1:5199)
// PERF_PROFILE_BUILD=1 builds the same production code unminified into a separate folder, so
// CPU profiles show real function names (serve it with --outDir and another --port).
const profileBuild = process.env.PERF_PROFILE_BUILD === "1";

export default mergeConfig(base, defineConfig({
  mode: "production",
  build: {
    outDir: profileBuild ? ".tmp/perf-build/board-profile" : ".tmp/perf-build/board",
    emptyOutDir: true,
    minify: profileBuild ? false : undefined,
    rollupOptions: { input: { index: "e2e/fixtures/index.html" } },
  },
  preview: { host: "127.0.0.1", port: 5199, strictPort: true },
}));
