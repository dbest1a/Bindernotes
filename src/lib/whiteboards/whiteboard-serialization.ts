import {
  MAX_OBJECTS_HARD_CAP,
  MAX_OBJECTS_WARNING,
  MAX_SCENE_SIZE_BYTES,
} from "@/lib/whiteboards/whiteboard-limits";
import {
  getDefaultWhiteboardModuleAnchorMode,
  getWhiteboardModuleDefinition,
} from "@/lib/whiteboards/whiteboard-module-registry";
import type {
  BinderWhiteboard,
  WhiteboardModuleAnchorMode,
  WhiteboardModuleElement,
  WhiteboardSceneData,
  WhiteboardValidationResult,
} from "@/lib/whiteboards/whiteboard-types";

const textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

export function estimateJsonSizeBytes(value: unknown) {
  const serialized = JSON.stringify(value);
  if (textEncoder) {
    return textEncoder.encode(serialized).byteLength;
  }

  return serialized.length;
}

export function countWhiteboardObjects(board: Pick<BinderWhiteboard, "scene" | "modules">) {
  return (board.scene.elements?.length ?? 0) + board.modules.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAnchorMode(moduleElement: WhiteboardModuleElement): WhiteboardModuleAnchorMode {
  if (
    moduleElement.anchorMode === "board" ||
    moduleElement.anchorMode === "board-fixed-size" ||
    moduleElement.anchorMode === "viewport"
  ) {
    return moduleElement.anchorMode;
  }

  if (moduleElement.pinned === true) {
    return "board";
  }

  if (moduleElement.pinned === false) {
    return "viewport";
  }

  const definition = getWhiteboardModuleDefinition(moduleElement.moduleId);
  return definition?.defaultAnchorMode ?? getDefaultWhiteboardModuleAnchorMode(moduleElement.moduleId);
}

const safeExcalidrawAppStateKeys = new Set([
  "viewBackgroundColor",
  "theme",
  "gridModeEnabled",
  "gridSize",
  "scrollX",
  "scrollY",
  "zoom",
  "name",
]);

const persistentAppStateKeys = new Set(
  [...safeExcalidrawAppStateKeys].filter((key) => key !== "scrollX" && key !== "scrollY" && key !== "zoom"),
);

export function sanitizeExcalidrawInitialData(raw: unknown): WhiteboardSceneData {
  const source = isRecord(raw) ? raw : {};
  const rawAppState = isRecord(source.appState) ? source.appState : {};
  const appState: Record<string, unknown> = {};

  for (const key of safeExcalidrawAppStateKeys) {
    if (key in rawAppState) {
      appState[key] = rawAppState[key];
    }
  }

  return {
    elements: Array.isArray(source.elements) ? source.elements : [],
    appState,
    files: isRecord(source.files) ? source.files : {},
  };
}

export function sanitizeWhiteboardModuleElement(
  moduleElement: WhiteboardModuleElement,
): WhiteboardModuleElement {
  const anchorMode = normalizeAnchorMode(moduleElement);
  const mode =
    moduleElement.mode === "live" || moduleElement.mode === "preview" || moduleElement.mode === "collapsed"
      ? moduleElement.mode
      : "preview";

  return {
    id: moduleElement.id,
    type: "bindernotes-module",
    moduleId: moduleElement.moduleId,
    binderId: moduleElement.binderId,
    lessonId: moduleElement.lessonId,
    savedGraphId: moduleElement.savedGraphId,
    x: typeof moduleElement.x === "number" && Number.isFinite(moduleElement.x) ? moduleElement.x : 0,
    y: typeof moduleElement.y === "number" && Number.isFinite(moduleElement.y) ? moduleElement.y : 0,
    width:
      typeof moduleElement.width === "number" && Number.isFinite(moduleElement.width) && moduleElement.width > 0
        ? moduleElement.width
        : 220,
    height:
      typeof moduleElement.height === "number" && Number.isFinite(moduleElement.height) && moduleElement.height > 0
        ? moduleElement.height
        : 160,
    zIndex:
      typeof moduleElement.zIndex === "number" && Number.isFinite(moduleElement.zIndex)
        ? moduleElement.zIndex
        : 1,
    mode,
    anchorMode,
    pinned: anchorMode !== "viewport",
    title: moduleElement.title,
    createdAt: moduleElement.createdAt,
    updatedAt: moduleElement.updatedAt,
  };
}

function pickPersistentSceneState(scene: WhiteboardSceneData) {
  const source = sanitizeExcalidrawInitialData(scene);
  const appState = Object.fromEntries(
    Object.entries(source.appState ?? {}).filter(([key]) => persistentAppStateKeys.has(key)),
  );

  return {
    elements: source.elements,
    files: source.files ?? {},
    appState,
  };
}

export function hasPersistentWhiteboardSceneChange(
  previousScene: WhiteboardSceneData,
  nextScene: WhiteboardSceneData,
) {
  return JSON.stringify(pickPersistentSceneState(previousScene)) !== JSON.stringify(pickPersistentSceneState(nextScene));
}

export function sanitizeWhiteboardForStorage(board: BinderWhiteboard): BinderWhiteboard {
  const modules = board.modules.map(sanitizeWhiteboardModuleElement);
  const scene = sanitizeExcalidrawInitialData(board.scene);
  const objectCount = countWhiteboardObjects({ scene, modules });
  const sceneSizeBytes = estimateJsonSizeBytes({
    scene,
    modules,
  });

  return {
    ...board,
    scene,
    modules,
    objectCount,
    sceneSizeBytes,
    storageMode: board.storageMode,
  };
}

export function validateWhiteboardForStorage(board: BinderWhiteboard): WhiteboardValidationResult {
  const sanitized = sanitizeWhiteboardForStorage(board);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (sanitized.objectCount >= MAX_OBJECTS_WARNING) {
    warnings.push(
      `This whiteboard has ${sanitized.objectCount} objects. Large boards can get slower, so consider using sections.`,
    );
  }

  if (sanitized.objectCount > MAX_OBJECTS_HARD_CAP) {
    errors.push(
      `This whiteboard has too many objects (${sanitized.objectCount}). The local review cap is ${MAX_OBJECTS_HARD_CAP}.`,
    );
  }

  if (sanitized.sceneSizeBytes > MAX_SCENE_SIZE_BYTES) {
    errors.push(
      `This whiteboard scene is too large (${sanitized.sceneSizeBytes} bytes). The local review cap is ${MAX_SCENE_SIZE_BYTES} bytes.`,
    );
  }

  return {
    valid: errors.length === 0,
    objectCount: sanitized.objectCount,
    sceneSizeBytes: sanitized.sceneSizeBytes,
    warnings,
    errors,
  };
}
