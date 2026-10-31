#!/usr/bin/env node
// Screenshots of the new board objects (Worked Solution, Molecule) on the isolated lab fixture
// (synthetic local learner, stubbed backend). Never signs in or touches account data.
// Usage: node scripts/perf/whiteboard-objects-screens.mjs [--out docs/whiteboard-mission/screens-after]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { resolveDesmosKey } from "./desmos-key.mjs";

const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? process.argv[outArg + 1] : "docs/whiteboard-mission/screens-after";
const LAB = process.env.PERF_LAB_URL ?? "http://127.0.0.1:5198/e2e/fixtures/lab.html";
const KEY = resolveDesmosKey();
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist"] });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(KEY ? error.message.replaceAll(KEY, "[redacted]") : error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 200)}`); });
  await page.addInitScript((key) => {
    if (location.hostname === "127.0.0.1" && key) window.__BINDER_NOTES_DESMOS_API_KEY__ = key;
    localStorage.setItem("bindernotes:whiteboard:focus-hint-seen", "1");
  }, KEY);
  await page.goto(`${LAB}?page=whiteboard`);
  await page.getByRole("button", { name: "New Whiteboard" }).first().click({ timeout: 60_000 });
  await page.locator(".excalidraw__canvas.interactive").waitFor({ timeout: 60_000 });

  const add = async (name) => {
    await page.getByRole("button", { name: /^Add module/ }).first().click();
    await page.getByRole("button", { name }).first().click();
  };

  // Worked Solution: generate steps for a quadratic, then let the local engine check them.
  await add(/Worked Solution/i);
  const generator = page.locator('section:has(h3:text-is("Generate steps")) input').first();
  await generator.waitFor({ timeout: 30_000 });
  await generator.fill("x^2-5x+6=0");
  await page.getByRole("button", { name: /^Generate$/ }).first().click();
  await page.waitForTimeout(8000);
  await page.screenshot({ path: join(OUT, "11-worked-solution.png") });
  const chips = await page.locator('[aria-label^="Verified"], [aria-label^="Checked"], [aria-label*="Doesn"], [aria-label*="Not checked"]').count();
  console.log(`worked solution: ${chips} check chips visible`);

  // Molecule: caffeine from the built-in library.
  await add(/^Molecule/i);
  const molecule = page.getByRole("combobox", { name: "Molecule name or SMILES" }).or(page.getByRole("textbox", { name: "Molecule name or SMILES" })).first();
  await molecule.waitFor({ timeout: 30_000 });
  await molecule.fill("caffeine");
  await molecule.press("Enter");
  // RDKit drawings carry bond paths; icons do not.
  const drawn = await page.locator('[data-whiteboard-module="chem-molecule"] svg path[class*="bond"]').first().waitFor({ state: "attached", timeout: 60_000 }).then(() => true, () => false);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, "12-molecule.png") });
  console.log(`molecule: ${drawn ? "drawn" : "NOT drawn"}`);
  await context.close();
} finally {
  await browser.close();
}
console.log(`page errors: ${errors.slice(0, 5).join(" | ") || "none"}`);
