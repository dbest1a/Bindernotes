import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", fullyParallel: false, workers: 1, retries: 0,
  use: { baseURL: "http://127.0.0.1:5174", trace: "off", video: "off", screenshot: "off" },
  reporter: "list",
  webServer: { command: "node scripts/ci/start-client.mjs", url: "http://127.0.0.1:5174/auth", reuseExistingServer: false },
});
