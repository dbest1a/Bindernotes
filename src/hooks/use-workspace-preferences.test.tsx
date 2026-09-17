// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePreferences } from "@/types";

const mocks = vi.hoisted(() => ({
  clearThemeOverride: vi.fn(),
  getWorkspacePreferencesRecord: vi.fn(),
  globalTheme: {
    id: "space",
    studySurface: "night-study",
    accent: "174 67% 48%",
    density: "cozy",
    roundness: "round",
    shadow: "lifted",
    font: "system",
    backgroundStyle: "subtle-grid",
    hoverMotion: false,
    snapMode: false,
    focusMode: false,
    compactMode: false,
    animationLevel: "none",
    graphAppearance: "sync",
    graphChrome: "standard",
    verticalSpace: "balanced",
    defaultHighlightColor: "yellow",
    reducedChrome: true,
    showUtilityUi: false,
    customPalette: {
      primary: "#0f766e",
      secondary: "#1d4ed8",
      accent: "#a16207",
    },
  },
  setTheme: vi.fn(),
  upsertWorkspacePreferencesRecord: vi.fn(),
}));

vi.mock("@/services/binder-service", () => ({
  getWorkspacePreferencesRecord: mocks.getWorkspacePreferencesRecord,
  upsertWorkspacePreferencesRecord: mocks.upsertWorkspacePreferencesRecord,
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    clearThemeOverride: mocks.clearThemeOverride,
    globalTheme: mocks.globalTheme,
    setTheme: mocks.setTheme,
  }),
}));

