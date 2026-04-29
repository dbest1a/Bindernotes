var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { configDefaults, defineConfig } from "vitest/config";
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
    test: {
        exclude: __spreadArray(__spreadArray([], configDefaults.exclude, true), [
            ".tmp/**",
            "artifacts/**",
            "output/**",
            "test-results/**",
            "tutorial-videos/**",
        ], false),
    },
});
