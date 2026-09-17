// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadWorkspacePresentationPreference,
  loadWorkspaceViewPreference,
  saveWorkspacePresentationPreference,
  saveWorkspaceViewPreference,
  subscribeWorkspacePresentationPreference,
} from "@/lib/workspace-presentation-storage";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("workspace presentation storage", () => {
  it("keeps Study Panels as a first-class saved view while preserving the legacy presentation cache", () => {
    saveWorkspaceViewPreference("modular");

    expect(loadWorkspaceViewPreference()).toBe("modular");
    expect(loadWorkspacePresentationPreference()).toBe("simple");
    expect(window.localStorage.getItem("bindernotes.workspace.view-mode")).toBe("modular");
    expect(window.localStorage.getItem("bindernotes.workspace.presentation-mode")).toBe("simple");
  });

  it("hydrates old presentation-only values without flashing to an invalid mode", () => {
    window.localStorage.setItem("bindernotes.workspace.presentation-mode", "canvas");

    expect(loadWorkspaceViewPreference()).toBe("canvas");
    expect(loadWorkspacePresentationPreference()).toBe("canvas");
  });

  it("falls back safely when stored values are invalid", () => {
    window.localStorage.setItem("bindernotes.workspace.view-mode", "standard");
    window.localStorage.setItem("bindernotes.workspace.presentation-mode", "minimalist");

    expect(loadWorkspaceViewPreference()).toBe("simple");
    expect(loadWorkspacePresentationPreference()).toBe("simple");
  });

  it("notifies local listeners when either view or legacy presentation changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeWorkspacePresentationPreference(listener);

    saveWorkspaceViewPreference("facelift");
    saveWorkspacePresentationPreference("canvas");

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
