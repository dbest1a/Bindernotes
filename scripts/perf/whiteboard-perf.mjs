#!/usr/bin/env node
// Repeatable whiteboard performance harness (Chrome + Playwright + CDP).
// It runs only against the isolated component fixture: synthetic boards in localStorage and a
// stubbed Supabase client. It never signs in or touches account data.
//
// Usage (fixture server on 127.0.0.1:5196 must be running):
//   node scripts/perf/whiteboard-perf.mjs [--label baseline] [--throttle 1,4]
//        [--scenarios draw,pan,slider,tools,open,memory] [--strokes 200] [--out docs/whiteboard-mission/perf]
// Real Desmos needs the project's client key (see scripts/perf/desmos-key.mjs); it is injected at runtime only.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { resolveDesmosKey } from "./desmos-key.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, list) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), list[index + 1]?.startsWith("--") ? "true" : list[index + 1] ?? "true"]);
  return pairs;
}, []));
const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:5196";
const BOARD_URL = `${BASE}/e2e/fixtures/index.html?board=1`;
const BOARD_KEY = "bindernotes:whiteboards:fixture:browser-binder:browser-lesson";
const THROTTLES = String(args.throttle ?? "1,4").split(",").map(Number);
const SCENARIOS = String(args.scenarios ?? "draw,pan,slider,tools,open,memory").split(",");
const STROKES = Number(args.strokes ?? 200);
const OUT_DIR = String(args.out ?? "docs/whiteboard-mission/perf");
const LABEL = String(args.label ?? "baseline");
const INPUT_INTERVAL_MS = 8; // ~120 Hz pointer, like a pen or high-rate mouse
const DESMOS_KEY = resolveDesmosKey();
const VIEWPORT = { width: 1440, height: 900 };

