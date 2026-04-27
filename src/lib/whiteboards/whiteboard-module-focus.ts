import type { WhiteboardViewportTransform, WhiteboardFrame } from "@/lib/whiteboards/whiteboard-coordinate-utils";

export const MODULE_CREATION_UNSAFE_MIN_ZOOM = 0.5;
export const MODULE_CREATION_UNSAFE_MAX_ZOOM = 1.5;
export const READABLE_MODULE_ZOOM = 1;

export function isUnsafeModuleCreationZoom(zoom: number) {
  return zoom <= MODULE_CREATION_UNSAFE_MIN_ZOOM || zoom >= MODULE_CREATION_UNSAFE_MAX_ZOOM;
}

export function shouldPromptForModuleCreationZoom(zoom: number) {
  return isUnsafeModuleCreationZoom(zoom);
}

export function getReadableModuleZoom() {
  return READABLE_MODULE_ZOOM;
}

export function computeViewportTransformForNewModule(
  moduleFrame: WhiteboardFrame,
  currentTransform: WhiteboardViewportTransform,
  options: {
    desiredZoom?: number;
  } = {},
): WhiteboardViewportTransform {
  const desiredZoom = options.desiredZoom ?? READABLE_MODULE_ZOOM;
  const moduleCenter = {
    x: moduleFrame.x + moduleFrame.width / 2,
    y: moduleFrame.y + moduleFrame.height / 2,
  };

  return {
    ...currentTransform,
    zoom: desiredZoom,
    scrollX: (currentTransform.viewportWidth / 2 - (currentTransform.offsetLeft ?? 0)) / desiredZoom - moduleCenter.x,
    scrollY: (currentTransform.viewportHeight / 2 - (currentTransform.offsetTop ?? 0)) / desiredZoom - moduleCenter.y,
  };
}
