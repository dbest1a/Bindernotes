import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadTutorialPromptPreference,
  saveTutorialPromptPreference,
  tutorialPromptPreferenceChangeEvent,
  tutorialPromptPreferenceStorageKey,
  type TutorialPromptPreference,
} from "@/lib/tutorials/tutorial-preferences";
import type { Profile } from "@/types";

type TutorialPromptPreferenceEvent = CustomEvent<TutorialPromptPreference>;

function hasWindow() {
  return typeof window !== "undefined";
}

function getStorage() {
  return hasWindow() ? window.localStorage : undefined;
}

export function useTutorialPrompts(profile: Pick<Profile, "id" | "created_at"> | null | undefined) {
  const [preference, setPreference] = useState<TutorialPromptPreference>(() =>
    loadTutorialPromptPreference(profile, getStorage()),
  );

  useEffect(() => {
    setPreference(loadTutorialPromptPreference(profile, getStorage()));
  }, [profile?.created_at, profile?.id]);

  useEffect(() => {
    if (!hasWindow() || !profile?.id) {
      return;
    }

    const handlePreferenceChange = (event: Event) => {
      const detail = (event as TutorialPromptPreferenceEvent).detail;
      if (detail) {
        setPreference(detail);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== tutorialPromptPreferenceStorageKey(profile.id)) {
        return;
      }
      setPreference(loadTutorialPromptPreference(profile, getStorage()));
    };

    window.addEventListener(tutorialPromptPreferenceChangeEvent, handlePreferenceChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(tutorialPromptPreferenceChangeEvent, handlePreferenceChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [profile]);

  const setPromptsEnabled = useCallback(
    (promptsEnabled: boolean) => {
      if (!profile?.id) {
        return;
      }

      const nextPreference = { promptsEnabled };
      saveTutorialPromptPreference(profile.id, nextPreference, getStorage());
      setPreference(nextPreference);
      if (hasWindow()) {
        window.dispatchEvent(
          new CustomEvent(tutorialPromptPreferenceChangeEvent, { detail: nextPreference }),
        );
      }
    },
    [profile?.id],
  );

  return useMemo(
    () => ({
      promptsEnabled: preference.promptsEnabled,
      setPromptsEnabled,
    }),
    [preference.promptsEnabled, setPromptsEnabled],
  );
}
