import type { WorkspacePresentationMode } from "@/types";

const workspacePresentationStorageKey = "bindernotes.workspace.presentation-mode";
const workspacePresentationChangeEvent = "bindernotes:workspace-presentation-change";

export function loadWorkspacePresentationPreference(): WorkspacePresentationMode {
  if (typeof window === "undefined") {
    return "simple";
  }

  const value = window.localStorage.getItem(workspacePresentationStorageKey);
  return isWorkspacePresentationMode(value) ? value : "simple";
}

export function saveWorkspacePresentationPreference(mode: WorkspacePresentationMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(workspacePresentationStorageKey, mode);
  window.dispatchEvent(new CustomEvent(workspacePresentationChangeEvent, { detail: mode }));
}

export function subscribeWorkspacePresentationPreference(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === workspacePresentationStorageKey) {
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
