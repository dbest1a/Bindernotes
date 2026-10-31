import { defineConfig, mergeConfig } from "vite";
import base from "./lab.vite.config";

// Production build of the isolated lab fixture (synthetic learner, stubbed backend).
// Build: vite build --config e2e/fixtures/perf-lab.vite.config.ts
// Serve: vite preview --config e2e/fixtures/perf-lab.vite.config.ts (http://127.0.0.1:5200)
export default mergeConfig(base, defineConfig({
  mode: "production",
  build: { outDir: ".tmp/perf-build/lab", emptyOutDir: true, rollupOptions: { input: { lab: "e2e/fixtures/lab.html" } } },
  preview: { host: "127.0.0.1", port: 5200, strictPort: true },
}));
