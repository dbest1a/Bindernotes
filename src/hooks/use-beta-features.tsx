import { useCallback, useEffect, useMemo, useState } from "react";
import {
  betaFeatureFlagDefinitions,
  betaFeaturesPreferenceChangeEvent,
  betaFeaturesStorageKeyForUser,
  defaultBetaFeaturesPreference,
  isBetaFeatureFlagActive,
  isRevampBetaEnabled,
  loadBetaFeaturesPreference,
  sanitizeBetaFeaturesPreference,
  saveBetaFeaturesPreference,
  type BetaFeatureFlagKey,
  type BetaFeaturesPreference,
} from "@/lib/beta-features";

type BetaFeaturesChangeEvent = CustomEvent<{
  preference: BetaFeaturesPreference;
  userId?: string | null;
}>;

function hasWindow() {
  return typeof window !== "undefined";
}

function getStorage() {
  return hasWindow() ? window.localStorage : undefined;
}

function writeBetaFeatureAttributes(preference: BetaFeaturesPreference) {
  if (typeof document === "undefined") {
    return;
  }

  const revampBetaEnabled = isRevampBetaEnabled(preference);
  document.documentElement.dataset.betaFeatures = revampBetaEnabled ? "on" : "off";
  document.documentElement.dataset.revampBeta = revampBetaEnabled ? "true" : "false";
  for (const flag of betaFeatureFlagDefinitions) {
    document.documentElement.setAttribute(
      flag.dataAttribute,
      isBetaFeatureFlagActive(preference, flag.key) ? "true" : "false",
    );
  }
}

export function useBetaFeatures(userId: string | null | undefined) {
  const [preference, setPreference] = useState<BetaFeaturesPreference>(() =>
    loadBetaFeaturesPreference(userId, getStorage()),
  );

  useEffect(() => {
    const next = loadBetaFeaturesPreference(userId, getStorage());
    setPreference(next);
    writeBetaFeatureAttributes(next);
  }, [userId]);

  useEffect(() => {
    writeBetaFeatureAttributes(preference);
  }, [preference]);

  useEffect(() => {
    if (!hasWindow()) {
      return;
    }

    const handlePreferenceChange = (event: Event) => {
      const detail = (event as BetaFeaturesChangeEvent).detail;
      if (!detail || detail.userId !== userId) {
        return;
      }
      setPreference(sanitizeBetaFeaturesPreference(detail.preference));
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== betaFeaturesStorageKeyForUser(userId)) {
        return;
      }

      try {
        setPreference(
          event.newValue
            ? sanitizeBetaFeaturesPreference(JSON.parse(event.newValue))
            : defaultBetaFeaturesPreference,
        );
      } catch {
        setPreference(defaultBetaFeaturesPreference);
      }
    };

    window.addEventListener(betaFeaturesPreferenceChangeEvent, handlePreferenceChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(betaFeaturesPreferenceChangeEvent, handlePreferenceChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [userId]);

  const setBetaFeaturesEnabled = useCallback(
    (enabled: boolean) => {
      const nextPreference = sanitizeBetaFeaturesPreference({ ...preference, enabled, revampBeta: enabled });
      setPreference(nextPreference);
      saveBetaFeaturesPreference(userId, nextPreference, getStorage());
      if (hasWindow()) {
        window.dispatchEvent(
          new CustomEvent(betaFeaturesPreferenceChangeEvent, {
            detail: { preference: nextPreference, userId },
          }),
        );
      }
    },
    [preference, userId],
  );

  const setBetaFeatureFlag = useCallback(
    (flag: BetaFeatureFlagKey, enabled: boolean) => {
      const nextPreference = sanitizeBetaFeaturesPreference({
        ...preference,
        enabled: enabled ? true : preference.enabled,
        revampBeta: enabled,
        [flag]: enabled,
      });
      setPreference(nextPreference);
      saveBetaFeaturesPreference(userId, nextPreference, getStorage());
      if (hasWindow()) {
        window.dispatchEvent(
          new CustomEvent(betaFeaturesPreferenceChangeEvent, {
            detail: { preference: nextPreference, userId },
          }),
        );
      }
    },
    [preference, userId],
  );

  const dataAttributes = useMemo(
    () =>
      Object.fromEntries(
        betaFeatureFlagDefinitions.map((flag) => [
          flag.dataAttribute,
          isBetaFeatureFlagActive(preference, flag.key) ? "true" : "false",
        ]),
      ) as Record<`data-${string}`, "true" | "false">,
    [preference],
  );

  const featureFlags = useMemo(
    () =>
      Object.fromEntries(
        betaFeatureFlagDefinitions.map((flag) => [flag.key, preference[flag.key]]),
      ) as Record<BetaFeatureFlagKey, boolean>,
    [preference],
  );

  return useMemo(
    () => ({
      betaFeaturesEnabled: isRevampBetaEnabled(preference),
      dataAttributes,
      featureFlags,
      isFeatureEnabled: (flag: BetaFeatureFlagKey) => isBetaFeatureFlagActive(preference, flag),
      preference,
      revampBetaEnabled: isRevampBetaEnabled(preference),
      setBetaFeatureFlag,
      setBetaFeaturesEnabled,
    }),
    [dataAttributes, featureFlags, preference, setBetaFeatureFlag, setBetaFeaturesEnabled],
  );
}

export function useRevampBeta(userId: string | null | undefined) {
  return useBetaFeatures(userId).revampBetaEnabled;
}
