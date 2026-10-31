// Helpers for authoring stress boards (dev only; output is scripts/stress/boards/qNN.json).
import { writeFileSync } from "node:fs";
export const r = String.raw;

export function solution(id, { title, problem, steps, answer }, box) {
  return {
    id,
    moduleId: "solution-steps",
    // The card header stays generic; the solution's own title names the question.
    title: "Worked solution",
    ...box,
    anchorMode: "board-fixed-size",
    solution: {
      version: 1,
      title,
      problem,
      steps: steps.map(([math, note], index) => ({ id: `${id}-s${String(index + 1).padStart(2, "0")}`, math, ...(note ? { note } : {}) })),
      answer,
      source: { kind: "manual" },
    },
  };
}

let exprCounter = 0;
/** Expression shorthand: string latex or object; ids are assigned when missing. */
function expressions(list) {
  return list.map((item) => {
    const base = typeof item === "string" ? { latex: item } : item;
    exprCounter += 1;
    if (base.type === "folder" || base.type === "text" || base.type === "table") return { id: base.id ?? `e${exprCounter}`, ...base };
    // Desmos graphs every one-variable function definition (f(t)=…), so helper definitions are hidden.
    const isHelperFunction = /^\s*\\?[A-Za-z]+(_\{[^}]*\})?\(\s*[A-Za-z]\s*\)\s*=/.test(base.latex ?? "");
    return { type: "expression", id: base.id ?? `e${exprCounter}`, ...(isHelperFunction ? { hidden: true } : {}), ...base };
  });
}

export function desmos(id, title, box, { mode = "2d", viewport, list, settings = {} }) {
  const state = {
    version: 11,
    randomSeed: `stress${id}`,
    graph: { viewport, ...(mode === "3d" ? { threeDMode: true, product: "graphing-3d" } : { squareAxes: false }), ...settings },
    expressions: { list: expressions(list) },
  };
  return {
    id,
    moduleId: "desmos-graph",
    title,
    ...box,
    anchorMode: "board-fixed-size",
    graphWorkspace: {
      version: 1,
      graphVisible: true,
      graphExpanded: false,
      graphMode: mode,
      graphStatesByMode: { "2d": mode === "2d" ? state : null, "3d": mode === "3d" ? state : null },
      angleMode: "rad",
      calculatorExpression: "",
      calculatorResult: null,
      calculatorError: null,
      history: [],
      currentGraphState: state,
      savedGraphs: [],
      savedFunctions: [],
    },
  };
}

export function molecule(id, { smiles, name, caption, showAtomNumbers, showHydrogens, highlightAtoms }, box) {
  const doc = { version: 1, kind: smiles.includes(">") ? "reaction" : "molecule", smiles };
  if (name) doc.name = name;
  if (caption) doc.caption = caption;
  if (showAtomNumbers !== undefined) doc.showAtomNumbers = showAtomNumbers;
  if (showHydrogens !== undefined) doc.showHydrogens = showHydrogens;
  if (highlightAtoms) doc.highlightAtoms = highlightAtoms;
  return { id, moduleId: "chem-molecule", title: name ?? "Molecule", ...box, anchorMode: "board-fixed-size", molecule: doc };
}

// --- Excalidraw elements -------------------------------------------------------------
// The board renders Excalidraw in dark theme, which inverts canvas colours (invert + hue-rotate),
// so elements use Excalidraw's light-theme palette: "#1e1e1e" shows as near-white, and so on.
export const EX = { ink: "#1e1e1e", muted: "#495057", red: "#e03131", green: "#2f9e44", blue: "#1971c2", orange: "#f08c00", violet: "#6741d9", teal: "#0c8599", pink: "#c2255c" };
let seed = 1000;
const nextSeed = () => (seed += 7919);
function baseElement(type, id, x, y, width, height, extra = {}) {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: extra.strokeColor ?? "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: extra.strokeWidth ?? 2,
    strokeStyle: extra.strokeStyle ?? "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    ...extra.more,
  };
}

/** A text label. fontFamily 2 = Helvetica-like; lineHeight 1.25. */
export function text(id, x, y, value, { fontSize = 20, color = "#1e1e1e", width } = {}) {
  const lines = value.split("\n");
  const w = width ?? Math.max(...lines.map((line) => line.length)) * fontSize * 0.55;
  const h = lines.length * fontSize * 1.25;
  return baseElement("text", id, x, y, w, h, {
    strokeColor: color,
    strokeWidth: 1,
    more: {
      text: value,
      originalText: value,
      fontSize,
      fontFamily: 2,
      textAlign: "left",
      verticalAlign: "top",
      containerId: null,
      lineHeight: 1.25,
      baseline: Math.round(fontSize * 0.9),
      autoResize: true,
    },
  });
}

/** An arrow through absolute points [[x,y], ...]. */
export function arrow(id, points, { color = "#f08c00", strokeWidth = 2, end = "arrow", start = null, strokeStyle = "solid", curved = false } = {}) {
  const [x0, y0] = points[0];
  const rel = points.map(([x, y]) => [x - x0, y - y0]);
  const xs = rel.map((p) => p[0]);
  const ys = rel.map((p) => p[1]);
  return baseElement("arrow", id, x0, y0, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), {
    strokeColor: color,
    strokeWidth,
    strokeStyle,
    more: {
      points: rel,
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: start,
      endArrowhead: end,
      roundness: curved ? { type: 2 } : null,
      elbowed: false,
    },
  });
}

export function line(id, points, opts = {}) {
  const element = arrow(id, points, { ...opts, end: null });
  element.type = "line";
  return element;
}

export function ellipse(id, x, y, width, height, { color = "#1e1e1e", strokeWidth = 2 } = {}) {
  return baseElement("ellipse", id, x, y, width, height, { strokeColor: color, strokeWidth });
}

export function rect(id, x, y, width, height, { color = "#495057", strokeWidth = 1, strokeStyle = "solid" } = {}) {
  return { ...baseElement("rectangle", id, x, y, width, height, { strokeColor: color, strokeWidth, strokeStyle }), roundness: { type: 3 } };
}

export function writeBoard(path, board) {
  writeFileSync(path, JSON.stringify(board, null, 2) + "\n");
}
