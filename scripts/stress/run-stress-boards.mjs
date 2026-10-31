#!/usr/bin/env node
// Opens each whiteboard stress-test board (scripts/stress/boards/qNN.json) in the isolated lab
// fixture (synthetic local learner, stubbed backend, boards in localStorage), waits for every card
// to render, runs the Worked Solution card's "Check all steps", and saves a screenshot plus a JSON
// summary per question. Never signs in or touches account data.
//
// Usage:
//   node scripts/stress/run-stress-boards.mjs [--only 1,3,15] [--out .tmp/stress-boards] [--headed]
// Env: PERF_LAB_URL (default http://127.0.0.1:5198/e2e/fixtures/lab.html),
//      PERF_DESMOS_ENV_FILE / E2E_DESMOS_API_KEY / VITE_DESMOS_API_KEY (Desmos key, never printed).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { resolveDesmosKey } from "../perf/desmos-key.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BOARDS_DIR = join(HERE, "boards");
const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const OUT = argValue("--out") ?? ".tmp/stress-boards";
const ONLY = (argValue("--only") ?? "")
  .split(",")
  .map((value) => Number.parseInt(value, 10))
  .filter(Number.isFinite);
const HEADED = process.argv.includes("--headed");
const LAB = process.env.PERF_LAB_URL ?? "http://127.0.0.1:5198/e2e/fixtures/lab.html";
const KEY = resolveDesmosKey();
const VIEWPORT = { width: 1440, height: 900 };
const CARD_TIMEOUT_MS = 90_000;
const CHECK_TIMEOUT_MS = 120_000;

// The lab page's synthetic learner and Math Lab scope (see e2e/fixtures/auth.tsx and
// src/pages/math-whiteboard-lab-page.tsx). Storage key: getWhiteboardStorageKey(scope).
const SCOPE = { ownerId: "fixture-learner", binderId: "math-lab", lessonId: "math-lab-whiteboard" };
const STORAGE_KEY = ["bindernotes:whiteboards", SCOPE.ownerId, SCOPE.binderId, SCOPE.lessonId].join(":");
const HINT_KEY = "bindernotes:whiteboard:focus-hint-seen";

const redact = (text) => (KEY ? String(text).replaceAll(KEY, "[redacted]") : String(text));

function loadBoards() {
  const files = readdirSync(BOARDS_DIR).filter((name) => /^q\d\d\.json$/.test(name)).sort();
  return files
    .map((name) => ({ number: Number.parseInt(name.slice(1, 3), 10), file: name, spec: JSON.parse(readFileSync(join(BOARDS_DIR, name), "utf8")) }))
    .filter((entry) => ONLY.length === 0 || ONLY.includes(entry.number));
}

/** Turns a board spec into a BinderWhiteboard exactly as the app stores it in local mode. */
function buildBoard({ number, spec }) {
  const timestamp = new Date().toISOString();
  const modules = spec.modules.map((module, index) => ({
    type: "bindernotes-module",
    mode: "live",
    zIndex: index + 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...module,
    ...(module.moduleId === "desmos-graph" && !module.graphInstanceId ? { graphInstanceId: `whiteboard-desmos-${module.id}` } : {}),
  }));
  return {
    id: `whiteboard-stress-q${String(number).padStart(2, "0")}`,
    ownerId: SCOPE.ownerId,
    binderId: SCOPE.binderId,
    lessonId: SCOPE.lessonId,
    title: spec.title,
    subject: spec.subject ?? "Math",
    moduleContext: "lesson",
    scene: {
      elements: spec.elements ?? [],
      appState: { viewBackgroundColor: "#11131a", scrollX: 0, scrollY: 0, zoom: { value: 1 }, ...(spec.appState ?? {}) },
      files: {},
    },
    modules,
    thumbnailDataUrl: null,
    objectCount: 0,
    sceneSizeBytes: 0,
    assetSizeBytes: 0,
    storageMode: "local-draft",
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  };
}

