export type PerformanceModePreference = {
  enabled: boolean;
};

export const performanceModeStorageKey = "bindernotes:performance-mode:v1";
export const performanceModePreferenceChangeEvent = "bindernotes:performance-mode";

export const defaultPerformanceModePreference: PerformanceModePreference = {
  enabled: true,
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizePerformanceModePreference(value: unknown): PerformanceModePreference {
  if (!isRecord(value)) {
    return defaultPerformanceModePreference;
  }

  return {
    enabled: value.enabled === true,
  };
}

export function loadPerformanceModePreference(storage: StorageLike | undefined): PerformanceModePreference {
  if (!storage) {
    return defaultPerformanceModePreference;
  }

  try {
    const raw = storage.getItem(performanceModeStorageKey);
    return raw ? sanitizePerformanceModePreference(JSON.parse(raw)) : defaultPerformanceModePreference;
  } catch {
    return defaultPerformanceModePreference;
  }
}

export function savePerformanceModePreference(
  preference: PerformanceModePreference,
  storage: StorageLike | undefined,
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(performanceModeStorageKey, JSON.stringify(sanitizePerformanceModePreference(preference)));
  } catch {
    // Performance Mode is a cosmetic preference; unavailable storage should not block the app.
  }
}
