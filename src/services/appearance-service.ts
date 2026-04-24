import { supabase } from "@/lib/supabase";
import { normalizeThemeSettings } from "@/lib/workspace-preferences";
import type { WorkspaceThemeSettings } from "@/types";

type AppearanceProfileRecord = {
  appearance_settings: Partial<WorkspaceThemeSettings> | null;
};

function isMissingAppearanceColumn(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.message?.toLowerCase().includes("appearance_settings") === true
  );
}

export async function getUserAppearanceSettings(
  userId: string,
): Promise<WorkspaceThemeSettings | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("appearance_settings")
    .eq("id", userId)
    .maybeSingle<AppearanceProfileRecord>();

  if (error) {
    if (isMissingAppearanceColumn(error)) {
      return null;
    }

    throw error;
  }

  return data?.appearance_settings
    ? normalizeThemeSettings(data.appearance_settings)
    : null;
}

export async function saveUserAppearanceSettings(
  userId: string,
  theme: WorkspaceThemeSettings,
) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      appearance_settings: normalizeThemeSettings(theme),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error && !isMissingAppearanceColumn(error)) {
    throw error;
  }
}
