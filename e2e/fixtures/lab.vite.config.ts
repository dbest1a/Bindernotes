import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Isolated lab fixture: real pages and module registry, a synthetic local learner,
// and a stubbed Supabase client. No production authentication or backend writes.
export default defineConfig({
  cacheDir: "node_modules/.vite-e2e-lab",
  plugins: [react()],
  optimizeDeps: { entries: ["e2e/fixtures/lab.html"] },
  resolve: { alias: [
    { find: "@/lib/desmos-loader", replacement: path.resolve("e2e/fixtures/desmos-loader.ts") },
    { find: "@/lib/supabase", replacement: path.resolve("e2e/fixtures/supabase.ts") },
    { find: "@/hooks/use-auth", replacement: path.resolve("e2e/fixtures/auth.tsx") },
    { find: "@", replacement: path.resolve("src") },
  ] },
  server: {
    host: "127.0.0.1", port: 5198, strictPort: true,
    watch: { ignored: ["**/.tmp/**", "**/playwright-report/**", "**/test-results/**"] },
  },
});
