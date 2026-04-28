export type AdminMotionIntensity = "subtle" | "full" | "party";
export type AdminMotionSpeed = "quick" | "normal" | "slow";
export type PremiumColorMode = "off" | "soft-glow" | "gradient" | "neon-lab";
export type PageTransitionStyle = "off" | "soft-land" | "slide-pop" | "drop-in";

export type AdminMotionSettings = {
  enabled: boolean;
  intensity: AdminMotionIntensity;
  speed: AdminMotionSpeed;
  colorMode: PremiumColorMode;
  pageTransition: PageTransitionStyle;
};

export const adminMotionStorageKey = "binder-notes:admin-motion-settings";
const legacyAdminMotionStorageKey = "bindernotes:admin-motion:v1";

export const defaultAdminMotionSettings: AdminMotionSettings = {
  enabled: false,
  intensity: "subtle",
  speed: "normal",
  colorMode: "soft-glow",
  pageTransition: "soft-land",
};

const intensities = new Set<AdminMotionIntensity>(["subtle", "full", "party"]);
const speeds = new Set<AdminMotionSpeed>(["quick", "normal", "slow"]);
const colorModes = new Set<PremiumColorMode>(["off", "soft-glow", "gradient", "neon-lab"]);
const pageTransitions = new Set<PageTransitionStyle>(["off", "soft-land", "slide-pop", "drop-in"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeAdminMotionSettings(value: unknown): AdminMotionSettings {
  if (!isRecord(value)) {
    return defaultAdminMotionSettings;
  }

  const intensity = typeof value.intensity === "string" && intensities.has(value.intensity as AdminMotionIntensity)
    ? (value.intensity as AdminMotionIntensity)
    : defaultAdminMotionSettings.intensity;
  const speed = typeof value.speed === "string" && speeds.has(value.speed as AdminMotionSpeed)
    ? (value.speed as AdminMotionSpeed)
    : defaultAdminMotionSettings.speed;
  const colorMode =
    typeof value.colorMode === "string" && colorModes.has(value.colorMode as PremiumColorMode)
      ? (value.colorMode as PremiumColorMode)
      : defaultAdminMotionSettings.colorMode;
  const pageTransition =
    typeof value.pageTransition === "string" && pageTransitions.has(value.pageTransition as PageTransitionStyle)
      ? (value.pageTransition as PageTransitionStyle)
      : defaultAdminMotionSettings.pageTransition;

  return {
    enabled: value.enabled === true,
    intensity,
    speed,
    colorMode,
    pageTransition,
  };
}

export function loadAdminMotionSettings(storage: Storage | undefined): AdminMotionSettings {
  if (!storage) {
    return defaultAdminMotionSettings;
  }

  try {
    const raw = storage.getItem(adminMotionStorageKey) ?? storage.getItem(legacyAdminMotionStorageKey);
    return raw ? sanitizeAdminMotionSettings(JSON.parse(raw)) : defaultAdminMotionSettings;
  } catch {
    return defaultAdminMotionSettings;
  }
}

export function saveAdminMotionSettings(settings: AdminMotionSettings, storage: Storage | undefined) {
  if (!storage) {
    return;
  }

  try {
    const serialized = JSON.stringify(settings);
    storage.setItem(adminMotionStorageKey, serialized);
    storage.setItem(legacyAdminMotionStorageKey, serialized);
  } catch {
    // Cosmetic settings should never break the app if storage is unavailable.
  }
}
