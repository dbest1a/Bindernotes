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
  const [theme, setThemeState] = useState<WorkspaceThemeSettings>(() => {
    if (typeof window === "undefined") {
      return defaultThemeSettings;
    }

    return loadGlobalThemeSettings();
  });

  useEffect(() => {
    applyThemeSettings(theme);
    saveGlobalThemeSettings(theme);
  }, [theme]);

  const setThemeId = useCallback((themeId: WorkspaceThemeId) => {
    const nextTheme =
      workspaceThemes.find((candidate) => candidate.id === themeId) ??
      workspaceThemes.find((candidate) => candidate.id === defaultThemeSettings.id);

    setThemeState((current) => ({
      ...current,
      id: themeId,
      accent: nextTheme?.vars.primary ?? current.accent,
    }));
    notifyAppearanceChange({ id: themeId });
  }, []);

  const toggleMonochrome = useCallback(() => {
    const nextId: WorkspaceThemeId = theme.id === "monochrome-pro" ? "space" : "monochrome-pro";
    setThemeState((current) => ({
      ...current,
      id: nextId,
      accent:
        nextId === "space"
          ? workspaceThemes.find((candidate) => candidate.id === "space")?.vars.primary ??
            current.accent
          : "0 0% 12%",
    }));
    notifyAppearanceChange({ id: nextId });
  }, [theme.id]);

  const setCustomPalette = useCallback((palette: AppearanceCustomPalette) => {
    const customPalette = {
      ...defaultCustomPalette,
      ...palette,
    };

    setThemeState((current) => ({
      ...current,
      id: "custom",
      customPalette,
    }));
    notifyAppearanceChange({ id: "custom", customPalette });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      setThemeId,
      setCustomPalette,
      toggleMonochrome,
    }),
    [setCustomPalette, setThemeId, theme, toggleMonochrome],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