// ---------- synthetic boards ----------
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const iso = new Date(0).toISOString();
function baseElement(type, x, y, width, height, extra = {}) {
  const id = `${type}-${Math.floor(rand() * 1e12).toString(36)}`;
  return {
    id, type, x, y, width, height, angle: 0, strokeColor: "#e2e8f0", backgroundColor: "transparent", fillStyle: "solid",
    strokeWidth: 2, strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null,
    seed: Math.floor(rand() * 2 ** 31), version: 1, versionNonce: Math.floor(rand() * 2 ** 31), isDeleted: false,
    boundElements: null, updated: 1, link: null, locked: false, ...extra,
  };
}
function makeScene(count) {
  seed = 7;
  const elements = [];
  for (let index = 0; index < count; index += 1) {
    const x = Math.round(rand() * 5200 - 1600), y = Math.round(rand() * 3600 - 1200);
    const kind = index % 8;
    if (kind <= 2) {
      const points = [];
      let px = 0, py = 0;
      for (let step = 0; step < 40; step += 1) { px += 6 + rand() * 4; py += Math.sin(step / 4) * 6 + (rand() - 0.5) * 3; points.push([px, py]); }
      elements.push(baseElement("freedraw", x, y, px, 60, { points: [[0, 0], ...points], pressures: [], simulatePressure: true, lastCommittedPoint: null }));
    } else if (kind === 3) elements.push(baseElement("rectangle", x, y, 120 + rand() * 160, 70 + rand() * 90, { roundness: { type: 3 } }));
    else if (kind === 4) elements.push(baseElement("ellipse", x, y, 90 + rand() * 120, 60 + rand() * 80));
    else if (kind === 5) elements.push(baseElement("text", x, y, 220, 25, { text: `x^2 + ${index}y = ${index % 17}`, originalText: `x^2 + ${index}y = ${index % 17}`, fontSize: 20, fontFamily: 1, textAlign: "left", verticalAlign: "top", containerId: null, lineHeight: 1.25, autoResize: true }));
    else if (kind === 6) elements.push(baseElement("arrow", x, y, 160, 40, { points: [[0, 0], [160, 40]], startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow", lastCommittedPoint: null, elbowed: false }));
    else elements.push(baseElement("diamond", x, y, 110 + rand() * 80, 80 + rand() * 60));
  }
  return elements;
}
function desmosModule(index, x, y, width = 620, height = 460, anchorMode = "board") {
  return { id: `graph-${index}`, type: "bindernotes-module", moduleId: "desmos-graph", graphInstanceId: `perf-graph-${index}`, title: `Desmos graph ${index}`, x, y, width, height, zIndex: index, mode: "live", anchorMode, createdAt: iso, updatedAt: iso };
}
function boardRecord({ elements = [], modules = [], title = "Perf board", id = "perf-board" }) {
  return {
    id, ownerId: "fixture", binderId: "browser-binder", lessonId: "browser-lesson", title, subject: "Math", moduleContext: "lesson",
    scene: { elements, appState: { viewBackgroundColor: "#10131a", scrollX: 0, scrollY: 0, zoom: { value: 1 } }, files: {} },
    modules, objectCount: elements.length + modules.length, sceneSizeBytes: 0, assetSizeBytes: 0, storageMode: "local-draft",
    createdAt: iso, updatedAt: iso, archivedAt: null,
  };
}

// ---------- in-page instrumentation ----------
function instrument() {
  const state = { recording: false, frames: [], loaf: [], events: [], moveLatency: [], pendingMoves: [] };
  const tick = (time) => {
    if (state.recording) {
      state.frames.push(time);
      for (const stamp of state.pendingMoves) state.moveLatency.push(time - stamp);
    }
    state.pendingMoves = [];
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.addEventListener("pointermove", (event) => { if (state.recording) state.pendingMoves.push(event.timeStamp); }, { capture: true, passive: true });
  try {
    new PerformanceObserver((list) => {
      if (!state.recording) return;
      for (const entry of list.getEntries()) {
        const end = entry.startTime + entry.duration;
        state.loaf.push({
          duration: entry.duration, blocking: entry.blockingDuration,
          renderMs: entry.renderStart > 0 ? end - entry.renderStart : 0,
          styleLayoutMs: entry.styleAndLayoutStart > 0 ? end - entry.styleAndLayoutStart : 0,
          scripts: (entry.scripts ?? []).map((script) => ({
            source: `${script.sourceURL?.split("/").pop()?.split("?")[0] ?? ""}:${script.sourceFunctionName || script.invoker || "?"}`,
            invoker: script.invoker, duration: script.duration, forcedLayout: script.forcedStyleAndLayoutDuration,
          })),
        });
      }
    }).observe({ type: "long-animation-frame" });
  } catch { state.loafUnsupported = true; }
  try {
    new PerformanceObserver((list) => {
      if (!state.recording) return;
      for (const entry of list.getEntries()) state.events.push({ name: entry.name, duration: entry.duration, interactionId: entry.interactionId, processing: entry.processingEnd - entry.processingStart, delay: entry.processingStart - entry.startTime });
    }).observe({ type: "event", durationThreshold: 16 });
  } catch { state.eventsUnsupported = true; }
  window.__perf = {
    start() { Object.assign(state, { recording: true, frames: [], loaf: [], events: [], moveLatency: [], pendingMoves: [] }); },
    stop() { state.recording = false; return JSON.parse(JSON.stringify({ frames: state.frames, loaf: state.loaf, events: state.events, moveLatency: state.moveLatency, loafUnsupported: state.loafUnsupported, eventsUnsupported: state.eventsUnsupported })); },
  };
}

// ---------- metrics ----------
const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
};
const round = (value, digits = 1) => (value === null || value === undefined ? null : Number(value.toFixed(digits)));
function summarize(raw) {
  const intervals = raw.frames.slice(1).map((time, index) => time - raw.frames[index]);
  const duration = raw.frames.length > 1 ? raw.frames.at(-1) - raw.frames[0] : 0;
  const interactions = new Map();
  for (const event of raw.events) if (event.interactionId) interactions.set(event.interactionId, Math.max(interactions.get(event.interactionId) ?? 0, event.duration));
  const topScripts = new Map();
  for (const frame of raw.loaf) for (const script of frame.scripts) topScripts.set(script.source, (topScripts.get(script.source) ?? 0) + script.duration);
  return {
    frames: raw.frames.length,
    avgFps: duration ? round((intervals.length / duration) * 1000) : null,
    p50FrameMs: round(quantile(intervals, 0.5)), p95FrameMs: round(quantile(intervals, 0.95)), maxFrameMs: round(Math.max(0, ...intervals)),
    framesOver16ms: intervals.filter((value) => value > 16.7).length,
    pctFramesOver16ms: intervals.length ? round((intervals.filter((value) => value > 16.7).length / intervals.length) * 100, 2) : null,
    framesOver33ms: intervals.filter((value) => value > 33.4).length,
    loafScriptMs: round(raw.loaf.reduce((sum, frame) => sum + frame.scripts.reduce((inner, script) => inner + script.duration, 0), 0)),
    loafRenderMs: round(raw.loaf.reduce((sum, frame) => sum + (frame.renderMs ?? 0), 0)),
    loafStyleLayoutMs: round(raw.loaf.reduce((sum, frame) => sum + (frame.styleLayoutMs ?? 0), 0)),
    longAnimationFrames: raw.loaf.length, maxLoafMs: round(Math.max(0, ...raw.loaf.map((frame) => frame.duration))),
    loafForcedLayoutMs: round(raw.loaf.reduce((sum, frame) => sum + frame.scripts.reduce((inner, script) => inner + (script.forcedLayout ?? 0), 0), 0)),
    topLoafScripts: [...topScripts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([source, ms]) => `${source} ${Math.round(ms)}ms`),
    pointerToFrameP50Ms: round(quantile(raw.moveLatency, 0.5)), pointerToFrameP95Ms: round(quantile(raw.moveLatency, 0.95)), pointerToFrameMaxMs: round(Math.max(0, ...raw.moveLatency)),
    pointerMoves: raw.moveLatency.length,
    worstInteractionMs: interactions.size ? round(Math.max(...interactions.values())) : null,
    interactionsOver100ms: [...interactions.values()].filter((value) => value > 100).length,
    slowEventNames: [...new Set(raw.events.filter((event) => event.duration > 100).map((event) => event.name))],
  };
}

// ---------- helpers ----------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function openBoard(page, boards, { waitForGraphs = 0 } = {}) {
  await page.goto("about:blank");
  await page.addInitScript(({ key, boardKey, boardsJson }) => {
    if (location.protocol === "about:") return;
    if (sessionStorage.getItem("perf-seeded") === boardsJson.length.toString()) return;
    localStorage.clear();
    localStorage.setItem(boardKey, boardsJson);
    sessionStorage.setItem("perf-seeded", boardsJson.length.toString());
    if (key) window.__BINDER_NOTES_DESMOS_API_KEY__ = key;
  }, { key: DESMOS_KEY, boardKey: BOARD_KEY, boardsJson: JSON.stringify(boards) });
  const started = Date.now();
  await page.goto(BOARD_URL);
  await page.locator(".excalidraw__canvas.interactive").waitFor({ timeout: 60_000 });
  const canvasMs = Date.now() - started;
  if (waitForGraphs) {
    await page.waitForFunction((count) => document.querySelectorAll("[data-desmos-canvas] canvas.dcg-graph-inner").length >= count, waitForGraphs, { timeout: 60_000 });
  }
  return { canvasMs, readyMs: Date.now() - started };
}
async function canvasPoint(page, x, y) {
  return page.evaluate(([px, py]) => {
    const element = document.elementFromPoint(px, py);
    return Boolean(element?.closest(".excalidraw") && !element.closest("[data-testid^=whiteboard-module-card-]") && element.tagName === "CANVAS");
  }, [x, y]);
}
async function freePoint(page, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    const x = 160 + rand() * 860, y = 130 + rand() * 640;
    if (await canvasPoint(page, x, y)) return { x, y };
  }
  return { x: 560, y: 760 };
}
// --profile: CPU-profile the measured interaction and attribute time to functions.
const PROFILE = args.profile === "true";
let activeCdp = null;
function summarizeProfile(profile) {
  const parent = new Map();
  for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id);
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const label = (node) => {
    const frame = node.callFrame;
    return `${frame.functionName || "(anonymous)"} ${frame.url.split("/").pop().split("?")[0]}:${frame.lineNumber + 1}`;
  };
  const self = new Map();
  const inclusiveApp = new Map();
  profile.samples.forEach((nodeId, index) => {
    const ms = (profile.timeDeltas[index] ?? 0) / 1000;
    const node = nodes.get(nodeId);
    if (!node) return;
    self.set(label(node), (self.get(label(node)) ?? 0) + ms);
    const seen = new Set();
    for (let current = nodeId; current !== undefined; current = parent.get(current)) {
      const ancestor = nodes.get(current);
      if (!ancestor?.callFrame.url.includes("/src/")) continue;
      const key = label(ancestor);
      if (seen.has(key)) continue;
      seen.add(key);
      inclusiveApp.set(key, (inclusiveApp.get(key) ?? 0) + ms);
    }
  });
  const top = (map, count) => [...map.entries()].filter(([key]) => !key.startsWith("(idle)") && !key.startsWith("(program)")).sort((a, b) => b[1] - a[1]).slice(0, count).map(([key, ms]) => `${Math.round(ms)}ms ${key}`);
  return { topSelf: top(self, 15), topAppInclusive: top(inclusiveApp, 15) };
}
async function measure(page, action) {
  if (PROFILE && activeCdp) {
    await activeCdp.send("Profiler.enable");
    await activeCdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await activeCdp.send("Profiler.start");
  }
  await page.evaluate(() => window.__perf.start());
  const started = Date.now();
  await action();
  await sleep(300);
  const raw = await page.evaluate(() => window.__perf.stop());
  const result = { ...summarize(raw), wallMs: Date.now() - started };
  if (PROFILE && activeCdp) result.cpuProfile = summarizeProfile((await activeCdp.send("Profiler.stop")).profile);
  return result;
}
async function memorySample(cdp) {
  await cdp.send("HeapProfiler.collectGarbage");
  await sleep(200);
  await cdp.send("HeapProfiler.collectGarbage");
  const heap = await cdp.send("Runtime.getHeapUsage");
  const dom = await cdp.send("Memory.getDOMCounters");
  return { heapMB: round(heap.usedSize / 1048576, 2), nodes: dom.nodes, listeners: dom.jsEventListeners, documents: dom.documents };
}

