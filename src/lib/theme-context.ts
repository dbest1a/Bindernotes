import { createContext } from "react";
import type { WorkspaceThemeId, WorkspaceThemeSettings } from "@/types";

export type ThemeContextValue = {
  theme: WorkspaceThemeSettings;
  setTheme: (theme: WorkspaceThemeSettings) => void;
  setThemeId: (themeId: WorkspaceThemeId) => void;
  toggleMonochrome: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
