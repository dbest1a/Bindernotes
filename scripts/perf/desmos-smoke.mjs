#!/usr/bin/env node
// Desmos smoke test on the isolated lab fixture (synthetic learner, stubbed backend; never signs in).
// Opens every Desmos calculator type the app uses and reports what actually rendered:
//   board: Desmos Graph card (2D), switched to 3D from its footer, and the Scientific Calculator card
//   (the app's own calculator on boards);
//   Math Lab page: its graph surface.
// Usage: node scripts/perf/desmos-smoke.mjs [--out .tmp/desmos-smoke]
// Needs the lab fixture on 5198 and a Desmos key (see scripts/perf/desmos-key.mjs; never printed).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { resolveDesmosKey } from "./desmos-key.mjs";

const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? process.argv[outArg + 1] : ".tmp/desmos-smoke";
const LAB = process.env.PERF_LAB_URL ?? "http://127.0.0.1:5198/e2e/fixtures/lab.html";
const KEY = resolveDesmosKey();
if (!KEY) throw new Error("No Desmos key found; the smoke test needs the real API.");
mkdirSync(OUT, { recursive: true });
const redact = (text) => String(text).replaceAll(KEY, "[redacted]");

// Records every calculator the app creates, by kind, through a Proxy on window.Desmos.
function initScript(key) {
  if (location.hostname === "127.0.0.1") window.__BINDER_NOTES_DESMOS_API_KEY__ = key;
  localStorage.setItem("bindernotes:whiteboard:focus-hint-seen", "1");
  const created = (window.__desmosCreated = []);
  let api;
  Object.defineProperty(window, "Desmos", {
    configurable: true,
    get: () => api,
    set: (value) => {
      api = value && typeof value === "object"
        ? new Proxy(value, {
            get(target, prop, receiver) {
              const original = Reflect.get(target, prop, receiver);
              if (typeof original !== "function" || !/Calculator|Geometry/.test(String(prop))) return original;
              return function (...args) {
                const calculator = original.apply(this, args);
                created.push({ kind: String(prop), calculator, container: args[0] });
                return calculator;
              };
            },
          })
        : value;
    },
  });
}

// For each recorded calculator: kind, whether its container is attached and sized, and (2D/3D)
// how many expressions it holds with errors.
async function describeCalculators(page) {
  return page.evaluate(() =>
    window.__desmosCreated.map(({ kind, calculator, container }) => {
      const rect = container.getBoundingClientRect();
      const drawn = container.querySelector("canvas, .dcg-calculator-api-container, .dcg-container") !== null;
      let expressions = null;
      let errors = 0;
      try {
        if (typeof calculator.getExpressions === "function") {
          const list = calculator.getExpressions();
          expressions = list.length;
          const analysis = calculator.expressionAnalysis ?? {};
          errors = Object.values(analysis).filter((entry) => entry?.isError).length;
        }
      } catch {
        expressions = "unreadable";
      }
      return { kind, attached: container.isConnected, width: Math.round(rect.width), height: Math.round(rect.height), drawn, expressions, errors };
    }),
  );
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const problems = [];
const report = {};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(redact(error.message)));
  page.on("console", (message) => {
    // The fixture page declares no favicon, so the browser's /favicon.ico probe 404s there only.
    if (message.type() === "error" && !(message.location()?.url ?? "").endsWith("/favicon.ico")) errors.push(`console: ${redact(message.text()).slice(0, 200)} (${redact(message.location()?.url ?? "").slice(0, 160)})`);
  });
  const failedRequests = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${redact(response.url()).slice(0, 160)}`);
  });
  await page.addInitScript(initScript, KEY);

  // Board: 2D graph, then the same card in 3D, then the scientific calculator.
  await page.goto(`${LAB}?page=whiteboard`);
  await page.getByRole("button", { name: "New Whiteboard" }).first().click({ timeout: 60_000 });
  await page.locator(".excalidraw__canvas.interactive").waitFor({ timeout: 60_000 });
  const add = async (name) => {
    await page.getByRole("button", { name: /^Add module/ }).first().click();
    await page.getByRole("button", { name }).first().click();
  };
  await add(/^Desmos Graph/);
  await page.waitForFunction(() => window.__desmosCreated.some((entry) => entry.kind === "GraphingCalculator"), null, { timeout: 60_000 });
  const threeD = page.getByRole("button", { name: /3D/ }).first();
  if (await threeD.isVisible().catch(() => false)) {
    await threeD.click();
    await page.waitForFunction(() => window.__desmosCreated.some((entry) => entry.kind === "Calculator3D"), null, { timeout: 60_000 }).catch(() => problems.push("board: no 3D calculator after choosing 3D"));
  } else {
    problems.push("board: no 3D switch found on the graph card");
  }
  // On a board the Scientific Calculator card is the app's own calculator (lighter than Desmos).
  await add(/^Scientific Calculator/);
  await page.getByRole("heading", { name: "Scientific calculator" }).first().waitFor({ timeout: 30_000 }).catch(() => problems.push("board: scientific calculator card did not render"));
  await page.waitForTimeout(1500);
  report.board = await describeCalculators(page);
  await page.screenshot({ path: join(OUT, "board-desmos.png") });

  // Math Lab page.
  await page.goto(`${LAB}?page=math-lab`);
  await page.waitForFunction(() => window.__desmosCreated.length > 0, null, { timeout: 60_000 }).catch(() => problems.push("math lab: no Desmos calculator"));
  await page.waitForTimeout(1500);
  report.mathLab = await describeCalculators(page);
  await page.screenshot({ path: join(OUT, "math-lab-desmos.png") });

  for (const [surface, calculators] of Object.entries(report)) {
    for (const calculator of calculators.filter((entry) => entry.attached)) {
      if (!calculator.drawn || calculator.width < 100 || calculator.height < 100) problems.push(`${surface}: ${calculator.kind} not drawn at a usable size`);
      if (calculator.errors > 0) problems.push(`${surface}: ${calculator.kind} has ${calculator.errors} expression errors`);
    }
  }
  report.pageErrors = errors.slice(0, 8);
  report.failedRequests = failedRequests.slice(0, 8);
  if (errors.length) problems.push(`${errors.length} page or console errors`);
  await context.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
console.log(problems.length ? `PROBLEMS:\n- ${problems.join("\n- ")}` : "Desmos smoke: every surface rendered, no errors.");
process.exitCode = problems.length ? 1 : 0;
