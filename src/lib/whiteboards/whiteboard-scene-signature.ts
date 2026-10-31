import type { WhiteboardSceneData } from "@/lib/whiteboards/whiteboard-types";

// Persistent appState keys. The camera (scrollX, scrollY, zoom) is deliberately absent:
// moving the view is not an edit.
export const persistentWhiteboardAppStateKeys = ["viewBackgroundColor", "theme", "gridModeEnabled", "gridSize", "name"] as const;

type SceneLike = Pick<WhiteboardSceneData, "elements"> & { appState?: unknown; files?: unknown };

/**
 * A cheap fingerprint of everything a whiteboard save persists, used to decide whether a
 * scene changed without serializing it.
 *
 * Excalidraw gives every element a `version` and a random `versionNonce` and replaces both
 * on every mutation, so hashing id, version, nonce, deletion and array order (z-order)
 * detects every element edit. Elements without that metadata (hand-written or legacy data)
 * fall back to hashing their full JSON, so they can never be missed. Files are
 * content-addressed by id, so their ids identify them.
 */
export function getWhiteboardSceneSignature(scene: SceneLike): string {
  // Two independent 32-bit FNV-1a style accumulators make an accidental collision
  // (and with it a delayed save) vanishingly unlikely.
  let a = 0x811c9dc5;
  let b = 0x01000193;
  const mixCode = (code: number) => {
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x5bd1e995) + 0x27d4eb2d;
  };
  const mixString = (value: string) => {
    for (let index = 0; index < value.length; index += 1) mixCode(value.charCodeAt(index));
    mixCode(0x1f);
  };
  const mixNumber = (value: number) => mixString(String(value));

  const elements = Array.isArray(scene.elements) ? scene.elements : [];
  for (const element of elements) {
    if (!element || typeof element !== "object") {
      mixString(JSON.stringify(element) ?? "undefined");
      continue;
    }
    const record = element as Record<string, unknown>;
    if (typeof record.id === "string" && typeof record.version === "number" && typeof record.versionNonce === "number") {
      mixString(record.id);
      mixNumber(record.version);
      mixNumber(record.versionNonce);
      mixCode(record.isDeleted === true ? 1 : 0);
    } else {
      mixString(JSON.stringify(record));
    }
  }

  let fileCount = 0;
  if (scene.files && typeof scene.files === "object") {
    for (const fileId of Object.keys(scene.files as Record<string, unknown>)) {
      fileCount += 1;
      mixString(fileId);
    }
  }

  const appState = scene.appState && typeof scene.appState === "object" ? (scene.appState as Record<string, unknown>) : {};
  for (const key of persistentWhiteboardAppStateKeys) {
    if (key in appState) mixString(`${key}=${JSON.stringify(appState[key]) ?? "undefined"}`);
  }

  return `${elements.length}.${fileCount}.${(a >>> 0).toString(36)}.${(b >>> 0).toString(36)}`;
}
