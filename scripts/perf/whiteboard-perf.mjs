#!/usr/bin/env node
// Repeatable whiteboard performance harness (Chrome + Playwright + CDP).
// It runs only against isolated component fixtures: synthetic boards in localStorage and a stubbed
// Supabase client. It never signs in or touches account data.
//
// Usage (fixture servers must be running; production builds are the budget reference):
//   node scripts/perf/whiteboard-perf.mjs [--label baseline] [--throttle 1,4]
//        [--scenarios draw,pan,slider,tools,open,labs,memory] [--strokes 200] [--profile]
//        [--out docs/whiteboard-mission/perf]
//   PERF_BASE_URL (board fixture origin, default http://127.0.0.1:5196)
//   PERF_LAB_URL  (lab fixture page, default http://127.0.0.1:5198/e2e/fixtures/lab.html)
// Real Desmos needs the project's client key (scripts/perf/desmos-key.mjs). It is injected only into
// the fixture's own HTML response, never logged, and redacted from every report.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { resolveDesmosKey } from "./desmos-key.mjs";

// ---------- arguments ----------
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, list) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), list[index + 1]?.startsWith("--") ? "true" : list[index + 1] ?? "true"]);
  return pairs;
}, []));
const ALL_SCENARIOS = ["draw", "pan", "slider", "tools", "open", "labs", "memory"];
const BASE = (process.env.PERF_BASE_URL ?? "http://127.0.0.1:5196").replace(/\/$/, "");
const LAB_PAGE = process.env.PERF_LAB_URL ?? "http://127.0.0.1:5198/e2e/fixtures/lab.html";
const BOARD_URL = `${BASE}/e2e/fixtures/index.html?board=1`;
const BOARD_KEY = "bindernotes:whiteboards:fixture:browser-binder:browser-lesson";
const THROTTLES = String(args.throttle ?? "1,4").split(",").map(Number);
const SCENARIOS = String(args.scenarios ?? "draw,pan,slider,tools,open,memory").split(",");
const STROKES = Number(args.strokes ?? 200);
const OUT_DIR = String(args.out ?? "docs/whiteboard-mission/perf");
const LABEL = String(args.label ?? "baseline");
const PROFILE = args.profile === "true";
const INPUT_INTERVAL_MS = 8; // requested pause between moves; the delivered rate is reported
const SETTLE_MS = 1800; // longer than the 1500 ms whiteboard autosave debounce
const DESMOS_KEY = resolveDesmosKey();
const VIEWPORT = { width: 1440, height: 900 };
for (const origin of [BASE, new URL(LAB_PAGE).origin]) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error(`Refusing non-loopback fixture origin: ${origin}`);
}
if (THROTTLES.some((rate) => !Number.isFinite(rate) || rate < 1)) throw new Error("--throttle must be positive numbers ≥ 1");
if (SCENARIOS.some((name) => !ALL_SCENARIOS.includes(name))) throw new Error(`--scenarios must be from ${ALL_SCENARIOS.join(",")}`);
if (!Number.isInteger(STROKES) || STROKES < 1) throw new Error("--strokes must be a positive integer");
const redact = (text) => String(text ?? "").replaceAll(DESMOS_KEY || "\u0000", "[redacted]").replace(/apiKey=[^&\s"']+/g, "apiKey=[redacted]");

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
function makeScene(count, { spread = [5200, 3600], origin = [-1600, -1200] } = {}) {
  seed = 7;
  const elements = [];
  for (let index = 0; index < count; index += 1) {
    const x = Math.round(rand() * spread[0] + origin[0]), y = Math.round(rand() * spread[1] + origin[1]);
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

// ---------- in-page instrumentation (installed once per context) ----------
function instrument() {
  if (window.__perf) return;
  const state = { recording: false, startedAt: 0, frames: [], loaf: [], events: [], moveLatency: [], pendingMoves: [], moves: 0, coalesced: 0 };
  const supported = PerformanceObserver.supportedEntryTypes ?? [];
  const tick = (time) => {
    if (state.recording) {
      state.frames.push(time);
      const now = performance.now();
      for (const stamp of state.pendingMoves) state.moveLatency.push(now - stamp);
    }
    state.pendingMoves = [];
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // Only pressed-pointer moves (active strokes, drags, slider sweeps) count toward the pointer proxy.
  window.addEventListener("pointermove", (event) => {
    if (!state.recording || event.buttons === 0) return;
    state.pendingMoves.push(event.timeStamp);
    state.moves += 1;
    state.coalesced += event.getCoalescedEvents?.().length ?? 1;
  }, { capture: true, passive: true });
  const toLoaf = (entry) => {
    const end = entry.startTime + entry.duration;
    return {
      start: entry.startTime, duration: entry.duration, blocking: entry.blockingDuration,
      renderMs: entry.renderStart > 0 ? end - entry.renderStart : 0,
      styleLayoutMs: entry.styleAndLayoutStart > 0 ? end - entry.styleAndLayoutStart : 0,
      scripts: (entry.scripts ?? []).map((script) => ({
        source: `${(script.sourceURL ?? "").replace(/^https?:\/\/[^/]+/, "").split("?")[0]}:${script.sourceFunctionName || String(script.invoker ?? "?").split("?")[0]}`,
        duration: script.duration, forcedLayout: script.forcedStyleAndLayoutDuration,
      })),
    };
  };
  const toEvent = (entry) => ({ start: entry.startTime, name: entry.name, duration: entry.duration, interactionId: entry.interactionId });
  let loafObserver = null, eventObserver = null;
  if (supported.includes("long-animation-frame")) {
    loafObserver = new PerformanceObserver((list) => { for (const entry of list.getEntries()) state.loaf.push(toLoaf(entry)); });
    loafObserver.observe({ type: "long-animation-frame" });
  }
  if (supported.includes("event")) {
    eventObserver = new PerformanceObserver((list) => { for (const entry of list.getEntries()) state.events.push(toEvent(entry)); });
    eventObserver.observe({ type: "event", durationThreshold: 16 });
  }
  window.__perf = {
    support: { loaf: Boolean(loafObserver), events: Boolean(eventObserver) },
    start() { Object.assign(state, { recording: true, startedAt: performance.now(), frames: [], loaf: [], events: [], moveLatency: [], pendingMoves: [], moves: 0, coalesced: 0 }); },
    stop() {
      for (const entry of loafObserver?.takeRecords() ?? []) state.loaf.push(toLoaf(entry));
      for (const entry of eventObserver?.takeRecords() ?? []) state.events.push(toEvent(entry));
      state.recording = false;
      const since = state.startedAt;
      return JSON.parse(JSON.stringify({
        durationMs: performance.now() - since,
        frames: state.frames,
        loaf: state.loaf.filter((entry) => entry.start >= since),
        events: state.events.filter((entry) => entry.start >= since),
        moveLatency: state.moveLatency, moves: state.moves, coalesced: state.coalesced,
        support: window.__perf.support,
      }));
    },
  };
}

// ---------- metrics ----------
const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
};
const round = (value, digits = 1) => (value === null || value === undefined || !Number.isFinite(value) ? null : Number(value.toFixed(digits)));
function summarize(raw) {
  const intervals = raw.frames.slice(1).map((time, index) => time - raw.frames[index]);
  const seconds = Math.max(raw.durationMs, 1) / 1000;
  const stallMs = intervals.reduce((sum, value) => sum + Math.max(0, value - 16.7), 0);
  const interactions = new Map();
  for (const event of raw.events) if (event.interactionId) interactions.set(event.interactionId, Math.max(interactions.get(event.interactionId) ?? 0, event.duration));
  const topScripts = new Map();
  for (const frame of raw.loaf) for (const script of frame.scripts) topScripts.set(script.source, (topScripts.get(script.source) ?? 0) + script.duration);
  return {
    support: raw.support,
    callbacks: raw.frames.length,
    callbackRateHz: round(intervals.length / seconds),
    framesOver16ms: intervals.filter((value) => value > 16.7).length,
    framesOver33ms: intervals.filter((value) => value > 33.4).length,
    longestFrameMs: round(Math.max(0, ...intervals)),
    stallMsPerSecond: round(stallMs / seconds),
    longAnimationFrames: raw.support.loaf ? raw.loaf.filter((frame) => frame.duration > 50).length : null,
    maxLoafMs: raw.support.loaf ? round(Math.max(0, ...raw.loaf.map((frame) => frame.duration))) : null,
    topLoafScripts: [...topScripts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([source, ms]) => `${source} ${Math.round(ms)}ms`),
    pointerToRafP95Ms: round(quantile(raw.moveLatency, 0.95)),
    pointerToRafMaxMs: raw.moveLatency.length ? round(Math.max(...raw.moveLatency)) : null,
    pressedMoves: raw.moves,
    deliveredMovesPerSecond: round(raw.moves / seconds),
    coalescedPerMove: raw.moves ? round(raw.coalesced / raw.moves, 2) : null,
    worstInteractionMs: raw.support.events ? (interactions.size ? round(Math.max(...interactions.values())) : 0) : null,
    interactionsOver100ms: [...interactions.values()].filter((value) => value > 100).length,
  };
}

// --profile: CPU-profile the measured interaction (diagnostic runs only; never budget runs).
let activeCdp = null;
function summarizeProfile(profile) {
  const parent = new Map();
  for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id);
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const label = (node) => {
    const frame = node.callFrame;
    return `${frame.functionName || "(anonymous)"} ${frame.url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
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
  return { samplingIntervalUs: 200, durationMs: Math.round((profile.endTime - profile.startTime) / 1000), topSelf: top(self, 15), topAppInclusive: top(inclusiveApp, 15) };
}

// ---------- helpers ----------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class InvalidRun extends Error {}
const expectThat = (condition, message) => { if (!condition) throw new InvalidRun(message); };

// Seeds exactly one board payload per navigation by rewriting the fixture's own HTML response.
// No init scripts accumulate; the key reaches only fixture documents.
function installFixtureRoutes(page) {
  const seedState = { current: null };
  page.route(/\/e2e\/fixtures\/(index|lab)\.html(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const parts = [];
    if (DESMOS_KEY) parts.push(`window.__BINDER_NOTES_DESMOS_API_KEY__=${JSON.stringify(DESMOS_KEY)};`);
    const seedNow = seedState.current;
    if (seedNow) {
      parts.push(`if(localStorage.getItem("perf-seed-version")!==${JSON.stringify(seedNow.version)}){localStorage.clear();localStorage.setItem(${JSON.stringify(BOARD_KEY)},${JSON.stringify(seedNow.payload)});localStorage.setItem("perf-seed-version",${JSON.stringify(seedNow.version)});}`);
    }
    const script = `<script>${parts.join("").replace(/</g, "\\u003c")}</script>`;
    const body = (await response.text()).replace("<head>", `<head>${script}`);
    await route.fulfill({ response, body });
  });
  return seedState;
}
let seedCounter = 0;
async function openBoard(page, seedState, boards, { waitForGraphs = 0 } = {}) {
  seedState.current = { payload: JSON.stringify(boards), version: `perf-${Date.now()}-${seedCounter += 1}` };
  const started = Date.now();
  await page.goto(BOARD_URL);
  await page.locator(".excalidraw__canvas.interactive").waitFor({ timeout: 60_000 });
  const canvasMs = Date.now() - started;
  if (waitForGraphs) await page.waitForFunction((count) => document.querySelectorAll("[data-desmos-canvas] canvas.dcg-graph-inner").length >= count, waitForGraphs, { timeout: 60_000 });
  const readyMs = Date.now() - started;
  const expectedObjects = boards[0].objectCount;
  const loaded = await page.waitForFunction((count) => new RegExp(`\\b${count} objects?\\b`).test(document.body.innerText), expectedObjects, { timeout: 10_000 }).then(() => true, () => false);
  expectThat(loaded, `loaded board does not show ${expectedObjects} objects`);
  return { canvasMs, readyMs };
}
async function reopen(page, { waitForGraphs = 0 } = {}) {
  const started = Date.now();
  await page.goto(BOARD_URL);
  await page.locator(".excalidraw__canvas.interactive").waitFor({ timeout: 60_000 });
  const canvasMs = Date.now() - started;
  if (waitForGraphs) await page.waitForFunction((count) => document.querySelectorAll("[data-desmos-canvas] canvas.dcg-graph-inner").length >= count, waitForGraphs, { timeout: 60_000 });
  return { canvasMs, readyMs: Date.now() - started };
}
async function isCanvasPoint(page, x, y) {
  return page.evaluate(([px, py]) => {
    const element = document.elementFromPoint(px, py);
    return Boolean(element?.closest(".excalidraw") && !element.closest("[data-testid^=whiteboard-module-card-]") && element.tagName === "CANVAS");
  }, [x, y]);
}
async function freePoint(page, { attempts = 60, path = null } = {}) {
  for (let index = 0; index < attempts; index += 1) {
    const x = 160 + rand() * 860, y = 130 + rand() * 640;
    if (!(await isCanvasPoint(page, x, y))) continue;
    if (path) {
      const end = path(x, y);
      if (end.x < 20 || end.x > 1100 || end.y < 110 || end.y > 820) continue;
    }
    return { x, y };
  }
  throw new InvalidRun("no free canvas point found");
}
async function measure(page, action) {
  if (PROFILE && activeCdp) {
    await activeCdp.send("Profiler.enable");
    await activeCdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await activeCdp.send("Profiler.start");
  }
  await page.evaluate(() => window.__perf.start());
  await action();
  const active = summarize(await page.evaluate(() => window.__perf.stop()));
  // Settling work (autosave debounce, deferred refresh) is reported separately.
  await page.evaluate(() => window.__perf.start());
  await sleep(SETTLE_MS);
  const settle = summarize(await page.evaluate(() => window.__perf.stop()));
  const result = { active, settle: { longAnimationFrames: settle.longAnimationFrames, maxLoafMs: settle.maxLoafMs, framesOver33ms: settle.framesOver33ms, longestFrameMs: settle.longestFrameMs } };
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
  async draw({ page, seedState }) {
    await openBoard(page, seedState, [boardRecord({})]);
    const start = await freePoint(page);
    await page.mouse.click(start.x, start.y);
    await page.keyboard.press("7");
    const result = await measure(page, async () => {
      for (let stroke = 0; stroke < STROKES; stroke += 1) {
        const origin = await freePoint(page, { path: (x, y) => ({ x: x + 16 * 7, y: y + 18 }) });
        await page.mouse.move(origin.x, origin.y);
        await page.mouse.down();
        for (let step = 1; step <= 16; step += 1) {
          await page.mouse.move(origin.x + step * 7, origin.y + Math.sin(step / 2.5) * 18);
          await sleep(INPUT_INTERVAL_MS);
        }
        await page.mouse.up();
      }
    });
    const drawn = await page.evaluate(() => document.body.innerText.match(/\b(\d+) objects?\b/)?.[1]);
    expectThat(Number(drawn) >= STROKES, `expected ≥${STROKES} drawn objects, board shows ${drawn}`);
    return { ...result, strokesDrawn: Number(drawn) };
  },
  async pan({ page, seedState }) {
    const modules = [desmosModule(1, 80, 140), desmosModule(2, 760, 520), desmosModule(3, -480, 900)];
    await openBoard(page, seedState, [boardRecord({ elements: makeScene(320), modules })], { waitForGraphs: DESMOS_KEY ? 2 : 0 });
    const origin = await freePoint(page);
    await page.mouse.click(origin.x, origin.y);
    await page.keyboard.press("h");
    const cameraBefore = await page.evaluate(() => window.__BINDERNOTES_WHITEBOARD_CAMERA__?.() ?? null);
    const result = {};
    const directions = [[1, 0.3], [-1, 0.5], [0.4, -1], [-0.6, -0.8], [1, 1], [-1, -0.4]];
    result.handPan = await measure(page, async () => {
      for (const [dx, dy] of directions) {
        const point = await freePoint(page, { path: (x, y) => ({ x: x + dx * 30 * 12, y: y + dy * 30 * 12 }) });
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        for (let step = 1; step <= 30; step += 1) { await page.mouse.move(point.x + dx * step * 12, point.y + dy * step * 12); await sleep(INPUT_INTERVAL_MS); }
        await page.mouse.up();
      }
    });
    const zoomAt = await freePoint(page);
    await page.mouse.move(zoomAt.x, zoomAt.y);
    result.ctrlWheelZoom = await measure(page, async () => {
      await page.keyboard.down("Control");
      for (let step = 0; step < 12; step += 1) { await page.mouse.wheel(0, -60); await sleep(16); }
      for (let step = 0; step < 12; step += 1) { await page.mouse.wheel(0, 60); await sleep(16); }
      await page.keyboard.up("Control");
    });
    result.wheelScroll = await measure(page, async () => { for (let step = 0; step < 20; step += 1) { await page.mouse.wheel(0, 80); await sleep(16); } });
    const cameraAfter = await page.evaluate(() => window.__BINDERNOTES_WHITEBOARD_CAMERA__?.() ?? null);
    if (cameraBefore && cameraAfter) expectThat(cameraBefore.scrollX !== cameraAfter.scrollX || cameraBefore.scrollY !== cameraAfter.scrollY, "camera did not move");
    return result;
  },
  async slider({ page, seedState }) {
    if (!DESMOS_KEY) return { status: "skipped", reason: "No Desmos client key available; the real calculator is required." };
    await openBoard(page, seedState, [boardRecord({ modules: [desmosModule(1, 120, 160, 760, 560)] })], { waitForGraphs: 1 });
    await sleep(800); // the app restores saved calculator state just after it appears
    const setSlider = () => page.evaluate(() => {
      const calculator = window.__desmosChecks.filter((item) => !item.destroyed).at(-1).calculator;
      calculator.setExpression({ id: "a", latex: "a=1", sliderBounds: { min: "-5", max: "5", step: "" } });
      calculator.setExpression({ id: "f", latex: "y=a\\sin(x)\\cos(3x)+\\frac{a}{4}x" });
      calculator.setExpression({ id: "g", latex: "y=\\frac{1}{1+e^{-ax}}" });
    });
    await setSlider();
    const track = page.locator(".dcg-slider-interior").first(); // zero-height track: wait for attachment
    if (!(await track.waitFor({ state: "attached", timeout: 5_000 }).then(() => true, () => false))) { await setSlider(); await track.waitFor({ state: "attached", timeout: 15_000 }); }
    const box = await track.boundingBox();
    const value = () => page.evaluate(() => window.__desmosChecks.filter((item) => !item.destroyed).at(-1).calculator.getState().expressions.list.find((item) => item.id === "a").latex);
    const before = await value();
    const result = await measure(page, async () => {
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.1, y);
      await page.mouse.down();
      for (let pass = 0; pass < 3; pass += 1) { // continuous sweeps, no jumps along the track
        for (let step = 0; step <= 40; step += 1) { await page.mouse.move(box.x + box.width * (0.1 + 0.8 * (step / 40)), y); await sleep(INPUT_INTERVAL_MS); }
        for (let step = 0; step <= 40; step += 1) { await page.mouse.move(box.x + box.width * (0.9 - 0.8 * (step / 40)), y); await sleep(INPUT_INTERVAL_MS); }
      }
      await page.mouse.up();
    });
    const after = await value();
    expectThat(before !== after, "slider value did not change");
    return { ...result, sliderBefore: before, sliderAfter: after };
  },
  async tools({ page, seedState }) {
    await openBoard(page, seedState, [boardRecord({ elements: makeScene(320) })]);
    const origin = await freePoint(page);
    await page.mouse.click(origin.x, origin.y);
    const result = await measure(page, async () => {
      for (const key of ["1", "2", "3", "4", "5", "6", "7", "8", "0", "h", "1"]) { await page.keyboard.press(key); await sleep(120); }
      for (const tool of ["rectangle", "ellipse", "freedraw", "selection"]) {
        await page.locator(`.App-toolbar [data-testid="toolbar-${tool}"], .App-toolbar input[value="${tool}"]`).first().click({ force: true });
        await sleep(150);
      }
      await page.getByRole("button", { name: /^Add module/ }).first().click();
      await sleep(300);
      await page.keyboard.press("Escape");
      await sleep(200);
    });
    const selected = await page.locator('.App-toolbar input[value="selection"]').first().isChecked().catch(() => null);
    expectThat(selected !== false, "selection tool not active after the tool sequence");
    return result;
  },
  async open({ browser, throttle }) {
    // Each case gets a fresh context: cold load, then a warm reload; timers start before navigation.
    const cases = {
      emptyBoard: { boards: [boardRecord({})] },
      board320: { boards: [boardRecord({ elements: makeScene(320) })] },
      board3Desmos: { boards: [boardRecord({ modules: [desmosModule(1, 80, 140), desmosModule(2, 760, 140), desmosModule(3, 80, 640)] })], waitForGraphs: DESMOS_KEY ? 3 : 0 },
    };
    const results = {};
    for (const [name, spec] of Object.entries(cases)) {
      const { context, page, seedState } = await newScenarioPage(browser, throttle);
      try {
        const cold = await openBoard(page, seedState, spec.boards, { waitForGraphs: spec.waitForGraphs });
        const warm = [];
        for (let repeat = 0; repeat < 3; repeat += 1) warm.push((await reopen(page, { waitForGraphs: spec.waitForGraphs })).readyMs);
        results[name] = { coldReadyMs: cold.readyMs, warmReadyMs: quantile(warm, 0.5), warmRuns: warm };
      } finally { await context.close(); }
    }
    const { context, page } = await newScenarioPage(browser, throttle);
    try {
      const url = `${BASE}/e2e/fixtures/index.html?preset=notes-focus`;
      const coldStart = Date.now();
      await page.goto(url);
      await page.locator(".ProseMirror").first().waitFor({ timeout: 30_000 });
      const coldMs = Date.now() - coldStart;
      const warm = [];
      for (let repeat = 0; repeat < 3; repeat += 1) {
        const started = Date.now();
        await page.goto(url);
        await page.locator(".ProseMirror").first().waitFor({ timeout: 30_000 });
        warm.push(Date.now() - started);
      }
      results.studyWorkspace = { coldReadyMs: coldMs, warmReadyMs: quantile(warm, 0.5), warmRuns: warm };
    } finally { await context.close(); }
    return { cases: results };
  },
  async labs({ page }) {
    // Real pages on the isolated lab fixture (synthetic learner, stubbed backend).
    const results = {};
    const timeOpen = async (name, url, ready) => {
      await page.goto(url);
      await ready();
      const warm = [];
      for (let repeat = 0; repeat < 3; repeat += 1) {
        const started = Date.now();
        await page.goto(url);
        await ready();
        warm.push(Date.now() - started);
      }
      results[name] = { warmReadyMs: quantile(warm, 0.5), warmRuns: warm };
    };
    // The signed-in lab first shows a board picker; a student must choose "New Whiteboard" to draw.
    await timeOpen("mathWhiteboardLab", `${LAB_PAGE}?page=whiteboard`, async () => {
      await page.getByRole("button", { name: "New Whiteboard" }).first().click({ timeout: 60_000 });
      await page.locator(".excalidraw__canvas.interactive").waitFor({ timeout: 60_000 });
    });
    await timeOpen("mathLab", `${LAB_PAGE}?page=math-lab`, async () => {
      await page.getByRole("button", { name: "Math tools" }).first().waitFor({ timeout: 60_000 }); // shell ready
      if (DESMOS_KEY) await page.locator("[data-desmos-canvas] canvas.dcg-graph-inner").first().waitFor({ timeout: 60_000 }); // graph ready
    });
    await page.goto(`${LAB_PAGE}?page=chemistry`);
    await page.locator("[data-chem-module]").first().waitFor({ timeout: 30_000 });
    const ids = await page.locator("[data-chem-module]").evaluateAll((sections) => sections.map((section) => section.getAttribute("data-chem-module")));
    expectThat(ids.length >= 20, `expected the chemistry module list, found ${ids.length}`);
    for (const id of ids) {
      // Ready = the lazy module rendered (no loading fallback) with controls, graphics, or substantial content.
      await timeOpen(id, `${LAB_PAGE}?page=chemistry&module=${id}`, () => page.waitForFunction((moduleId) => {
        const section = document.querySelector(`[data-chem-module="${moduleId}"]`);
        if (!section || /Loading /.test(section.textContent ?? "")) return false;
        return Boolean(section.querySelector("button, input, select, svg, canvas, table")) || (section.textContent ?? "").trim().length > 120;
      }, id, { timeout: 30_000 }).catch((error) => { throw new InvalidRun(`chemistry module ${id} never became ready: ${error.message.split("\n")[0]}`); }));
    }
    return { cases: results };
  },
  async memory({ page, seedState, cdp }) {
    if (!DESMOS_KEY) return { status: "skipped", reason: "No Desmos client key available; the real calculator is required." };
    await openBoard(page, seedState, [boardRecord({ modules: [desmosModule(1, 120, 160, 700, 500)] })], { waitForGraphs: 1 });
    const card = page.getByTestId("whiteboard-module-card-graph-1");
    const graph = "[data-testid=whiteboard-module-card-graph-1] [data-desmos-canvas] canvas.dcg-graph-inner";
    const cycle = async () => {
      // Collapse unmounts the live graph (destroying its calculator); expand creates a fresh one.
      await card.locator('button[aria-label="Collapse module"]').click({ force: true });
      await page.waitForFunction((selector) => !document.querySelector(selector), graph, { timeout: 10_000 });
      await card.locator('button[aria-label*="Expand" i]').first().click({ force: true });
      await page.locator(graph).waitFor({ timeout: 20_000 });
      await sleep(400);
    };
    for (let warmup = 0; warmup < 2; warmup += 1) await cycle(); // warm caches before the first sample
    const samples = [await memorySample(cdp)];
    for (let batch = 0; batch < 3; batch += 1) {
      for (let index = 0; index < 10; index += 1) await cycle();
      samples.push(await memorySample(cdp));
    }
    const calculators = await page.evaluate(() => ({ created: window.__desmosChecks.length, destroyed: window.__desmosChecks.filter((item) => item.destroyed).length, retained: window.__desmosChecks.filter((item) => item.calculator).length }));
    const growth = samples.slice(1).map((sample, index) => round(sample.heapMB - samples[index].heapMB, 2));
    return { samples, heapGrowthPer10CyclesMB: growth, nodeGrowthTotal: samples.at(-1).nodes - samples[0].nodes, listenerGrowthTotal: samples.at(-1).listeners - samples[0].listeners, calculators, liveCalculators: calculators.created - calculators.destroyed };
  },
};

// ---------- runner ----------
async function newScenarioPage(browser, throttle) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await context.addInitScript(instrument);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(redact(error.message)));
  const seedState = installFixtureRoutes(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  return { context, page, cdp, errors, seedState };
}
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: process.env.PERF_HEADED ? false : true, args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"] });
const report = { label: LABEL, startedAt: new Date().toISOString(), viewport: VIEWPORT, desmosReal: Boolean(DESMOS_KEY), strokes: STROKES, base: BASE, settleMs: SETTLE_MS, profiled: PROFILE, results: {} };
try {
  for (const throttle of THROTTLES) {
    for (const name of SCENARIOS) {
      const session = await newScenarioPage(browser, throttle);
      if (!report.environment) {
        await session.page.goto(`${BASE}/e2e/fixtures/index.html?board=1`);
        report.environment = await session.page.evaluate(() => {
          const gl = document.createElement("canvas").getContext("webgl");
          const info = gl?.getExtension("WEBGL_debug_renderer_info");
          return { userAgent: navigator.userAgent, gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown", cores: navigator.hardwareConcurrency, supportedEntryTypes: PerformanceObserver.supportedEntryTypes };
        });
      }
      process.stdout.write(`[${LABEL}] ${name} @${throttle}x CPU ... `);
      activeCdp = session.cdp;
      let result;
      try {
        result = await scenarios[name]({ ...session, browser, throttle });
        result.status ??= "valid";
      } catch (error) {
        result = { status: error instanceof InvalidRun ? "invalid" : "failed", error: redact(error.message.split("\n")[0]) };
      }
      result.pageErrors = session.errors.slice(0, 5);
      report.results[`${name}@${throttle}x`] = result;
      console.log(result.status === "valid" ? "valid" : `${result.status.toUpperCase()} ${result.error ?? result.reason ?? ""}`);
      await session.context.close();
    }
  }
} finally {
  await browser.close();
}

// ---------- budgets ----------
const budgets = [];
const add = (key, check, value, pass) => budgets.push({ key, check, value, pass });
for (const [key, result] of Object.entries(report.results)) {
  const [name] = key.split("@");
  if (result.status !== "valid") { add(key, "scenario produced a valid measurement", `${result.status}: ${result.error ?? result.reason ?? ""}`, false); continue; }
  const motion = name === "pan" ? Object.entries(result).filter(([, value]) => value?.active).map(([part, value]) => [`${key}:${part}`, value]) : ["draw", "slider"].includes(name) ? [[key, result]] : [];
  for (const [label, value] of motion) {
    const a = value.active;
    if (a.support?.loaf === false) add(label, "Long Animation Frames supported", "unsupported", false);
    add(label, "60 fps: no frame over 16.7 ms", `${a.framesOver16ms} (stall ${a.stallMsPerSecond} ms/s)`, a.framesOver16ms === 0);
    add(label, "no frame over 33 ms", a.framesOver33ms, a.framesOver33ms === 0);
    add(label, "no long animation frame over 50 ms (interaction)", a.longAnimationFrames, a.longAnimationFrames === 0);
    add(label, "no long animation frame over 50 ms (settle, incl. autosave)", value.settle.longAnimationFrames, value.settle.longAnimationFrames === 0);
    add(label, "pointer→rAF proxy p95 ≤ 16.7 ms (not visible-ink latency)", a.pointerToRafP95Ms, a.pointerToRafP95Ms !== null && a.pointerToRafP95Ms <= 16.7);
  }
  if (name === "tools") {
    if (result.active.support?.events === false) add(key, "Event Timing supported", "unsupported", false);
    else add(key, "every interaction ≤ 100 ms (INP proxy)", result.active.worstInteractionMs, result.active.worstInteractionMs <= 100);
  }
  if (["open", "labs"].includes(name)) for (const [demo, timing] of Object.entries(result.cases)) add(`${key}:${demo}`, "warm reopen interactive ≤ 1000 ms (median of 3)", timing.warmReadyMs, timing.warmReadyMs <= 1000);
  if (name === "memory") {
    const worst = Math.max(...result.heapGrowthPer10CyclesMB);
    add(key, "no growth across 3×10 open/close (heap ≤ +0.5 MB per batch, 1 live calculator)", `${result.heapGrowthPer10CyclesMB.join(" / ")} MB; ${result.liveCalculators} live; ${result.calculators.retained} retained`, worst <= 0.5 && result.liveCalculators === 1 && result.calculators.retained === 1);
  }
}
report.budgets = budgets;
mkdirSync(OUT_DIR, { recursive: true });
const stamp = report.startedAt.replace(/[:.]/g, "-");
const jsonPath = join(OUT_DIR, `${LABEL}-${stamp}.json`);
writeFileSync(jsonPath, redact(JSON.stringify(report, null, 2)));
const row = (label, a, settle) => `| ${label} | ${a.callbacks} @ ${a.callbackRateHz} Hz | ${a.framesOver16ms} | ${a.framesOver33ms} | ${a.longestFrameMs} | ${a.stallMsPerSecond} | ${a.longAnimationFrames ?? "n/a"} (${a.maxLoafMs ?? "–"}) | ${settle.longAnimationFrames ?? "n/a"} (${settle.maxLoafMs ?? "–"}) | ${a.pointerToRafP95Ms ?? "–"} | ${a.worstInteractionMs ?? "n/a"} | ${a.deliveredMovesPerSecond ?? "–"} | ${a.topLoafScripts.slice(0, 2).join("; ")} |`;
const lines = [
  `# Whiteboard perf: ${LABEL} (${report.startedAt})`, "",
  `Fixture origin ${BASE}; GPU ${report.environment?.gpu}; cores ${report.environment?.cores}; real Desmos ${report.desmosReal}; viewport ${VIEWPORT.width}×${VIEWPORT.height}; settle window ${SETTLE_MS} ms.`,
  "rAF callbacks are uncapped in headless GPU Chrome, so frame budgets use frames over 16.7/33 ms and stall time, not average fps. The pointer→rAF figure is a scheduling proxy, not measured visible-ink latency.", "",
  "| Scenario | rAF callbacks | >16.7 ms | >33 ms | longest | stall ms/s | LoAF >50 ms (max) | settle LoAF (max) | ptr→rAF p95 | worst interaction | moves/s | top LoAF scripts |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
];
for (const [key, result] of Object.entries(report.results)) {
  if (result.status !== "valid") { lines.push(`| ${key} | **${result.status}**: ${result.error ?? result.reason ?? ""} |||||||||||`); continue; }
  if (result.active) lines.push(row(key, result.active, result.settle));
  else if (key.startsWith("pan@")) for (const part of ["handPan", "ctrlWheelZoom", "wheelScroll"]) lines.push(row(`${key}:${part}`, result[part].active, result[part].settle));
  else if (result.cases) lines.push(`| ${key} | ${Object.entries(result.cases).map(([demo, timing]) => `${demo} ${timing.warmReadyMs} ms`).join("; ")} |||||||||||`);
  else lines.push(`| ${key} | heap Δ per 10 cycles ${result.heapGrowthPer10CyclesMB.join(" / ")} MB; nodes Δ ${result.nodeGrowthTotal}; listeners Δ ${result.listenerGrowthTotal}; calculators ${JSON.stringify(result.calculators)} |||||||||||`);
}
lines.push("", "## Budgets", "", "| Check | Scenario | Value | Pass |", "| --- | --- | --- | --- |", ...budgets.map((budget) => `| ${budget.check} | ${budget.key} | ${budget.value} | ${budget.pass ? "✅" : "❌"} |`));
writeFileSync(join(OUT_DIR, `${LABEL}-${stamp}.md`), redact(lines.join("\n") + "\n"));
console.log(redact(lines.join("\n")));
console.log(`\nSaved ${jsonPath}`);
process.exitCode = budgets.every((budget) => budget.pass) ? 0 : 2;
