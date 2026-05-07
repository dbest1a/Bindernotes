import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes("node_modules/@excalidraw")) return "whiteboard-engine";
          if (id.includes("node_modules/@dnd-kit")) return "drag-drop";
          if (id.includes("node_modules/katex")) return "math";
          if (id.includes("node_modules/@supabase")) return "supabase";
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
      "**/.codex-deploy-*/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
