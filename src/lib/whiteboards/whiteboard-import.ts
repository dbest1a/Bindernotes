import { MAX_SCENE_SIZE_BYTES } from "./whiteboard-limits";
import { getWhiteboardModuleDefinition } from "./whiteboard-module-registry";
import { sanitizeWhiteboardForStorage, validateWhiteboardForStorage } from "./whiteboard-serialization";
import type { BinderWhiteboard, WhiteboardScope } from "./whiteboard-types";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
function invalid(detail: string): never { throw new Error(`Invalid whiteboard backup: ${detail}`); }

/** Validate before sanitizing: never silently turn a damaged backup into an empty board. */
export function parseWhiteboardBackup(text: string, scope: WhiteboardScope): BinderWhiteboard {
  if (new TextEncoder().encode(text).length > MAX_SCENE_SIZE_BYTES * 2) invalid("file is too large.");
  let parsed: unknown;
  try { parsed = JSON.parse(text, (key, value: unknown) => {
    if (["__proto__", "prototype", "constructor"].includes(key)) invalid("unsafe property.");
    if (typeof value === "number" && !Number.isFinite(value)) invalid("non-finite number.");
    return value;
  }); } catch { invalid("the file must contain valid JSON."); }
  if (!record(parsed) || parsed.format !== "bindernotes-whiteboard") invalid("choose a BinderNotes JSON backup.");
  if (parsed.version !== 1) invalid("this backup version is not supported.");
  const board = parsed.board;
  if (!record(board) || typeof board.title !== "string" || !board.title.trim() || typeof board.subject !== "string") invalid("missing board details.");
  if (!record(board.scene) || !Array.isArray(board.scene.elements) || !Array.isArray(board.modules)) invalid("missing scene or cards.");
  if (board.scene.appState !== undefined && !record(board.scene.appState)) invalid("invalid camera settings.");
  if (board.scene.files !== undefined && !record(board.scene.files)) invalid("invalid embedded files.");
  if (record(board.scene.appState)) {
    for (const key of ["scrollX", "scrollY"]) if (board.scene.appState[key] !== undefined && typeof board.scene.appState[key] !== "number") invalid("invalid camera position.");
    const zoom = record(board.scene.appState.zoom) ? board.scene.appState.zoom.value : board.scene.appState.zoom;
    if (zoom !== undefined && (typeof zoom !== "number" || zoom <= 0)) invalid("invalid camera zoom.");
  }
  const ids = new Set<string>();
  for (const element of board.scene.elements) {
    if (!record(element) || typeof element.id !== "string" || !element.id || typeof element.type !== "string") invalid("invalid drawing.");
    for (const key of ["x", "y", "width", "height"]) if (typeof element[key] !== "number" || !Number.isFinite(element[key])) invalid("invalid drawing coordinates.");
  }
  for (const module of board.modules) {
    if (!record(module) || typeof module.id !== "string" || !module.id || ids.has(module.id)) invalid("invalid or duplicate card ID.");
    ids.add(module.id);
    if (module.type !== "bindernotes-module" || typeof module.moduleId !== "string" || !getWhiteboardModuleDefinition(module.moduleId as never)) invalid("unknown card type.");
    for (const key of ["x", "y", "width", "height", "zIndex"]) if (typeof module[key] !== "number" || !Number.isFinite(module[key])) invalid("invalid card coordinates.");
    if ((module.width as number) <= 0 || (module.height as number) <= 0) invalid("card dimensions must be positive.");
    if (!["live", "preview", "collapsed"].includes(String(module.mode))) invalid("unknown card mode.");
    if (module.anchorMode !== undefined && !["board", "board-fixed-size", "viewport"].includes(String(module.anchorMode))) invalid("unknown card pin mode.");
    for (const key of ["binderId", "lessonId", "savedGraphId", "graphInstanceId", "title", "noteTitle"]) if (module[key] !== undefined && typeof module[key] !== "string") invalid("invalid card source or title.");
    if (module.noteContent !== undefined && (!record(module.noteContent) || module.noteContent.type !== "doc" || (module.noteContent.content !== undefined && !Array.isArray(module.noteContent.content)))) invalid("invalid note document.");
    for (const key of ["whiteboardComments", "whiteboardHighlights"]) if (module[key] !== undefined && !Array.isArray(module[key])) invalid("invalid annotations.");
    if (Array.isArray(module.whiteboardComments) && module.whiteboardComments.some((comment) => !record(comment) || typeof comment.id !== "string" || typeof comment.body !== "string")) invalid("invalid sticky note.");
    if (module.graphWorkspace !== undefined) {
      const graph = module.graphWorkspace;
      if (!record(graph) || graph.version !== 1 || !["2d", "3d"].includes(String(graph.graphMode)) || !record(graph.graphStatesByMode) || !Array.isArray(graph.history) || !Array.isArray(graph.savedGraphs) || !Array.isArray(graph.savedFunctions) || typeof graph.calculatorExpression !== "string") invalid("invalid graph workspace.");
      for (const state of [graph.currentGraphState, graph.graphStatesByMode["2d"], graph.graphStatesByMode["3d"]]) if (state !== null && state !== undefined && !record(state)) invalid("invalid graph state.");
      if (graph.history.some((item) => !record(item) || typeof item.id !== "string" || typeof item.expression !== "string" || typeof item.result !== "string") ||
          graph.savedFunctions.some((item) => !record(item) || typeof item.id !== "string" || typeof item.name !== "string" || typeof item.expression !== "string") ||
          graph.savedGraphs.some((item) => !record(item) || typeof item.id !== "string" || typeof item.name !== "string" || !record(item.state))) invalid("invalid graph history.");
    }
    // Every imported graph owns a new runtime scope, so edits cannot leak back
    // into the original board on the same device.
    if (module.moduleId === "desmos-graph") module.graphInstanceId = `whiteboard-desmos-${crypto.randomUUID()}`;
  }
  const timestamp = new Date().toISOString();
  const restored = sanitizeWhiteboardForStorage({
    ...(board as unknown as BinderWhiteboard),
    id: `whiteboard-${crypto.randomUUID()}`,
    ownerId: scope.ownerId, binderId: scope.binderId, lessonId: scope.lessonId ?? null,
    title: `${board.title.trim()} (restored)`, moduleContext: scope.lessonId ? "lesson" : "binder",
    storageMode: "local-draft", contentLoaded: true, recoveryStorage: undefined,
    storageRevision: undefined,
    createdAt: timestamp, updatedAt: timestamp, archivedAt: null,
    thumbnailDataUrl: null, objectCount: 0, sceneSizeBytes: 0, assetSizeBytes: 0,
  });
  const validation = validateWhiteboardForStorage(restored);
  if (!validation.valid) invalid(validation.errors.join(" "));
  return restored;
}
