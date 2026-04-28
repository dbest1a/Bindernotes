import type { Profile } from "@/types";

export type TutorialPromptPreference = {
  promptsEnabled: boolean;
};

export const tutorialPromptPreferenceChangeEvent = "bindernotes:tutorial-prompts:v1:change";
export const tutorialPromptPreferenceRecentSignupDays = 14;

export function tutorialPromptPreferenceStorageKey(profileId: string) {
  return `bindernotes:tutorial-prompts:v1:${profileId}`;
}

export function isRecentTutorialSignup(createdAt: string | null | undefined, now = new Date()) {
  if (!createdAt) {
    return false;
  }

  const createdTime = new Date(createdAt).getTime();
  const nowTime = now.getTime();

  if (!Number.isFinite(createdTime) || createdTime > nowTime) {
    return false;
  }

  const ageMs = nowTime - createdTime;
  return ageMs <= tutorialPromptPreferenceRecentSignupDays * 24 * 60 * 60 * 1000;
}

export function defaultTutorialPromptPreference(profile: Pick<Profile, "created_at"> | null | undefined) {
  return {
    promptsEnabled: isRecentTutorialSignup(profile?.created_at),
  };
}

export function loadTutorialPromptPreference(
  profile: Pick<Profile, "id" | "created_at"> | null | undefined,
  storage = getTutorialPreferenceStorage(),
): TutorialPromptPreference {
  if (!profile?.id || !storage) {
    return defaultTutorialPromptPreference(profile);
  }

  try {
    const rawValue = storage.getItem(tutorialPromptPreferenceStorageKey(profile.id));
    if (!rawValue) {
      return defaultTutorialPromptPreference(profile);
    }

    const parsed = JSON.parse(rawValue) as Partial<TutorialPromptPreference>;
    return {
      promptsEnabled:
        typeof parsed.promptsEnabled === "boolean"
          ? parsed.promptsEnabled
          : defaultTutorialPromptPreference(profile).promptsEnabled,
    };
  } catch {
    return defaultTutorialPromptPreference(profile);
  }
}

export function saveTutorialPromptPreference(
  profileId: string,
  preference: TutorialPromptPreference,
  storage = getTutorialPreferenceStorage(),
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(tutorialPromptPreferenceStorageKey(profileId), JSON.stringify(preference));
  } catch {
    // Storage can be unavailable in private or restricted browser modes.
  }
}

function getTutorialPreferenceStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
