import {
  getWhiteboardModuleScreenRect,
  type WhiteboardViewportTransform,
  type WhiteboardPoint,
} from "@/lib/whiteboards/whiteboard-coordinate-utils";
import type { WhiteboardModuleElement } from "@/lib/whiteboards/whiteboard-types";

export type PrivateNotesTargetCandidate = {
  moduleId: string;
  title: string;
  distance: number;
  mode: WhiteboardModuleElement["mode"];
};

export type PrivateNotesTargetResolution =
  | {
      status: "target-found";
      moduleId: string;
      reason: "explicit" | "nearest" | "last-used" | "single-open";
      confidence: "high" | "medium" | "low";
      candidates: PrivateNotesTargetCandidate[];
    }
  | {
      status: "ambiguous";
      candidates: PrivateNotesTargetCandidate[];
    }
  | {
      status: "none-open";
      candidates: [];
    };

export type AnnotationOrigin =
  | {
      kind: "board";
      point: WhiteboardPoint;
    }
  | {
      kind: "screen";
      point: WhiteboardPoint;
    };

function centerOfScreenRect(moduleElement: WhiteboardModuleElement, viewportTransform: WhiteboardViewportTransform) {
  const rect = getWhiteboardModuleScreenRect(moduleElement, viewportTransform);
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function distance(left: WhiteboardPoint, right: WhiteboardPoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function findWhiteboardPrivateNotesModules(modules: WhiteboardModuleElement[]) {
  return modules.filter((moduleElement) => moduleElement.moduleId === "private-notes");
}

export function rankPrivateNotesTargets(
  origin: AnnotationOrigin,
  notesModules: WhiteboardModuleElement[],
  viewportTransform: WhiteboardViewportTransform,
): PrivateNotesTargetCandidate[] {
  const originPoint =
    origin.kind === "screen"
      ? origin.point
      : {
          x: (origin.point.x + viewportTransform.scrollX) * viewportTransform.zoom + (viewportTransform.offsetLeft ?? 0),
          y: (origin.point.y + viewportTransform.scrollY) * viewportTransform.zoom + (viewportTransform.offsetTop ?? 0),
        };

  return notesModules
    .map((moduleElement) => {
      const center = centerOfScreenRect(moduleElement, viewportTransform);
      const modeBias = moduleElement.mode === "live" ? -100 : moduleElement.mode === "preview" ? 0 : 140;

      return {
        moduleId: moduleElement.id,
        title: moduleElement.noteTitle ?? moduleElement.title ?? "Private Notes",
        distance: Math.max(0, distance(originPoint, center) + modeBias),
        mode: moduleElement.mode,
      };
    })
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      if (left.mode !== right.mode) {
        return left.mode === "live" ? -1 : right.mode === "live" ? 1 : left.mode.localeCompare(right.mode);
      }

      return left.title.localeCompare(right.title);
    });
}

export function getAnnotationOriginFromModule(
  moduleElement: WhiteboardModuleElement,
): AnnotationOrigin {
  return {
    kind: "board",
    point: {
      x: moduleElement.x + moduleElement.width / 2,
      y: moduleElement.y + (moduleElement.mode === "collapsed" ? 72 : moduleElement.height) / 2,
    },
  };
}

export function resolvePrivateNotesTarget({
  explicitTargetId,
  lastUsedTargetId,
  modules,
  origin,
  viewportTransform,
}: {
  explicitTargetId?: string | null;
  lastUsedTargetId?: string | null;
  modules: WhiteboardModuleElement[];
  origin: AnnotationOrigin;
  viewportTransform: WhiteboardViewportTransform;
}): PrivateNotesTargetResolution {
  const notesModules = findWhiteboardPrivateNotesModules(modules);
  const candidates = rankPrivateNotesTargets(origin, notesModules, viewportTransform);

  if (notesModules.length === 0) {
    return { status: "none-open", candidates: [] };
  }

  if (explicitTargetId && notesModules.some((moduleElement) => moduleElement.id === explicitTargetId)) {
    return {
      status: "target-found",
      moduleId: explicitTargetId,
      reason: "explicit",
      confidence: "high",
      candidates,
    };
  }

  if (notesModules.length === 1) {
    return {
      status: "target-found",
      moduleId: notesModules[0].id,
      reason: "single-open",
      confidence: "high",
      candidates,
    };
  }

  const [first, second] = candidates;
  if (first && second && Math.abs(first.distance - second.distance) < 24) {
    if (
      lastUsedTargetId &&
      notesModules.some((moduleElement) => moduleElement.id === lastUsedTargetId && moduleElement.mode !== "collapsed")
    ) {
      return {
        status: "target-found",
        moduleId: lastUsedTargetId,
        reason: "last-used",
        confidence: "medium",
        candidates,
      };
    }

    return {
      status: "ambiguous",
      candidates,
    };
  }

  return {
    status: "target-found",
    moduleId: first.moduleId,
    reason: "nearest",
    confidence: "high",
    candidates,
  };
}
