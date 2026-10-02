import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_STAGING_URL;
if (!baseURL || !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD || !process.env.E2E_NOTE_PATH) {
  throw new Error("Set E2E_STAGING_URL, E2E_EMAIL, E2E_PASSWORD and E2E_NOTE_PATH for a disposable staging account and TEST note.");
}
const host = new URL(baseURL).hostname;
if (host === "bindernotes.com" || host === "www.bindernotes.com") {
  throw new Error("Use a staging deployment and disposable TEST note; this suite refuses production.");
}
export default defineConfig({
  testDir: "./e2e/staging",
  testMatch: "**/*.staging.ts",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: "list",
  use: { baseURL, trace: "off", screenshot: "off", video: "off" },
});
