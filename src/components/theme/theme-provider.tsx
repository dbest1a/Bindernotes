import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyThemeSettings,
  defaultCustomPalette,
  defaultThemeSettings,
  loadGlobalThemeSettings,
  saveGlobalThemeSettings,
  workspaceThemes,
} from "@/lib/workspace-preferences";
import { ThemeContext, type ThemeContextValue } from "@/lib/theme-context";
import type { AppearanceCustomPalette, WorkspaceThemeId, WorkspaceThemeSettings } from "@/types";

const appearanceChangeEvent = "binder-notes:appearance-change";

function notifyAppearanceChange(detail: Partial<Pick<WorkspaceThemeSettings, "id" | "customPalette">>) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(appearanceChangeEvent, {
      detail: {
        appTheme: detail.id,
        customPalette: detail.customPalette,
      },
    }),
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [globalTheme, setGlobalThemeState] = useState<WorkspaceThemeSettings>(() => {
    if (typeof window === "undefined") {
      return defaultThemeSettings;
    }

    return loadGlobalThemeSettings();
  });
  const [themeOverride, setThemeOverride] = useState<WorkspaceThemeSettings | null>(null);
  const theme = themeOverride ?? globalTheme;

  useEffect(() => {
    applyThemeSettings(theme);
  }, [theme]);

  useEffect(() => {
    saveGlobalThemeSettings(globalTheme);
  }, [globalTheme]);

  const setGlobalTheme = useCallback((nextTheme: WorkspaceThemeSettings) => {
    setThemeOverride(null);
    setGlobalThemeState(nextTheme);
    notifyAppearanceChange({
      id: nextTheme.id,
      customPalette: nextTheme.customPalette,
    });
  }, []);

  const clearThemeOverride = useCallback(() => {
    setThemeOverride(null);
  }, []);

  const setTheme = useCallback((nextTheme: WorkspaceThemeSettings) => {
    setThemeOverride(nextTheme);
  }, []);

  const setThemeId = useCallback((themeId: WorkspaceThemeId) => {
    const nextTheme =
      workspaceThemes.find((candidate) => candidate.id === themeId) ??
      workspaceThemes.find((candidate) => candidate.id === defaultThemeSettings.id);

    setThemeOverride(null);
    setGlobalThemeState((current) => ({
      ...current,
      id: themeId,
      accent: nextTheme?.vars.primary ?? current.accent,
    }));
    notifyAppearanceChange({ id: themeId });
  }, []);

  const toggleMonochrome = useCallback(() => {
    const nextId: WorkspaceThemeId =
      globalTheme.id === "monochrome-pro" ? "space" : "monochrome-pro";
    setThemeOverride(null);
    setGlobalThemeState((current) => ({
      ...current,
      id: nextId,
      accent:
        nextId === "space"
          ? workspaceThemes.find((candidate) => candidate.id === "space")?.vars.primary ??
            current.accent
          : "0 0% 12%",
    }));
    notifyAppearanceChange({ id: nextId });
  }, [globalTheme.id]);

  const setCustomPalette = useCallback((palette: AppearanceCustomPalette) => {
    const customPalette = {
      ...defaultCustomPalette,
      ...palette,
    };

    setThemeOverride(null);
    setGlobalThemeState((current) => ({
      ...current,
      id: "custom",
      customPalette,
    }));
    notifyAppearanceChange({ id: "custom", customPalette });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      clearThemeOverride,
      globalTheme,
      theme,
      setGlobalTheme,
      setTheme,
      setThemeId,
      setCustomPalette,
      toggleMonochrome,
    }),
    [
      clearThemeOverride,
      globalTheme,
      setCustomPalette,
      setGlobalTheme,
      setTheme,
      setThemeId,
      theme,
      toggleMonochrome,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
