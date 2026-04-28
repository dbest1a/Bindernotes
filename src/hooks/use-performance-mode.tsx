import { useCallback, useEffect, useMemo, useState } from "react";
import {
  defaultPerformanceModePreference,
  loadPerformanceModePreference,
  performanceModePreferenceChangeEvent,
  performanceModeStorageKey,
  sanitizePerformanceModePreference,
  savePerformanceModePreference,
  type PerformanceModePreference,
} from "@/lib/performance-mode";

type PerformanceModeChangeEvent = CustomEvent<PerformanceModePreference>;

function hasWindow() {
  return typeof window !== "undefined";
}

function getStorage() {
  return hasWindow() ? window.localStorage : undefined;
}

function getPrefersReducedMotion() {
  return hasWindow() && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function writePerformanceModeAttributes(effectivePerformanceMode: boolean, prefersReducedMotion: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.performanceMode = effectivePerformanceMode ? "on" : "off";
  document.documentElement.dataset.reducedMotion = prefersReducedMotion ? "system" : "none";
}

export function usePerformanceMode() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPrefersReducedMotion);
  const [preference, setPreference] = useState<PerformanceModePreference>(() =>
    loadPerformanceModePreference(getStorage()),
  );
  const effectivePerformanceMode = !preference.enabled || prefersReducedMotion;

  useEffect(() => {
    if (!hasWindow() || !window.matchMedia) {
      return;
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(query.matches);
    query.addEventListener?.("change", handleChange);
    return () => query.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    writePerformanceModeAttributes(effectivePerformanceMode, prefersReducedMotion);
  }, [effectivePerformanceMode, prefersReducedMotion]);

  useEffect(() => {
    if (!hasWindow()) {
      return;
    }

    const handlePreferenceChange = (event: Event) => {
      const detail = (event as PerformanceModeChangeEvent).detail;
      if (detail) {
        setPreference(sanitizePerformanceModePreference(detail));
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== performanceModeStorageKey) {
        return;
      }
      try {
        setPreference(
          event.newValue
            ? sanitizePerformanceModePreference(JSON.parse(event.newValue))
            : defaultPerformanceModePreference,
        );
      } catch {
        setPreference(defaultPerformanceModePreference);
      }
    };

    window.addEventListener(performanceModePreferenceChangeEvent, handlePreferenceChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(performanceModePreferenceChangeEvent, handlePreferenceChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const publish = useCallback((nextPreference: PerformanceModePreference) => {
    savePerformanceModePreference(nextPreference, getStorage());
    if (hasWindow()) {
      window.dispatchEvent(
        new CustomEvent(performanceModePreferenceChangeEvent, { detail: nextPreference }),
      );
    }
  }, []);

  const setEnhancedModeEnabled = useCallback(
    (enabled: boolean) => {
      const nextPreference = sanitizePerformanceModePreference({ enabled });
      setPreference(nextPreference);
      publish(nextPreference);
    },
    [publish],
  );
  const setPerformanceModeEnabled = useCallback(
    (enabled: boolean) => {
      setEnhancedModeEnabled(!enabled);
    },
    [setEnhancedModeEnabled],
  );

  return useMemo(
    () => ({
      effectivePerformanceMode,
      enhancedModeEnabled: preference.enabled,
      performanceModeEnabled: effectivePerformanceMode,
      prefersReducedMotion,
      setEnhancedModeEnabled,
      setPerformanceModeEnabled,
    }),
    [
      effectivePerformanceMode,
      preference.enabled,
      prefersReducedMotion,
      setEnhancedModeEnabled,
      setPerformanceModeEnabled,
    ],
  );
}
