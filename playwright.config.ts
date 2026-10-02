import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 45_000,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5196",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: [{
    command: "node node_modules/vite/bin/vite.js --config e2e/fixtures/vite.config.ts --configLoader runner",
    url: "http://127.0.0.1:5196/e2e/fixtures/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  }, {
    command: "node node_modules/vite/bin/vite.js --config vite.config.ts --configLoader runner --host 127.0.0.1 --port 5197 --strictPort",
    url: "http://127.0.0.1:5197/auth",
    env: { VITE_SUPABASE_URL: "https://browser-fixture.invalid", VITE_SUPABASE_ANON_KEY: "browser-synthetic-public-placeholder" },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  }],
});
