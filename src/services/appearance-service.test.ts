import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eqSelect: vi.fn(),
  eqUpdate: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import {
  getUserAppearanceSettings,
  saveUserAppearanceSettings,
} from "@/services/appearance-service";

describe("appearance service", () => {
  beforeEach(() => {
    mocks.eqSelect.mockReset();
    mocks.eqUpdate.mockReset();
    mocks.from.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.select.mockReset();
    mocks.update.mockReset();

    mocks.from.mockReturnValue({
      select: mocks.select,
      update: mocks.update,
    });
    mocks.select.mockReturnValue({ eq: mocks.eqSelect });
    mocks.eqSelect.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.update.mockReturnValue({ eq: mocks.eqUpdate });
  });

  it("loads user-level custom palettes from the profile record", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        appearance_settings: {
          id: "custom",
          accentColor: "custom",
          customPalette: {
            primary: "#123456",
            secondary: "#202020",
            accent: "#f59e0b",
            sourceTheme: "space",
          },
        },
      },
      error: null,
    });

    const theme = await getUserAppearanceSettings("user-1");

    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.select).toHaveBeenCalledWith("appearance_settings");
    expect(mocks.eqSelect).toHaveBeenCalledWith("id", "user-1");
    expect(theme?.id).toBe("custom");
    expect(theme?.customPalette?.primary).toBe("#123456");
    expect(theme?.customPalette?.secondary).toBe("#202020");
    expect(theme?.customPalette?.accent).toBe("#f59e0b");
  });

  it("saves the normalized user-level custom palette back to the profile", async () => {
    mocks.eqUpdate.mockResolvedValueOnce({ error: null });

    await saveUserAppearanceSettings("user-1", {
      id: "custom",
      studySurface: "custom",
      accent: "210 65% 20%",
      accentColor: "custom",
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
        primary: "#123456",
        secondary: "#202020",
        accent: "#0d9668",
        sourceTheme: "space",
      },
    });

    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        appearance_settings: expect.objectContaining({
          id: "custom",
          customPalette: expect.objectContaining({
            primary: "#123456",
            secondary: "#202020",
            accent: "#0d9668",
          }),
        }),
      }),
    );
    expect(mocks.eqUpdate).toHaveBeenCalledWith("id", "user-1");
  });
});
