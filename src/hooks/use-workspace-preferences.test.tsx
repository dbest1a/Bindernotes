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

describe("useWorkspacePreferences", () => {
  beforeEach(() => {
    mocks.clearThemeOverride.mockReset();
    mocks.getWorkspacePreferencesRecord.mockReset();
    mocks.setTheme.mockReset();
    mocks.upsertWorkspacePreferencesRecord.mockReset();
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
