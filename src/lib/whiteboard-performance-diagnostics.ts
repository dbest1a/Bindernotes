export const workspaceMovementStartEvent = "bindernotes:workspace-movement-start";
export const workspaceMovementEndEvent = "bindernotes:workspace-movement-end";

export type WorkspaceMovementDiagnosticEvent =
  | "whiteboard-drag-start"
  | "whiteboard-drag-frame"
  | "whiteboard-drag-commit"
  | "workspace-frame-change"
  | "fit-tidy-during-drag"
  | "desmos-initialize"
  | "desmos-destroy"
  | "desmos-resize"
  | "desmos-resize-deferred"
  | "excalidraw-refresh"
  | "excalidraw-refresh-deferred";

export function isWorkspaceMovementActive() {
  return typeof document !== "undefined" && document.documentElement.dataset.workspaceDragging === "true";
}

export function setWorkspaceMovementActive(active: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.workspaceDragging = active ? "true" : "false";
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(active ? workspaceMovementStartEvent : workspaceMovementEndEvent),
    );
  }
}

export function shouldRecordWhiteboardDiagnostics() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-beta-whiteboard-performance-diagnostics") === "true"
  );
}

export function recordWhiteboardPerformanceDiagnostic(
  event: WorkspaceMovementDiagnosticEvent,
  detail?: Record<string, unknown>,
) {
  if (!shouldRecordWhiteboardDiagnostics()) {
    return;
  }

  if (typeof performance !== "undefined" && typeof performance.mark === "function") {
    performance.mark(event);
  }

  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug("[BinderNotes movement]", event, detail ?? {});
  }
}
