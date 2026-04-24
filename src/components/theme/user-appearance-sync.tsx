import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import {
  getUserAppearanceSettings,
  saveUserAppearanceSettings,
} from "@/services/appearance-service";

export function UserAppearanceSync() {
  const { user } = useAuth();
  const { globalTheme, setGlobalTheme } = useTheme();
  const loadedUserRef = useRef<string | null>(null);
  const skipNextSaveRef = useRef(false);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) {
      loadedUserRef.current = null;
      skipNextSaveRef.current = false;
      return;
    }

    let cancelled = false;
    loadedUserRef.current = null;

    void getUserAppearanceSettings(userId)
      .then((savedTheme) => {
        if (cancelled) {
          return;
        }

        loadedUserRef.current = userId;
        if (savedTheme) {
          skipNextSaveRef.current = true;
          setGlobalTheme(savedTheme);
        }
      })
      .catch((error) => {
        console.error("Failed to load saved appearance settings.", error);
        if (!cancelled) {
          loadedUserRef.current = userId;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setGlobalTheme, user?.id]);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId || loadedUserRef.current !== userId) {
      return;
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const handle = window.setTimeout(() => {
      void saveUserAppearanceSettings(userId, globalTheme).catch((error) => {
        console.error("Failed to save appearance settings.", error);
      });
    }, 400);

    return () => window.clearTimeout(handle);
  }, [globalTheme, user?.id]);

  return null;
}
