import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const urlIndex = args.indexOf("--url");
const url = (urlIndex >= 0 ? args[urlIndex + 1] : process.env.AUTH_VERIFY_URL) || "https://www.bindernotes.com/auth";
const executablePath = process.env.AUTH_VERIFY_BROWSER;
if (executablePath && !existsSync(executablePath)) throw new Error("AUTH_VERIFY_BROWSER does not exist.");
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : process.platform === "win32" ? { channel: "chrome" } : {}),
});
try {
  // An isolated context verifies signed-out rendering without touching account data.
  const page = await browser.newPage({ viewport: { width: 1180, height: 757 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (!response?.ok()) throw new Error(`Auth verification failed: HTTP ${response?.status() ?? "unavailable"}`);
  await page.getByLabel("Email", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  await page.getByLabel("Password", { exact: true }).waitFor({ state: "visible" });
  const body = await page.locator("body").innerText();
  for (const text of ["Supabase configuration required", "Auth setup required", "Demo mode", "Learner demo", "Admin demo"]) {
    if (body.includes(text)) throw new Error(`Auth verification failed: blocked text ${text}`);
  }
  if (await page.locator('[data-auth-config-missing="true"]').count()) throw new Error("Auth configuration is missing.");
  for (const text of ["Login", "Signup", "Continue with Google"]) {
    if (!body.includes(text)) throw new Error(`Auth verification failed: missing ${text}`);
  }
  if (await page.getByLabel("Email", { exact: true }).isDisabled()) throw new Error("Auth controls are disabled.");
  if (errors.length) throw new Error(`Auth page runtime errors: ${errors.join("; ")}`);
  console.log(`Signed-out auth rendering verified at ${url}. Authenticated save/load requires the staging suite.`);
} finally {
  await browser.close();
}