// ---------- scenarios ----------
const scenarios = {
  async draw(page) {
    await openBoard(page, [boardRecord({})]);
    const start = await freePoint(page);
    await page.mouse.click(start.x, start.y);
    await page.keyboard.press("7");
    return measure(page, async () => {
      for (let stroke = 0; stroke < STROKES; stroke += 1) {
        const origin = await freePoint(page, 4);
        await page.mouse.move(origin.x, origin.y);
        await page.mouse.down();
        for (let step = 1; step <= 16; step += 1) {
          await page.mouse.move(origin.x + step * 7, origin.y + Math.sin(step / 2.5) * 18);
          await sleep(INPUT_INTERVAL_MS);
        }
        await page.mouse.up();
      }
    });
  },
  async pan(page) {
    const modules = [desmosModule(1, 80, 140), desmosModule(2, 760, 520), desmosModule(3, -480, 900)];
    await openBoard(page, [boardRecord({ elements: makeScene(320), modules })], { waitForGraphs: DESMOS_KEY ? 2 : 0 });
    const origin = await freePoint(page);
    await page.mouse.click(origin.x, origin.y);
    await page.keyboard.press("h");
    return measure(page, async () => {
      const directions = [[1, 0.3], [-1, 0.5], [0.4, -1], [-0.6, -0.8], [1, 1], [-1, -0.4]];
      for (const [dx, dy] of directions) {
        const point = await freePoint(page);
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        for (let step = 1; step <= 30; step += 1) { await page.mouse.move(point.x + dx * step * 12, point.y + dy * step * 12); await sleep(INPUT_INTERVAL_MS); }
        await page.mouse.up();
      }
      const zoomAt = await freePoint(page);
      await page.mouse.move(zoomAt.x, zoomAt.y);
      await page.keyboard.down("Control");
      for (let step = 0; step < 12; step += 1) { await page.mouse.wheel(0, -60); await sleep(16); }
      for (let step = 0; step < 12; step += 1) { await page.mouse.wheel(0, 60); await sleep(16); }
      await page.keyboard.up("Control");
      for (let step = 0; step < 20; step += 1) { await page.mouse.wheel(0, 80); await sleep(16); }
    });
  },
  async slider(page) {
    if (!DESMOS_KEY) return { skipped: "No Desmos client key available; the real calculator is required." };
    await openBoard(page, [boardRecord({ modules: [desmosModule(1, 120, 160, 760, 560)] })], { waitForGraphs: 1 });
    // The app restores the calculator's saved state just after it appears; let that settle first.
    await sleep(800);
    const setSlider = () => page.evaluate(() => {
      const calculator = window.__desmosChecks.filter((item) => !item.destroyed).at(-1).calculator;
      calculator.setExpression({ id: "a", latex: "a=1", sliderBounds: { min: "-5", max: "5", step: "" } });
      calculator.setExpression({ id: "f", latex: "y=a\\sin(x)\\cos(3x)+\\frac{a}{4}x" });
      calculator.setExpression({ id: "g", latex: "y=\\frac{1}{1+e^{-ax}}" });
    });
    await setSlider();
    const track = page.locator(".dcg-slider-interior").first();
    if (!(await track.waitFor({ state: "attached", timeout: 5_000 }).then(() => true, () => false))) {
      await setSlider();
      await track.waitFor({ state: "attached", timeout: 15_000 });
    }
    const box = await track.boundingBox();
    const before = await page.evaluate(() => window.__desmosChecks.filter((item) => !item.destroyed).at(-1).calculator.getState().expressions.list.find((item) => item.id === "a").latex);
    const result = await measure(page, async () => {
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.6, y);
      await page.mouse.down();
      for (let pass = 0; pass < 3; pass += 1) {
        for (let step = 0; step <= 40; step += 1) { await page.mouse.move(box.x + box.width * (0.6 - 0.5 * (step / 40)), y); await sleep(INPUT_INTERVAL_MS); }
        for (let step = 0; step <= 40; step += 1) { await page.mouse.move(box.x + box.width * (0.1 + 0.8 * (step / 40)), y); await sleep(INPUT_INTERVAL_MS); }
      }
      await page.mouse.up();
    });
    const after = await page.evaluate(() => window.__desmosChecks.filter((item) => !item.destroyed).at(-1).calculator.getState().expressions.list.find((item) => item.id === "a").latex);
    return { ...result, sliderMoved: before !== after, sliderBefore: before, sliderAfter: after };
  },
  async tools(page) {
    await openBoard(page, [boardRecord({ elements: makeScene(320) })]);
    const origin = await freePoint(page);
    await page.mouse.click(origin.x, origin.y);
    return measure(page, async () => {
      for (const key of ["1", "2", "3", "4", "5", "6", "7", "8", "0", "h", "1"]) { await page.keyboard.press(key); await sleep(120); }
      for (const title of ["Rectangle — R or 2", "Ellipse — O or 4", "Draw — P or 7", "Selection — V or 1"]) {
        await page.locator(`.App-toolbar [title="${title}"]`).first().click();
        await sleep(150);
      }
      await page.getByRole("button", { name: "Add module" }).first().click();
      await sleep(300);
      await page.keyboard.press("Escape");
      await sleep(200);
    });
  },
  async open(page) {
    const results = {};
    const cases = {
      emptyBoard: { boards: [boardRecord({})] },
      board320: { boards: [boardRecord({ elements: makeScene(320) })] },
      board3Desmos: { boards: [boardRecord({ modules: [desmosModule(1, 80, 140), desmosModule(2, 760, 140), desmosModule(3, 80, 640)] })], waitForGraphs: DESMOS_KEY ? 3 : 0 },
    };
    for (const [name, spec] of Object.entries(cases)) {
      await openBoard(page, spec.boards, { waitForGraphs: spec.waitForGraphs }); // cold
      const warm = await openBoard(page, spec.boards, { waitForGraphs: spec.waitForGraphs });
      results[name] = { warmCanvasMs: warm.canvasMs, warmReadyMs: warm.readyMs };
    }
    const workspaceStarted = Date.now();
    await page.goto(`${BASE}/e2e/fixtures/index.html?preset=notes-focus`);
    await page.locator(".ProseMirror").first().waitFor({ timeout: 30_000 });
    await page.goto(`${BASE}/e2e/fixtures/index.html?preset=notes-focus`);
    const warmStart = Date.now();
    await page.locator(".ProseMirror").first().waitFor({ timeout: 30_000 });
    results.studyWorkspace = { warmReadyMs: Date.now() - warmStart, coldIncludedMs: warmStart - workspaceStarted };
    return results;
  },
  async labs(page) {
    // Real pages on the isolated lab fixture (synthetic learner, stubbed backend): e2e/fixtures/lab.vite.config.ts.
    const LAB = process.env.PERF_LAB_URL ?? "http://127.0.0.1:5198/e2e/fixtures/lab.html";
    const shots = process.env.PERF_SCREENSHOTS;
    const results = {};
    const timeOpen = async (name, url, ready) => {
      await page.goto(url);
      await ready(); // cold load warms the module graph and caches
      const started = Date.now();
      await page.goto(url);
      await ready();
      results[name] = { warmReadyMs: Date.now() - started };
      if (shots) await page.screenshot({ path: join(shots, `lab-${name}.png`) });
    };
    // The signed-in lab first shows a board picker; a student must choose "New Whiteboard" to draw.
    await timeOpen("mathWhiteboardLab", `${LAB}?page=whiteboard`, async () => {
      await page.getByRole("button", { name: "New Whiteboard" }).first().click({ timeout: 60_000 });
      await page.locator(".excalidraw__canvas.interactive").waitFor({ timeout: 60_000 });
    });
    await timeOpen("mathLab", `${LAB}?page=math-lab`, () => page.locator("main h1, main h2").first().waitFor({ timeout: 60_000 }));
    await page.goto(`${LAB}?page=chemistry`);
    const ids = await page.locator("[data-chem-module]").evaluateAll((sections) => sections.map((section) => section.getAttribute("data-chem-module")));
    for (const id of ids) {
      await timeOpen(id, `${LAB}?page=chemistry&module=${id}`, () => page.waitForFunction((moduleId) => {
        const section = document.querySelector(`[data-chem-module="${moduleId}"]`);
        return Boolean(section) && !/Loading /.test(section.textContent ?? "") && (section.textContent ?? "").trim().length > 40;
      }, id, { timeout: 30_000 }));
    }
    return results;
  },
  async memory(page, cdp) {
    if (!DESMOS_KEY) return { skipped: "No Desmos client key available; the real calculator is required." };
    await openBoard(page, [boardRecord({ modules: [desmosModule(1, 120, 160, 700, 500)] })], { waitForGraphs: 1 });
    const card = page.getByTestId("whiteboard-module-card-graph-1");
    const before = await memorySample(cdp);
    const cycles = [];
    for (let cycle = 0; cycle < 10; cycle += 1) {
      // Collapse unmounts the live graph (destroying its calculator); expand creates a fresh one.
      await card.locator('button[aria-label="Collapse module"]').click({ force: true });
      await page.waitForFunction(() => !document.querySelector("[data-testid=whiteboard-module-card-graph-1] [data-desmos-canvas] canvas.dcg-graph-inner"), null, { timeout: 10_000 });
      await card.locator('button[aria-label*="Expand" i]').first().click({ force: true });
      await page.locator("[data-testid=whiteboard-module-card-graph-1] [data-desmos-canvas] canvas.dcg-graph-inner").waitFor({ timeout: 20_000 });
      cycles.push(await page.evaluate(() => ({ created: window.__desmosChecks.length, destroyed: window.__desmosChecks.filter((item) => item.destroyed).length })));
    }
    const after = await memorySample(cdp);
    return { before, after, heapGrowthMB: round(after.heapMB - before.heapMB, 2), nodeGrowth: after.nodes - before.nodes, listenerGrowth: after.listeners - before.listeners, calculators: cycles.at(-1), liveCalculators: cycles.at(-1).created - cycles.at(-1).destroyed };
  },
};

