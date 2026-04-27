import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  adminMotionStorageKey,
  defaultAdminMotionSettings,
  loadAdminMotionSettings,
  sanitizeAdminMotionSettings,
  saveAdminMotionSettings,
  type AdminMotionSettings,
} from "@/lib/admin-motion";

const adminMotionChangeEvent = "bindernotes:admin-motion-settings";

type AdminMotionChangeEvent = CustomEvent<AdminMotionSettings>;

function hasWindow() {
  return typeof window !== "undefined";
}

function getStorage() {
  return hasWindow() ? window.localStorage : undefined;
}

function getPrefersReducedMotion() {
  return hasWindow() && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function writeRootAttributes(settings: AdminMotionSettings, isAdmin: boolean, prefersReducedMotion: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const enabled = isAdmin && settings.enabled;
  root.dataset.adminMotion = enabled ? "on" : "off";
  root.dataset.reducedMotion = prefersReducedMotion ? "system" : "none";
  root.dataset.motionIntensity = settings.intensity;
  root.dataset.motionSpeed = settings.speed;
  root.dataset.premiumColorMode = enabled ? settings.colorMode : "off";
  root.dataset.pageTransition = enabled ? settings.pageTransition : "off";
}

export function useAdminMotionSettings(isAdmin: boolean) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPrefersReducedMotion);
  const [settings, setSettings] = useState<AdminMotionSettings>(() => loadAdminMotionSettings(getStorage()));

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
    writeRootAttributes(settings, isAdmin, prefersReducedMotion);
  }, [isAdmin, prefersReducedMotion, settings]);

  useEffect(() => {
    if (!hasWindow()) {
      return;
    }

    const handleSettingsChange = (event: Event) => {
      const detail = (event as AdminMotionChangeEvent).detail;
      if (detail) {
        setSettings(sanitizeAdminMotionSettings(detail));
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== adminMotionStorageKey) {
        return;
      }
      try {
        setSettings(event.newValue ? sanitizeAdminMotionSettings(JSON.parse(event.newValue)) : defaultAdminMotionSettings);
      } catch {
        setSettings(defaultAdminMotionSettings);
      }
    };

    window.addEventListener(adminMotionChangeEvent, handleSettingsChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(adminMotionChangeEvent, handleSettingsChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const publish = useCallback((nextSettings: AdminMotionSettings) => {
    saveAdminMotionSettings(nextSettings, getStorage());
    if (hasWindow()) {
      window.dispatchEvent(new CustomEvent(adminMotionChangeEvent, { detail: nextSettings }));
    }
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AdminMotionSettings>) => {
      setSettings((currentSettings) => {
        const nextSettings = sanitizeAdminMotionSettings({
          ...currentSettings,
          ...patch,
        });
        publish(nextSettings);
        return nextSettings;
      });
    },
    [publish],
  );

  const resetSettings = useCallback(() => {
    setSettings(defaultAdminMotionSettings);
    publish(defaultAdminMotionSettings);
  }, [publish]);

  return useMemo(
    () => ({
      prefersReducedMotion,
      resetSettings,
      settings,
      updateSettings,
    }),
    [prefersReducedMotion, resetSettings, settings, updateSettings],
  );
}

export function AdminMotionRootSync() {
  const { profile } = useAuth();
  useAdminMotionSettings(profile?.role === "admin");
  return null;
}
