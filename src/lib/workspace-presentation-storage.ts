import type { WorkspacePresentationMode, WorkspaceViewMode } from "@/types";

const workspacePresentationStorageKey = "bindernotes.workspace.presentation-mode";
const workspaceViewStorageKey = "bindernotes.workspace.view-mode";
const workspacePresentationChangeEvent = "bindernotes:workspace-presentation-change";

export function loadWorkspacePresentationPreference(): WorkspacePresentationMode {
  if (typeof window === "undefined") {
    return "simple";
  }

  const viewMode = window.localStorage.getItem(workspaceViewStorageKey);
  if (isWorkspaceViewMode(viewMode)) {
    return toWorkspacePresentationMode(viewMode);
  }

  const value = window.localStorage.getItem(workspacePresentationStorageKey);
  return isWorkspacePresentationMode(value) ? value : "simple";
}

export function loadWorkspaceViewPreference(): WorkspaceViewMode {
  if (typeof window === "undefined") {
    return "simple";
  }

  const value = window.localStorage.getItem(workspaceViewStorageKey);
  if (isWorkspaceViewMode(value)) {
    return value;
  }

  const presentationValue = window.localStorage.getItem(workspacePresentationStorageKey);
  return isWorkspacePresentationMode(presentationValue) ? presentationValue : "simple";
}

export function saveWorkspacePresentationPreference(mode: WorkspacePresentationMode) {
  saveWorkspaceViewPreference(mode);
}

export function saveWorkspaceViewPreference(mode: WorkspaceViewMode) {
  if (typeof window === "undefined") {
    return;
  }

  const presentationMode = toWorkspacePresentationMode(mode);
  window.localStorage.setItem(workspaceViewStorageKey, mode);
  window.localStorage.setItem(workspacePresentationStorageKey, presentationMode);
  window.dispatchEvent(
    new CustomEvent(workspacePresentationChangeEvent, {
      detail: {
        presentationMode,
        viewMode: mode,
      },
    }),
  );
}

export function subscribeWorkspacePresentationPreference(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === workspacePresentationStorageKey || event.key === workspaceViewStorageKey) {
      listener();
    }
  };
  const handleLocalChange = () => listener();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(workspacePresentationChangeEvent, handleLocalChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(workspacePresentationChangeEvent, handleLocalChange);
  };
}

function isWorkspacePresentationMode(value: unknown): value is WorkspacePresentationMode {
  return value === "simple" || value === "canvas" || value === "facelift";
}

function isWorkspaceViewMode(value: unknown): value is WorkspaceViewMode {
  return value === "canvas" || value === "simple" || value === "facelift" || value === "modular";
}

function toWorkspacePresentationMode(mode: WorkspaceViewMode): WorkspacePresentationMode {
  if (mode === "facelift") {
    return "facelift";
  }

  if (mode === "canvas") {
    return "canvas";
  }

  return "simple";
}
