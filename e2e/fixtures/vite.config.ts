import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Isolated component fixtures: no production authentication or backend writes.
export default defineConfig({
  cacheDir: "node_modules/.vite-e2e-fixtures",
  plugins: [react()],
  optimizeDeps: { entries: ["e2e/fixtures/index.html"] },
  resolve: { alias: [
    { find: "@/lib/desmos-loader", replacement: path.resolve("e2e/fixtures/desmos-loader.ts") },
    { find: "@/lib/supabase", replacement: path.resolve("e2e/fixtures/supabase.ts") },
    { find: "@/components/workspace/workspace-modules", replacement: path.resolve("e2e/fixtures/modules.tsx") },
    { find: "@", replacement: path.resolve("src") },
  ] },
  server: { host: "127.0.0.1", port: 5196, strictPort: true },
});
