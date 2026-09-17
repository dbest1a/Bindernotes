import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";

export default ts.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".tmp/**",
      ".vercel/**",
      "artifacts/**",
      "output/**",
      "tutorial-videos/**",
      ".agents/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}", "server/**/*.ts", "api/**/*.ts", "e2e/**/*.ts"],
    extends: [js.configs.recommended, ...ts.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
  {
    files: ["scripts/**/*.{js,mjs}", "*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
