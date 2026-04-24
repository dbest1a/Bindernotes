import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyThemeSettings,
  createCustomThemeFromAccent,
  createThemeFromAppTheme,
  defaultCustomPalette,
  defaultThemeSettings,
  loadGlobalThemeSettings,
  saveGlobalThemeSettings,
} from "@/lib/workspace-preferences";
import { ThemeContext, type ThemeContextValue } from "@/lib/theme-context";
import type {
  AccentColor,
  AppearanceCustomPalette,
  WorkspaceThemeId,
  WorkspaceThemeSettings,
} from "@/types";

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
    setThemeOverride(null);
    setGlobalThemeState((current) => createThemeFromAppTheme(current, themeId));
    notifyAppearanceChange({ id: themeId });
  }, []);

  const setAccentColor = useCallback((accentColor: AccentColor) => {
    setThemeOverride(null);
    setGlobalThemeState((current) => {
      const nextTheme = createCustomThemeFromAccent(current, accentColor);
      notifyAppearanceChange({
        id: nextTheme.id,
        customPalette: nextTheme.customPalette,
      });
      return nextTheme;
    });
  }, []);

  const toggleMonochrome = useCallback(() => {
    const nextId: WorkspaceThemeId =
      globalTheme.id === "monochrome-pro" ? "space" : "monochrome-pro";
    setThemeOverride(null);
    setGlobalThemeState((current) => createThemeFromAppTheme(current, nextId));
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
      accentColor: "custom",
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
      setAccentColor,
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
      setAccentColor,
      theme,
      toggleMonochrome,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
