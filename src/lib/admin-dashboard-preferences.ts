export type DashboardViewMode = "normal" | "admin-makeover";

export type AdminDashboardPreference = {
  viewMode: DashboardViewMode;
};

export const adminDashboardViewStorageKey = "binder-notes:admin-dashboard-view";
export const adminDashboardPreferenceChangeEvent = "binder-notes:admin-dashboard-preference";

export const defaultAdminDashboardPreference: AdminDashboardPreference = {
  viewMode: "normal",
};

const viewModes = new Set<DashboardViewMode>(["normal", "admin-makeover"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeAdminDashboardPreference(value: unknown): AdminDashboardPreference {
  if (!isRecord(value)) {
    return defaultAdminDashboardPreference;
  }

  const viewMode =
    typeof value.viewMode === "string" && viewModes.has(value.viewMode as DashboardViewMode)
      ? (value.viewMode as DashboardViewMode)
      : defaultAdminDashboardPreference.viewMode;

  return { viewMode };
}

export function loadAdminDashboardPreference(storage: Storage | undefined): AdminDashboardPreference {
  if (!storage) {
    return defaultAdminDashboardPreference;
  }

  try {
    const raw = storage.getItem(adminDashboardViewStorageKey);
    return raw ? sanitizeAdminDashboardPreference(JSON.parse(raw)) : defaultAdminDashboardPreference;
  } catch {
    return defaultAdminDashboardPreference;
  }
}

export function saveAdminDashboardPreference(
  preference: AdminDashboardPreference,
  storage: Storage | undefined,
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(adminDashboardViewStorageKey, JSON.stringify(sanitizeAdminDashboardPreference(preference)));
  } catch {
    // Cosmetic admin preferences should never block the app.
  }
}