// Runs in the page before any app code: the Desmos key (loopback fixture only), the first-run hint,
// and a Proxy on window.Desmos that records every 2D/3D calculator so expression errors can be read.
function initScript({ key, hintKey }) {
  if (location.hostname === "127.0.0.1" && key) window.__BINDER_NOTES_DESMOS_API_KEY__ = key;
  localStorage.setItem(hintKey, "1");
  const calculators = (window.__stressCalculators = []);
  let api;
  const wrap = (kind, create) =>
    function (...args) {
      const calculator = create.apply(this, args);
      calculators.push({ kind, calculator, container: args[0] });
      return calculator;
    };
  Object.defineProperty(window, "Desmos", {
    configurable: true,
    get: () => api,
    set: (value) => {
      api = value && typeof value === "object"
        ? new Proxy(value, {
            get(target, prop, receiver) {
              const original = Reflect.get(target, prop, receiver);
              if (typeof original !== "function") return original;
              if (prop === "GraphingCalculator" || prop === "Calculator") return wrap("2d", original);
              if (prop === "Calculator3D") return wrap("3d", original);
              return original;
            },
          })
        : value;
    },
  });
}

async function seedBoard(page, board) {
  // Validate with the app's own sanitizer (served by the Vite dev server) and store the sanitized board.
  return page.evaluate(
    async ({ board, storageKey, hintKey }) => {
      const serialization = await import("/src/lib/whiteboards/whiteboard-serialization.ts");
      const sanitized = serialization.sanitizeWhiteboardForStorage(board);
      const validation = serialization.validateWhiteboardForStorage(board);
      const problems = [...validation.errors];
      const stable = (value) => JSON.stringify(value, (_key, item) => (item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item));
      sanitized.modules.forEach((module, index) => {
        const original = board.modules[index];
        for (const field of ["solution", "molecule", "graphWorkspace"]) {
          if (original[field] !== undefined && stable(original[field]) !== stable(module[field])) {
            problems.push(`module ${original.id}: the sanitizer changed or dropped "${field}"`);
          }
        }
      });
      localStorage.clear();
      localStorage.setItem(hintKey, "1");
      localStorage.setItem(storageKey, JSON.stringify([sanitized]));
      return { problems, warnings: validation.warnings, objectCount: validation.objectCount, sceneSizeBytes: validation.sceneSizeBytes };
    },
    { board, storageKey: STORAGE_KEY, hintKey: HINT_KEY },
  );
}

/** Polls the DOM until every card reports ready; returns per-card status. */
async function waitForCards(page, modules, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await page.evaluate((modules) => {
      const results = {};
      for (const module of modules) {
        const card = document.querySelector(`[data-testid="whiteboard-module-card-${module.id}"]`) ?? document.querySelector(`[data-whiteboard-module-id="${module.id}"]`);
        const entry = { moduleId: module.moduleId, present: Boolean(card), ready: false };
        if (card) {
          if (module.moduleId === "desmos-graph") {
            const surface = card.querySelector("[data-desmos-status]");
            entry.desmosStatus = surface?.getAttribute("data-desmos-status") ?? null;
            const canvas = card.querySelector("[data-desmos-canvas] canvas");
            entry.ready = entry.desmosStatus === "ready" && Boolean(canvas);
          } else if (module.moduleId === "chem-molecule") {
            const drawing = card.querySelector('[data-testid="molecule-drawing"]');
            entry.bondPaths = drawing ? drawing.querySelectorAll('path[class*="bond"]').length : 0;
            entry.alert = card.querySelector('[role="alert"]')?.textContent?.trim().slice(0, 200) ?? null;
            entry.ready = entry.bondPaths > 0;
          } else if (module.moduleId === "solution-steps") {
            const rows = card.querySelectorAll("li.solution-step");
            const katex = card.querySelectorAll("li.solution-step .katex");
            const katexErrors = card.querySelectorAll(".katex-error");
            entry.steps = rows.length;
            entry.katex = katex.length;
            entry.katexErrors = [...katexErrors].map((node) => node.getAttribute("title") ?? node.textContent).slice(0, 5);
            entry.ready = rows.length === module.expectedSteps && katex.length >= module.expectedSteps;
          } else {
            entry.ready = true;
          }
        }
        results[module.id] = entry;
      }
      return results;
    }, modules);
    if (Object.values(last).every((entry) => entry.ready)) return { ready: true, cards: last };
    await page.waitForTimeout(250);
  }
  return { ready: false, cards: last };
}

