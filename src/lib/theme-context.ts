import { createContext } from "react";
import type {
  AppearanceCustomPalette,
  WorkspaceThemeId,
  WorkspaceThemeSettings,
} from "@/types";

export type ThemeContextValue = {
  theme: WorkspaceThemeSettings;
  globalTheme: WorkspaceThemeSettings;
  setTheme: (theme: WorkspaceThemeSettings) => void;
  setGlobalTheme: (theme: WorkspaceThemeSettings) => void;
  clearThemeOverride: () => void;
  setThemeId: (themeId: WorkspaceThemeId) => void;
  setCustomPalette: (palette: AppearanceCustomPalette) => void;
  toggleMonochrome: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
