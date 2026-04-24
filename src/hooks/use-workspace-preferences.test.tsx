// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
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
import { createDefaultWorkspacePreferences } from "@/lib/workspace-preferences";

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

    expect(result.current.active?.appearance.studySurface).toBe("night-study");
    expect(result.current.active?.theme.studySurface).toBe("night-study");
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
});