/** Reads every Desmos calculator's expressions and analysis (errors, evaluations). */
async function readDesmos(page) {
  return page.evaluate(() =>
    (window.__stressCalculators ?? []).map(({ kind, calculator, container }) => {
      const card = container?.closest?.("[data-whiteboard-module]");
      const moduleCardId = card?.getAttribute("data-testid")?.replace("whiteboard-module-card-", "") ?? null;
      let expressions = [];
      try {
        expressions = calculator.getExpressions();
      } catch {
        return { kind, moduleCardId, destroyed: true };
      }
      const analysis = calculator.expressionAnalysis ?? {};
      const errors = [];
      // Visible expressions Desmos will not draw, other than definitions (a=1, f(x)=…) and evaluations.
      const notPlotted = [];
      const definition = /^\s*\\?[A-Za-z]+(_\{[^}]*\})?(\\left)?(\([^)]*\))?(\\right\))?\s*=/;
      let graphable = 0;
      for (const expression of expressions) {
        const result = analysis[expression.id];
        if (result?.isError) errors.push({ id: expression.id, latex: expression.latex, error: result.errorMessage });
        if (result?.isGraphable) graphable += 1;
        else if (result && !result.isError && expression.type === "expression" && !expression.hidden && expression.latex && !definition.test(expression.latex) && !/^\\operatorname\{length\}/.test(expression.latex)) {
          notPlotted.push(expression.latex.slice(0, 120));
        }
      }
      return {
        kind,
        moduleCardId,
        connected: Boolean(container?.isConnected),
        expressions: expressions.length,
        graphable,
        analysisAvailable: Object.keys(analysis).length > 0,
        errors,
        notPlotted,
      };
    }),
  );
}

async function runSolutionChecks(page, moduleId) {
  const card = page.locator(`[data-testid="whiteboard-module-card-${moduleId}"]`);
  const region = card.locator(".solution-card");
  await region.getByRole("button", { name: "Edit steps" }).click();
  const checkButton = region.getByRole("button", { name: "Check all steps" });
  await checkButton.waitFor({ timeout: 30_000 });
  const started = Date.now();
  await checkButton.click();
  await page.waitForFunction(
    (id) => {
      const root = document.querySelector(`[data-testid="whiteboard-module-card-${id}"] .solution-card`);
      const status = root?.querySelector(':scope > p[role="status"]')?.textContent ?? "";
      return /Check complete|couldn't run/.test(status);
    },
    moduleId,
    { timeout: CHECK_TIMEOUT_MS },
  );
  const checkMs = Date.now() - started;
  const summary = await region.locator(':scope > p[role="status"]').textContent();
  await region.getByRole("button", { name: "Present steps" }).click();
  await page.waitForTimeout(400);
  const chips = await region.locator("li.solution-step .solution-chip").evaluateAll((nodes) =>
    nodes.map((node) => ({ status: node.getAttribute("data-status"), label: node.textContent?.trim() ?? "" })),
  );
  const steps = await page.evaluate(
    ({ storageKey, id }) => {
      const boards = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      const module = boards[0]?.modules?.find((item) => item.id === id);
      return module?.solution?.steps?.map((step) => ({ math: step.math, check: step.check ?? null })) ?? null;
    },
    { storageKey: STORAGE_KEY, id: moduleId },
  );
  const counts = { verified: 0, partly: 0, unchecked: 0, mismatch: 0, error: 0 };
  for (const chip of chips) {
    if (chip.status === "verified") counts.verified += 1;
    else if (chip.status === "mismatch") counts.mismatch += 1;
    else if (chip.status === "error") counts.error += 1;
    else if (chip.label === "Partly checked") counts.partly += 1;
    else counts.unchecked += 1;
  }
  return { checkMs, summary: summary?.trim() ?? "", counts, chips, steps };
}

