import { useCallback, useEffect, useState } from "react";

export type DashboardWorkspaceScope = "all" | "folders" | "binders" | "documents";
export type DashboardWorkspaceDensity = "comfortable" | "compact";
export type DashboardWorkspaceSort = "custom" | "name" | "documents";
export type DashboardWorkspaceWidth = "focused" | "full";

export type DashboardWorkspaceViewPreference = {
  density: DashboardWorkspaceDensity;
  scope: DashboardWorkspaceScope;
  showRecentDocuments: boolean;
  sort: DashboardWorkspaceSort;
  width: DashboardWorkspaceWidth;
};

export const dashboardWorkspaceScopeLabels: Record<DashboardWorkspaceScope, string> = {
  all: "All files",
  binders: "Binders",
  documents: "Recent documents",
  folders: "Folders",
};

export const defaultDashboardWorkspaceViewPreference: DashboardWorkspaceViewPreference = {
  density: "comfortable",
  scope: "all",
  showRecentDocuments: true,
  sort: "custom",
  width: "focused",
};

export function getDashboardWorkspaceViewStorageKey(profileId: string) {
  return `binder-notes:dashboard-workspace-view:${profileId}`;
}

export function getAdminDashboardWidthStorageKey(profileId: string) {
  return `binder-notes:admin-dashboard-width:${profileId}`;
}

export function sanitizeDashboardWorkspaceWidth(value: unknown): DashboardWorkspaceWidth | null {
  return value === "focused" || value === "full" ? value : null;
}

export function loadAdminDashboardWidthPreference(profileId: string): DashboardWorkspaceWidth | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return sanitizeDashboardWorkspaceWidth(
      window.localStorage.getItem(getAdminDashboardWidthStorageKey(profileId)),
    );
  } catch {
    return null;
  }
}

export function saveAdminDashboardWidthPreference(
  profileId: string,
  width: DashboardWorkspaceWidth,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getAdminDashboardWidthStorageKey(profileId), width);
}

export function sanitizeDashboardWorkspaceViewPreference(
  value: Partial<DashboardWorkspaceViewPreference> | null | undefined,
): DashboardWorkspaceViewPreference {
  return {
    density: value?.density === "compact" ? "compact" : "comfortable",
    scope:
      value?.scope === "folders" ||
      value?.scope === "binders" ||
      value?.scope === "documents"
        ? value.scope
        : "all",
    showRecentDocuments: value?.showRecentDocuments === false ? false : true,
    sort: value?.sort === "name" || value?.sort === "documents" ? value.sort : "custom",
    width: value?.width === "full" ? "full" : "focused",
  };
}

export function loadDashboardWorkspaceViewPreference(profileId: string): DashboardWorkspaceViewPreference {
  if (typeof window === "undefined") {
    return defaultDashboardWorkspaceViewPreference;
  }

  try {
    const stored = window.localStorage.getItem(getDashboardWorkspaceViewStorageKey(profileId));
    return stored
      ? sanitizeDashboardWorkspaceViewPreference(JSON.parse(stored))
      : defaultDashboardWorkspaceViewPreference;
  } catch {
    return defaultDashboardWorkspaceViewPreference;
  }
}

export function saveDashboardWorkspaceViewPreference(
  profileId: string,
  preference: DashboardWorkspaceViewPreference,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getDashboardWorkspaceViewStorageKey(profileId),
    JSON.stringify(preference),
  );
}

export function useDashboardWorkspaceViewPreference(profileId: string) {
  const [preference, setPreference] = useState<DashboardWorkspaceViewPreference>(() =>
    loadDashboardWorkspaceViewPreference(profileId),
  );

  useEffect(() => {
    setPreference(loadDashboardWorkspaceViewPreference(profileId));
  }, [profileId]);

  const updatePreference = useCallback(
    (patch: Partial<DashboardWorkspaceViewPreference>) => {
      setPreference((currentPreference) => {
        const nextPreference = sanitizeDashboardWorkspaceViewPreference({
          ...currentPreference,
          ...patch,
        });
        saveDashboardWorkspaceViewPreference(profileId, nextPreference);
        return nextPreference;
      });
    },
    [profileId],
  );

  return [preference, updatePreference] as const;
}
