import { getWhiteboardModuleAnchorMode, getWhiteboardModuleScreenRect, type WhiteboardFrame, type WhiteboardViewportTransform } from "@/lib/whiteboards/whiteboard-coordinate-utils";
import { getWhiteboardModuleDefinition } from "@/lib/whiteboards/whiteboard-module-registry";
import type { BinderWhiteboard, WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

export function whiteboardPlainText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const node = value as { text?: unknown; content?: unknown[]; attrs?: { latex?: unknown } };
  if (typeof node.text === "string") return node.text;
  if (typeof node.attrs?.latex === "string") return node.attrs.latex;
  return Array.isArray(node.content) ? node.content.map(whiteboardPlainText).join(" ").replace(/\s+/g, " ").trim() : "";
}

export function getWhiteboardModuleText(module: WhiteboardModuleElement, sourceText = "") {
  return [module.title, module.noteTitle, getWhiteboardModuleDefinition(module.moduleId)?.label, whiteboardPlainText(module.noteContent), sourceText].filter(Boolean).join("\n");
}

export function getDrawingFrames(elements: unknown[]): WhiteboardFrame[] {
  return elements.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const e = raw as Record<string, unknown>;
    if (e.isDeleted || ![e.x, e.y, e.width, e.height].every((n) => typeof n === "number" && Number.isFinite(n))) return [];
    const width = Math.abs(e.width as number), height = Math.abs(e.height as number);
    const angle = typeof e.angle === "number" && Number.isFinite(e.angle) ? e.angle : 0;
    const rotatedWidth = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
    const rotatedHeight = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
    return [{ x: (e.x as number) + (e.width as number) / 2 - rotatedWidth / 2, y: (e.y as number) + (e.height as number) / 2 - rotatedHeight / 2, width: rotatedWidth, height: rotatedHeight }];
  });
}

export function getWhiteboardModuleExportFrame(module: WhiteboardModuleElement, viewport: WhiteboardViewportTransform): WhiteboardFrame {
  const screen = getWhiteboardModuleScreenRect(module, viewport);
  return { x: (screen.x - (viewport.offsetLeft ?? 0)) / viewport.zoom - viewport.scrollX, y: (screen.y - (viewport.offsetTop ?? 0)) / viewport.zoom - viewport.scrollY, width: screen.width / viewport.zoom, height: screen.height / viewport.zoom };
}

export function getFramesBounds(frames: WhiteboardFrame[]): WhiteboardFrame {
  if (!frames.length) return { x: 0, y: 0, width: 800, height: 600 };
  const left = Math.min(...frames.map((r) => r.x)), top = Math.min(...frames.map((r) => r.y));
  return { x: left, y: top, width: Math.max(1, Math.max(...frames.map((r) => r.x + r.width)) - left), height: Math.max(1, Math.max(...frames.map((r) => r.y + r.height)) - top) };
}

export function fitWhiteboardFrames(frames: WhiteboardFrame[], viewport: WhiteboardViewportTransform, padding = viewport.viewportWidth <= 640 ? 16 : 100): WhiteboardViewportTransform {
  const bounds = getFramesBounds(frames);
  const zoom = Math.max(0.1, Math.min(1.5, Math.max(1, viewport.viewportWidth - padding * 2) / bounds.width, Math.max(1, viewport.viewportHeight - padding * 2) / bounds.height));
  return { ...viewport, zoom, scrollX: viewport.viewportWidth / (2 * zoom) - bounds.x - bounds.width / 2, scrollY: viewport.viewportHeight / (2 * zoom) - bounds.y - bounds.height / 2 };
}

export function fitAllWhiteboardContent(board: Pick<BinderWhiteboard, "scene" | "modules">, viewport: WhiteboardViewportTransform) {
  const drawings = getDrawingFrames(board.scene.elements);
  // Fixed-size tools stay on screen; board cards participate in fitting.
  const modules = board.modules.filter((m) => getWhiteboardModuleAnchorMode(m) !== "viewport");
  let next = viewport;
  for (let i = 0; i < 12; i += 1) {
    const fitted = fitWhiteboardFrames([...drawings, ...modules.map((m) => getWhiteboardModuleExportFrame(m, next))], viewport);
    if (Math.abs(fitted.zoom - next.zoom) < 0.001) return fitted;
    next = fitted;
  }
  return next;
}

export type WhiteboardSearchResult = { id: string; label: string; kind: "module" | "drawing"; frame: WhiteboardFrame };

export function searchWhiteboard(board: Pick<BinderWhiteboard, "scene" | "modules">, query: string, sourceText: Record<string, string> = {}): WhiteboardSearchResult[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const modules: WhiteboardSearchResult[] = board.modules.filter((m) => getWhiteboardModuleText(m, sourceText[m.id]).toLocaleLowerCase().includes(needle)).map((m) => ({ id: m.id, label: m.title || m.noteTitle || getWhiteboardModuleDefinition(m.moduleId)?.label || "Study card", kind: "module", frame: m }));
  const drawings = board.scene.elements.flatMap((raw): WhiteboardSearchResult[] => {
    if (!raw || typeof raw !== "object") return [];
    const e = raw as { id?: unknown; text?: unknown; originalText?: unknown; isDeleted?: boolean };
    const text = typeof e.originalText === "string" ? e.originalText : typeof e.text === "string" ? e.text : "";
    const frame = getDrawingFrames([raw])[0];
    return !e.isDeleted && typeof e.id === "string" && frame && text.toLocaleLowerCase().includes(needle) ? [{ id: e.id, label: text.slice(0, 100), kind: "drawing", frame }] : [];
  });
  return [...modules, ...drawings];
}