import { useWorkspacePreferences } from "@/hooks/use-workspace-preferences";
import {
  applyPreset,
  applyWorkspaceMode,
  createDefaultWorkspacePreferences,
} from "@/lib/workspace-preferences";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("useWorkspacePreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.globalTheme = {
      ...mocks.globalTheme,
      id: "space",
      accent: "174 67% 48%",
    };
    mocks.clearThemeOverride.mockReset();
    mocks.getWorkspacePreferencesRecord.mockReset();
    mocks.setTheme.mockReset();
    mocks.upsertWorkspacePreferencesRecord.mockReset();
  });

  it("boots directly into the locally cached workspace view before account preferences resolve", () => {
    mocks.getWorkspacePreferencesRecord.mockReturnValue(new Promise(() => {}));

    for (const [storedMode, expected] of [
      ["facelift", { activeMode: "simple", workspacePresentationMode: "facelift" }],
      ["modular", { activeMode: "modular", workspacePresentationMode: "simple" }],
      ["canvas", { activeMode: "canvas", workspacePresentationMode: "canvas" }],
      ["simple", { activeMode: "simple", workspacePresentationMode: "simple" }],
      ["standard", { activeMode: "simple", workspacePresentationMode: "simple" }],
    ] as const) {
      window.localStorage.setItem("bindernotes.workspace.view-mode", storedMode);
      const { result, unmount } = renderHook(() =>
        useWorkspacePreferences("user-1", "binder-1", null),
      );

      expect(result.current.active).toEqual(expect.objectContaining(expected));
      unmount();
      window.localStorage.clear();
    }
  });

  it("normalizes legacy saved preferences before the document reads focus mode", async () => {
    const legacy = createDefaultWorkspacePreferences("user-1", "binder-1");
    delete (legacy as Partial<WorkspacePreferences>).simple;
    delete (legacy as Partial<WorkspacePreferences>).appearance;
    delete (legacy.theme as Partial<WorkspacePreferences["theme"]>).studySurface;

    mocks.getWorkspacePreferencesRecord.mockResolvedValueOnce(legacy);

    const { result } = renderHook(() =>
      useWorkspacePreferences("user-1", "binder-1", null),
    );

    await waitFor(() => {
      expect(result.current.active?.simple.focusMode).toBe(false);
    });

    expect(result.current.active?.appearance.studySurface).toBe("match");
    expect(result.current.active?.theme.studySurface).toBe("match");
    expect(result.current.active?.appearance.saveLocalAppearance).toBe(false);
    expect(mocks.clearThemeOverride).toHaveBeenCalled();
    expect(mocks.setTheme).not.toHaveBeenCalled();
  });

  it("uses a saved workspace appearance only when local color saving is enabled", async () => {
    const local = createDefaultWorkspacePreferences("user-1", "binder-1");
    local.appearance = {
      ...local.appearance,
      appTheme: "paper-studio",
      studySurface: "warm-paper",
      saveLocalAppearance: true,
    };
    local.theme = {
      ...local.theme,
      id: "paper-studio",
      studySurface: "warm-paper",
    };
    local.simple = {
      ...local.simple,
      theme: "warm-paper",
    };

    mocks.getWorkspacePreferencesRecord.mockResolvedValueOnce(local);

    const { result } = renderHook(() =>
      useWorkspacePreferences("user-1", "binder-1", null),
    );

    await waitFor(() => {
      expect(result.current.active?.appearance.saveLocalAppearance).toBe(true);
    });

    expect(result.current.active?.appearance.studySurface).toBe("warm-paper");
    expect(mocks.setTheme).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "paper-studio",
        studySurface: "warm-paper",
      }),
    );
  });

  it.each(["resolve", "reject"] as const)("ignores old account saves that %s after a scope change", async (outcome) => {
    mocks.getWorkspacePreferencesRecord.mockImplementation(async (userId, binderId) =>
      createDefaultWorkspacePreferences(userId, binderId));
    const pending = deferred<WorkspacePreferences>();
    mocks.upsertWorkspacePreferencesRecord.mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(
      ({ userId }) => useWorkspacePreferences(userId, "binder-1", null),
      { initialProps: { userId: "user-1" } },
    );
    await waitFor(() => expect(mocks.getWorkspacePreferencesRecord).toHaveBeenCalledTimes(1));
    let oldSave!: WorkspacePreferences;
    act(() => { oldSave = result.current.commit(applyWorkspaceMode(result.current.active!, "canvas")); });
    rerender({ userId: "user-2" });
    await waitFor(() => expect(result.current.active?.userId).toBe("user-2"));
    const viewModeBeforeCompletion = window.localStorage.getItem("bindernotes.workspace.view-mode");
    await act(async () => {
      if (outcome === "resolve") pending.resolve(oldSave);
      else pending.reject(new Error("obsolete save error"));
    });
    expect(result.current.saved?.userId).toBe("user-2");
    expect(result.current.saveError).toBeNull();
    expect(window.localStorage.getItem("bindernotes.workspace.view-mode")).toBe(viewModeBeforeCompletion);
  });

  it("ignores preference side effects after unmount", async () => {
    mocks.getWorkspacePreferencesRecord.mockResolvedValue(createDefaultWorkspacePreferences("user-1", "binder-1"));
    const pending = deferred<WorkspacePreferences>();
    mocks.upsertWorkspacePreferencesRecord.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useWorkspacePreferences("user-1", "binder-1", null));
    await waitFor(() => expect(mocks.getWorkspacePreferencesRecord).toHaveBeenCalled());
    let oldSave!: WorkspacePreferences;
    act(() => { oldSave = result.current.commit(applyWorkspaceMode(result.current.active!, "canvas")); });
    unmount();
    window.localStorage.setItem("bindernotes.workspace.view-mode", "modular");
    await act(async () => { pending.resolve(oldSave); });
    expect(window.localStorage.getItem("bindernotes.workspace.view-mode")).toBe("modular");
  });

  it("keeps the newest save authoritative when older saves finish last", async () => {
    mocks.getWorkspacePreferencesRecord.mockResolvedValue(createDefaultWorkspacePreferences("user-1", "binder-1"));
    const older = deferred<WorkspacePreferences>();
    const newer = deferred<WorkspacePreferences>();
    mocks.upsertWorkspacePreferencesRecord.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const { result } = renderHook(() => useWorkspacePreferences("user-1", "binder-1", null));
    await waitFor(() => expect(mocks.getWorkspacePreferencesRecord).toHaveBeenCalled());
    let olderSave!: WorkspacePreferences;
    let newerSave!: WorkspacePreferences;
    act(() => { olderSave = result.current.commit(applyWorkspaceMode(result.current.active!, "canvas")); });
    act(() => { newerSave = result.current.commit(applyWorkspaceMode(result.current.active!, "modular")); });
    await act(async () => { newer.resolve(newerSave); });
    await act(async () => { older.resolve(olderSave); });
    expect(result.current.saved?.activeMode).toBe("modular");
    expect(window.localStorage.getItem("bindernotes.workspace.view-mode")).toBe("modular");
  });

  it("applies global theme changes without reloading account preferences", async () => {
    const saved = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.getWorkspacePreferencesRecord.mockResolvedValue(saved);

    const { result, rerender } = renderHook(() =>
      useWorkspacePreferences("user-1", "binder-1", null),
    );

    await waitFor(() => {
      expect(result.current.active).not.toBeNull();
      expect(mocks.getWorkspacePreferencesRecord).toHaveBeenCalledTimes(1);
    });

    mocks.globalTheme = {
      ...mocks.globalTheme,
      id: "paper-studio",
      accent: "24 95% 53%",
    };
    rerender();

    await waitFor(() => {
      expect(result.current.active?.theme.id).toBe("paper-studio");
    });
    expect(mocks.getWorkspacePreferencesRecord).toHaveBeenCalledTimes(1);
  });

  it("unlocks a canvas edit draft without moving frames, reapplying presets, or persisting", async () => {
    const customFrame = { x: 64, y: 2200, w: 720, h: 520, z: 9 };
    const saved = {
      ...applyWorkspaceMode(
        applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), "history-guided"),
        "canvas",
      ),
      locked: true,
      windowLayout: {
        lesson: customFrame,
      },
    };
    mocks.getWorkspacePreferencesRecord.mockResolvedValueOnce(saved);

    const { result } = renderHook(() =>
      useWorkspacePreferences("user-1", "binder-1", null),
    );

    await waitFor(() => {
      expect(result.current.active?.windowLayout.lesson).toEqual(customFrame);
    });

    act(() => {
      result.current.updateDraft((current) => ({
        ...current,
        locked: false,
        updatedAt: "edit-draft",
      }));
    });

    expect(result.current.active?.locked).toBe(false);
    expect(result.current.active?.preset).toBe("history-guided");
    expect(result.current.active?.windowLayout.lesson).toEqual(customFrame);
    expect(mocks.upsertWorkspacePreferencesRecord).not.toHaveBeenCalled();
  });

  it("cancels edit drafts back to saved frames and saves unlocked drafts when requested", async () => {
    const savedFrame = { x: 64, y: 320, w: 720, h: 520, z: 9 };
    const editedFrame = { x: 80, y: 3400, w: 760, h: 540, z: 10 };
    const saved = {
      ...applyWorkspaceMode(
        applyPreset(createDefaultWorkspacePreferences("user-1", "binder-1"), "history-guided"),
        "canvas",
      ),
      locked: true,
      windowLayout: {
        lesson: savedFrame,
      },
    };
    mocks.getWorkspacePreferencesRecord.mockResolvedValueOnce(saved);
    mocks.upsertWorkspacePreferencesRecord.mockImplementation(async (next) => next);

    const { result } = renderHook(() =>
      useWorkspacePreferences("user-1", "binder-1", null),
    );

    await waitFor(() => {
      expect(result.current.active?.windowLayout.lesson).toEqual(savedFrame);
    });

    act(() => {
      result.current.updateDraft((current) => ({
        ...current,
        locked: false,
        windowLayout: {
          ...current.windowLayout,
          lesson: editedFrame,
        },
      }));
    });

    expect(result.current.active?.windowLayout.lesson).toEqual(editedFrame);

    act(() => {
      result.current.cancel();
    });

    expect(result.current.active?.windowLayout.lesson).toEqual(savedFrame);

    act(() => {
      result.current.updateDraft((current) => ({
        ...current,
        locked: false,
        windowLayout: {
          ...current.windowLayout,
          lesson: editedFrame,
        },
      }));
    });

    expect(result.current.active?.windowLayout.lesson).toEqual(editedFrame);

    act(() => {
      result.current.saveUnlocked();
    });

    expect(result.current.saved?.locked).toBe(false);
    expect(result.current.saved?.windowLayout.lesson).toEqual(editedFrame);
    expect(mocks.upsertWorkspacePreferencesRecord).toHaveBeenCalled();
  });

  it("surfaces workspace preference save failures instead of only logging them", async () => {
    const saved = createDefaultWorkspacePreferences("user-1", "binder-1");
    mocks.getWorkspacePreferencesRecord.mockResolvedValueOnce(saved);
    mocks.upsertWorkspacePreferencesRecord.mockRejectedValueOnce(new Error("RLS rejected"));

    const { result } = renderHook(() =>
      useWorkspacePreferences("user-1", "binder-1", null),
    );

    await waitFor(() => {
      expect(result.current.active).toBeTruthy();
    });

    act(() => {
      result.current.commit({
        ...result.current.active!,
        theme: {
          ...result.current.active!.theme,
          compactMode: !result.current.active!.theme.compactMode,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.saveError).toMatch(/workspace layout could not be saved/i);
    });
  });
});
