#!/usr/bin/env node
// Audit screenshots of the real whiteboard, labs and chemistry modules on the isolated fixtures
// (synthetic local learner, stubbed backend). Never signs in or touches account data.
// Usage: node scripts/perf/whiteboard-audit-screens.mjs [--out docs/whiteboard-mission/screens]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { resolveDesmosKey } from "./desmos-key.mjs";

const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? process.argv[outArg + 1] : "docs/whiteboard-mission/screens";
const LAB = process.env.PERF_LAB_URL ?? "http://127.0.0.1:5198/e2e/fixtures/lab.html";
const BOARD = process.env.PERF_BASE_URL ?? "http://127.0.0.1:5196";
const KEY = resolveDesmosKey();
mkdirSync(OUT, { recursive: true });
const notes = [];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist"] });

async function session(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(KEY ? error.message.replaceAll(KEY, "[redacted]") : error.message));
  // The key reaches only loopback fixture documents.
  await page.addInitScript((key) => { if (location.hostname === "127.0.0.1" && key) window.__BINDER_NOTES_DESMOS_API_KEY__ = key; }, KEY);
  const entry = { context, page, errors };
  sessions.push(entry);
  return entry;
}
async function shot(page, name, note) {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  notes.push({ name, note, status: "captured" });
}
const skip = (name, reason) => notes.push({ name, note: reason, status: "NOT CAPTURED" });
const sessions = [];

try {
// 1. Whiteboard lab first run (desktop), then a new board, the launcher and a live Desmos card.
{
  const { context, page, errors } = await session({ width: 1440, height: 900 });
  await page.goto(`${LAB}?page=whiteboard`);
  await page.getByRole("button", { name: "New Whiteboard" }).first().waitFor({ timeout: 60_000 });
  await shot(page, "01-lab-first-run-picker", "Signed-in first run shows a board picker before any canvas");
  await page.getByRole("button", { name: "New Whiteboard" }).first().click();
  await page.locator(".excalidraw__canvas.interactive").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await shot(page, "02-lab-new-board", "New empty lab board: chrome, hints and side panel");
  const add = page.getByRole("button", { name: /^Add module/ }).first();
  if (!(await add.count())) skip("03-lab-add-module-launcher", "Add module button not found");
  else {
    await add.click();
    await page.waitForTimeout(700);
    await shot(page, "03-lab-add-module-launcher", "Add module launcher");
    const desmos = page.getByRole("button", { name: /Desmos graph/i }).first();
    if (!(await desmos.count())) skip("04-lab-desmos-card", "Desmos graph launcher entry not found");
    else {
      await desmos.click();
      const live = await page.locator("[data-desmos-canvas] canvas.dcg-graph-inner").first().waitFor({ timeout: 30_000 }).then(() => true, () => false);
      await page.waitForTimeout(1200);
      await shot(page, "04-lab-desmos-card", live ? "Live Desmos card on the dark lab board" : "Desmos card (graph did NOT become ready)");
      const second = page.getByRole("button", { name: /^Add module/ }).first();
      await second.click();
      await page.waitForTimeout(500);
      const calculator = page.getByRole("button", { name: /Scientific calculator|Calculator/i }).first();
      if (!(await calculator.count())) skip("05-lab-second-module-placement", "Scientific calculator launcher entry not found");
      else {
        await calculator.click();
        await page.waitForTimeout(1200);
        await shot(page, "05-lab-second-module-placement", "Second module placement relative to the first");
      }
    }
  }
  notes.push({ name: "lab-desktop-errors", note: errors.slice(0, 5).join(" | ") || "none" });
  await context.close();
}

// 2. Mobile whiteboard lab.
{
  const { context, page } = await session({ width: 390, height: 844 });
  await page.goto(`${LAB}?page=whiteboard`);
  await page.getByRole("button", { name: "New Whiteboard" }).first().click({ timeout: 60_000 });
  await page.locator(".excalidraw__canvas.interactive").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await shot(page, "06-lab-mobile-board", "Mobile lab board at 390×844");
  await context.close();
}

// 3. Math Lab page.
{
  const { context, page } = await session({ width: 1440, height: 900 });
  await page.goto(`${LAB}?page=math-lab`);
  await page.waitForTimeout(2500);
  await shot(page, "07-math-lab", "Math Lab page");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(800);
  await shot(page, "08-math-lab-scrolled", "Math Lab page, scrolled");
  await context.close();
}

// 4. Chemistry modules.
{
  const { context, page } = await session({ width: 1440, height: 900 });
  for (const id of ["chem-molecule-builder", "chem-geometry-viewer", "chem-titration-lab", "chem-desmos-titration-curve", "chem-ph-calculator", "chem-kinetics-simulator", "chem-energy-diagram", "chem-periodic-table"]) {
    await page.goto(`${LAB}?page=chemistry&module=${id}`);
    await page.waitForTimeout(2500);
    await shot(page, `09-chem-${id}`, `Chemistry module ${id}`);
  }
  await context.close();
}

// 5. Study workspace fixture (panels, notes focus) and a dense board with Desmos for pan feel.
{
  const { context, page } = await session({ width: 1440, height: 900 });
  await page.goto(`${BOARD}/e2e/fixtures/index.html?preset=notes-focus`);
  await page.waitForTimeout(2500);
  await shot(page, "10-study-workspace", "Study workspace (Notes Focus) fixture");
  await context.close();
}

notes.push({ name: "page-errors", note: sessions.flatMap((entry) => entry.errors).slice(0, 8).join(" | ") || "none", status: "info" });
} finally {
  await browser.close();
}
writeFileSync(join(OUT, "README.md"), ["# Whiteboard audit screenshots", "", "Captured on isolated fixtures (synthetic local learner, stubbed backend).", "", ...notes.map((note) => `- \`${note.name}\`: ${note.note}`)].join("\n") + "\n");
console.log(notes.map((note) => `${note.name}: ${note.note}`).join("\n"));
