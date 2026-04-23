import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyThemeSettings,
  defaultThemeSettings,
  loadGlobalThemeSettings,
  saveGlobalThemeSettings,
  workspaceThemes,
} from "@/lib/workspace-preferences";
import { ThemeContext, type ThemeContextValue } from "@/lib/theme-context";
import type { WorkspaceThemeId, WorkspaceThemeSettings } from "@/types";

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
  }, []);

  const toggleMonochrome = useCallback(() => {
    setThemeState((current) => ({
      ...current,
      id: current.id === "monochrome-pro" ? "space" : "monochrome-pro",
      accent:
        current.id === "monochrome-pro"
          ? workspaceThemes.find((candidate) => candidate.id === "space")?.vars.primary ??
            current.accent
          : "0 0% 12%",
    }));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      setThemeId,
      toggleMonochrome,
    }),
    [setThemeId, theme, toggleMonochrome],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
