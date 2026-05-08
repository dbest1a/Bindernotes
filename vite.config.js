import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
var configDir = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    var normalizedId = id.replace(/\\/g, "/");
                    if (!normalizedId.includes("/node_modules/")) {
                        return undefined;
                    }
                    if (normalizedId.includes("/@supabase/")) {
                        return "supabase";
                    }
                    if (normalizedId.includes("/katex/")) {
                        return "katex";
                    }
                    if (normalizedId.includes("/react/") ||
                        normalizedId.includes("/react-dom/") ||
                        normalizedId.includes("/react-router/") ||
                        normalizedId.includes("/scheduler/")) {
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
            "**/.codex-deploy-*/**",
        ],
    },
    resolve: {
        alias: {
            "@": path.resolve(configDir, "./src"),
        },
    },
});
