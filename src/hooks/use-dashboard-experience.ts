import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminDashboardPreferenceChangeEvent,
  adminDashboardViewStorageKey,
  defaultAdminDashboardPreference,
  loadAdminDashboardPreference,
  sanitizeAdminDashboardPreference,
  saveAdminDashboardPreference,
  type AdminDashboardPreference,
  type DashboardViewMode,
} from "@/lib/admin-dashboard-preferences";

type AdminDashboardPreferenceEvent = CustomEvent<AdminDashboardPreference>;

function hasWindow() {
  return typeof window !== "undefined";
}

function getStorage() {
  return hasWindow() ? window.localStorage : undefined;
}

function writeRootAttributes(preference: AdminDashboardPreference, isAdmin: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.adminDashboard =
    isAdmin && preference.viewMode === "admin-makeover" ? "makeover" : "normal";
}

export function useDashboardExperience(isAdmin: boolean) {
  const [preference, setPreference] = useState<AdminDashboardPreference>(() =>
    loadAdminDashboardPreference(getStorage()),
  );

  useEffect(() => {
    writeRootAttributes(preference, isAdmin);
  }, [isAdmin, preference]);

  useEffect(() => {
    if (!hasWindow()) {
      return;
    }

    const handlePreferenceChange = (event: Event) => {
      const detail = (event as AdminDashboardPreferenceEvent).detail;
      if (detail) {
        setPreference(sanitizeAdminDashboardPreference(detail));
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== adminDashboardViewStorageKey) {
        return;
      }
      try {
        setPreference(
          event.newValue
            ? sanitizeAdminDashboardPreference(JSON.parse(event.newValue))
            : defaultAdminDashboardPreference,
        );
      } catch {
        setPreference(defaultAdminDashboardPreference);
      }
    };

    window.addEventListener(adminDashboardPreferenceChangeEvent, handlePreferenceChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(adminDashboardPreferenceChangeEvent, handlePreferenceChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const publish = useCallback((nextPreference: AdminDashboardPreference) => {
    saveAdminDashboardPreference(nextPreference, getStorage());
    if (hasWindow()) {
      window.dispatchEvent(
        new CustomEvent(adminDashboardPreferenceChangeEvent, { detail: nextPreference }),
      );
    }
  }, []);

  const setViewMode = useCallback(
    (viewMode: DashboardViewMode) => {
      setPreference((currentPreference) => {
        const nextPreference = sanitizeAdminDashboardPreference({
          ...currentPreference,
          viewMode,
        });
        publish(nextPreference);
        return nextPreference;
      });
    },
    [publish],
  );

  const effectiveViewMode: DashboardViewMode = isAdmin ? preference.viewMode : "normal";

  return useMemo(
    () => ({
      effectiveViewMode,
      isAdminMakeoverActive: effectiveViewMode === "admin-makeover",
      preference,
      setViewMode,
    }),
    [effectiveViewMode, preference, setViewMode],
  );
}