// ---------- runner ----------
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: process.env.PERF_HEADED ? false : true, args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"] });
const report = { label: LABEL, startedAt: new Date().toISOString(), viewport: VIEWPORT, desmosReal: Boolean(DESMOS_KEY), strokes: STROKES, results: {} };
try {
  for (const throttle of THROTTLES) {
    for (const name of SCENARIOS) {
      const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(instrument);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
      if (!report.environment) {
        await page.goto(`${BASE}/e2e/fixtures/index.html?board=1`);
        report.environment = await page.evaluate(() => {
          const gl = document.createElement("canvas").getContext("webgl");
          const info = gl?.getExtension("WEBGL_debug_renderer_info");
          return { userAgent: navigator.userAgent, gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown", cores: navigator.hardwareConcurrency };
        });
      }
      process.stdout.write(`[${LABEL}] ${name} @${throttle}x CPU ... `);
      let result;
      activeCdp = cdp;
      try { result = await scenarios[name](page, cdp); }
      catch (error) { result = { error: error.message.split("\n")[0] }; }
      result.pageErrors = errors.slice(0, 5);
      report.results[`${name}@${throttle}x`] = result;
      console.log(result.error ? `ERROR ${result.error}` : "done");
      await context.close();
    }
  }
} finally {
  await browser.close();
}

// ---------- budgets ----------
const budgets = [];
for (const [key, result] of Object.entries(report.results)) {
  const [name] = key.split("@");
  if (["draw", "pan", "slider"].includes(name) && result.frames) {
    budgets.push({ key, check: "60 fps: ≤1% frames over 16.7 ms", value: `${result.pctFramesOver16ms}% (${result.framesOver16ms})`, pass: result.pctFramesOver16ms <= 1 });
    budgets.push({ key, check: "no frame > 33 ms", value: result.framesOver33ms, pass: result.framesOver33ms === 0 });
    budgets.push({ key, check: "no LoAF > 50 ms", value: result.longAnimationFrames, pass: result.longAnimationFrames === 0 });
    budgets.push({ key, check: "ink/pointer → frame p95 ≤ 20 ms", value: result.pointerToFrameP95Ms, pass: result.pointerToFrameP95Ms !== null && result.pointerToFrameP95Ms <= 20 });
  }
  if (name === "tools" && result.frames) budgets.push({ key, check: "every interaction ≤ 100 ms (INP)", value: result.worstInteractionMs, pass: (result.worstInteractionMs ?? 0) <= 100 });
  if ((name === "open" || name === "labs") && !result.error) for (const [demo, timing] of Object.entries(result)) if (timing?.warmReadyMs !== undefined) budgets.push({ key: `${key}:${demo}`, check: "warm interactive ≤ 1000 ms", value: timing.warmReadyMs, pass: timing.warmReadyMs <= 1000 });
  if (name === "memory" && result.after) budgets.push({ key, check: "no growth after 10 open/close (heap ≤ +1 MB, 0 live extra calculators)", value: `${result.heapGrowthMB} MB, ${result.liveCalculators} live`, pass: result.heapGrowthMB <= 1 && result.liveCalculators <= 1 });
}
report.budgets = budgets;
mkdirSync(OUT_DIR, { recursive: true });
const stamp = report.startedAt.replace(/[:.]/g, "-");
const jsonPath = join(OUT_DIR, `${LABEL}-${stamp}.json`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2));
const lines = [`# Whiteboard perf: ${LABEL} (${report.startedAt})`, "", `GPU: ${report.environment?.gpu}; cores: ${report.environment?.cores}; real Desmos: ${report.desmosReal}; viewport ${VIEWPORT.width}×${VIEWPORT.height}; pointer interval ${INPUT_INTERVAL_MS} ms`, "", "| Scenario | frames | >16.7ms | >33ms | p95 frame | max frame | LoAF >50ms (max) | LoAF script / render ms | ptr→frame p95 | worst interaction | notes |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
for (const [key, result] of Object.entries(report.results)) {
  if (result.frames) lines.push(`| ${key} | ${result.frames} | ${result.framesOver16ms} (${result.pctFramesOver16ms}%) | ${result.framesOver33ms} | ${result.p95FrameMs} | ${result.maxFrameMs} | ${result.longAnimationFrames} (${result.maxLoafMs}) | ${result.loafScriptMs} / ${result.loafRenderMs} | ${result.pointerToFrameP95Ms} | ${result.worstInteractionMs ?? "–"} | ${[result.sliderMoved === false ? "slider DID NOT MOVE" : "", result.topLoafScripts?.slice(0, 2).join("; ")].filter(Boolean).join(" ")} |`);
  else lines.push(`| ${key} | ${result.error ? `ERROR: ${result.error}` : result.skipped ?? JSON.stringify(result).slice(0, 300)} ||||||||||`);
}
lines.push("", "## Budgets", "", "| Check | Scenario | Value | Pass |", "| --- | --- | --- | --- |", ...budgets.map((budget) => `| ${budget.check} | ${budget.key} | ${budget.value} | ${budget.pass ? "✅" : "❌"} |`));
writeFileSync(join(OUT_DIR, `${LABEL}-${stamp}.md`), lines.join("\n") + "\n");
console.log(lines.join("\n"));
console.log(`\nSaved ${jsonPath}`);