async function runQuestion(browser, entry) {
  const tag = `q${String(entry.number).padStart(2, "0")}`;
  const board = buildBoard(entry);
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(redact(error.message).slice(0, 400)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(redact(message.text()).slice(0, 400));
  });
  const failedRequests = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${redact(response.url()).slice(0, 300)}`);
  });
  page.on("requestfailed", (request) => failedRequests.push(`failed ${redact(request.url()).slice(0, 300)} (${request.failure()?.errorText ?? "?"})`));
  await page.addInitScript(initScript, { key: KEY, hintKey: HINT_KEY });
  const result = { question: entry.number, title: entry.spec.title, file: entry.file, ok: false, failures: [] };
  try {
    // 1. Warm the dev server and seed the board through the app's own sanitizer.
    await page.goto(`${LAB}?page=chemistry&module=chem-periodic-table`, { waitUntil: "domcontentloaded" });
    const seed = await seedBoard(page, board);
    result.seed = seed;
    if (seed.problems.length) result.failures.push(...seed.problems.map((problem) => `seed: ${problem}`));

    // 2. Open the whiteboard; time from navigation to every card ready.
    const expected = board.modules.map((module) => ({
      id: module.id,
      moduleId: module.moduleId,
      expectedSteps: module.solution?.steps?.length ?? 0,
    }));
    const navigationStart = Date.now();
    await page.goto(`${LAB}?page=whiteboard`, { waitUntil: "domcontentloaded" });
    const startPanel = page.getByTestId("whiteboard-start-panel");
    const canvas = page.locator(".excalidraw__canvas.interactive");
    await Promise.race([startPanel.waitFor({ timeout: 60_000 }), canvas.waitFor({ timeout: 60_000 })]);
    if (await startPanel.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: new RegExp(entry.spec.title.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
    }
    await canvas.waitFor({ timeout: 60_000 });
    // Fold the board-controls panel into its chip (the app's own "Minimize whiteboard controls"),
    // so the right-hand cards are not covered at 1440×900.
    const minimize = page.getByTestId("whiteboard-controls-minimize");
    if (await minimize.isVisible().catch(() => false)) await minimize.click();
    const cards = await waitForCards(page, expected, CARD_TIMEOUT_MS);
    result.openMs = Date.now() - navigationStart;
    result.cardsReady = cards.ready;
    result.cards = cards.cards;
    if (!cards.ready) {
      for (const [id, card] of Object.entries(cards.cards ?? {})) {
        if (!card.ready) result.failures.push(`card ${id} (${card.moduleId}) did not render: ${JSON.stringify(card)}`);
      }
    }
    for (const [id, card] of Object.entries(cards.cards ?? {})) {
      if (card.katexErrors?.length) result.failures.push(`card ${id}: KaTeX errors ${JSON.stringify(card.katexErrors)}`);
    }

    // 3. Let Desmos finish evaluating, then read expression errors.
    await page.waitForTimeout(1500);
    result.desmos = await readDesmos(page);
    for (const calculator of result.desmos) {
      if (calculator.destroyed || calculator.connected === false) continue;
      if (calculator.expressions > 0 && calculator.graphable === 0) result.failures.push(`Desmos ${calculator.kind} on ${calculator.moduleCardId}: nothing plotted (expression analysis ${calculator.analysisAvailable ? "has no graphable expression" : "never ran"})`);
      if (calculator.notPlotted?.length) result.failures.push(`Desmos ${calculator.kind} on ${calculator.moduleCardId}: visible expression(s) not drawn: ${calculator.notPlotted.join("; ")}`);
      if (calculator.errors?.length) result.failures.push(`Desmos ${calculator.kind} on ${calculator.moduleCardId}: ${calculator.errors.length} expression error(s): ${calculator.errors.map((error) => `${error.latex} → ${error.error}`).join("; ")}`);
    }
    await page.screenshot({ path: join(OUT, `${tag}-board.png`) });

    // 4. Check all steps on each Worked Solution card.
    result.solutions = {};
    for (const module of board.modules.filter((item) => item.moduleId === "solution-steps")) {
      try {
        result.solutions[module.id] = await runSolutionChecks(page, module.id);
      } catch (error) {
        result.failures.push(`solution ${module.id}: check did not finish (${redact(error.message).split("\n")[0]})`);
      }
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `${tag}-checked.png`) });
    for (const module of board.modules) {
      const card = page.locator(`[data-testid="whiteboard-module-card-${module.id}"]`);
      if (await card.count()) await card.screenshot({ path: join(OUT, `${tag}-${module.id}.png`) }).catch(() => {});
    }
  } catch (error) {
    result.failures.push(`runner: ${redact(error.message).split("\n").slice(0, 3).join(" ")}`);
    await page.screenshot({ path: join(OUT, `${tag}-failure.png`) }).catch(() => {});
  } finally {
    result.pageErrors = pageErrors;
    result.consoleErrors = consoleErrors;
    result.failedRequests = failedRequests;
    if (pageErrors.length) result.failures.push(`${pageErrors.length} page error(s)`);
    result.ok = result.failures.length === 0;
    await context.close();
  }
  writeFileSync(join(OUT, `${tag}.json`), redact(JSON.stringify(result, null, 2)) + "\n");
  return result;
}

function summarize(result) {
  const counts = { verified: 0, partly: 0, unchecked: 0, mismatch: 0, error: 0 };
  for (const solution of Object.values(result.solutions ?? {})) {
    for (const [status, count] of Object.entries(solution.counts)) counts[status] += count;
  }
  const cards = Object.values(result.cards ?? {});
  const kinds = cards.reduce((acc, card) => ({ ...acc, [card.moduleId]: (acc[card.moduleId] ?? 0) + 1 }), {});
  return {
    q: result.question,
    ok: result.ok,
    openS: result.openMs ? (result.openMs / 1000).toFixed(1) : "-",
    cards: Object.entries(kinds).map(([kind, count]) => `${count}×${kind}`).join(" "),
    checks: `${counts.verified}/${counts.partly}/${counts.unchecked}/${counts.mismatch + counts.error}`,
    failures: result.failures,
  };
}

mkdirSync(OUT, { recursive: true });
if (!KEY) console.warn("No Desmos key found: Desmos cards will not render. Set PERF_DESMOS_ENV_FILE (see scripts/stress/README.md).");
const entries = loadBoards();
const browser = await chromium.launch({ channel: "chrome", headless: !HEADED, args: ["--ignore-gpu-blocklist"] });
const results = [];
try {
  for (const entry of entries) {
    const result = await runQuestion(browser, entry);
    results.push(result);
    const line = summarize(result);
    console.log(`Q${line.q} ${line.ok ? "OK  " : "FAIL"} open ${line.openS}s  cards ${line.cards}  checks v/p/u/m ${line.checks}`);
    for (const failure of line.failures) console.log(`    - ${failure}`);
  }
} finally {
  await browser.close();
}
writeFileSync(join(OUT, "summary.json"), redact(JSON.stringify(results.map(summarize), null, 2)) + "\n");
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} boards rendered cleanly. Output: ${OUT}`);
process.exit(failed.length ? 1 : 0);
