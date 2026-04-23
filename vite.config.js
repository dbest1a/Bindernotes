import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    if (id.includes("node_modules/@tiptap"))
                        return "editor";
                    if (id.includes("node_modules/katex"))
                        return "math";
                    if (id.includes("node_modules/@supabase"))
                        return "supabase";
                    if (id.includes("node_modules/react") || id.includes("node_modules/react-dom"))
                        return "react";
                },
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
