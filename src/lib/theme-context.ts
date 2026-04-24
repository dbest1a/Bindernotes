import { createContext } from "react";
import type {
  AppearanceCustomPalette,
  WorkspaceThemeId,
  WorkspaceThemeSettings,
} from "@/types";

export type ThemeContextValue = {
  theme: WorkspaceThemeSettings;
  setTheme: (theme: WorkspaceThemeSettings) => void;
  setThemeId: (themeId: WorkspaceThemeId) => void;
  setCustomPalette: (palette: AppearanceCustomPalette) => void;
  toggleMonochrome: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
