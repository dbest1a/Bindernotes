import { useCallback, useEffect, useState } from "react";
import {
  createDefaultWorkspacePreferences,
  normalizeWorkspacePreferences,
} from "@/lib/workspace-preferences";
import { useTheme } from "@/hooks/use-theme";
import {
  getWorkspacePreferencesRecord,
  upsertWorkspacePreferencesRecord,
} from "@/services/binder-service";
import type { WorkspacePreferences } from "@/types";

function normalizeLoadedWorkspacePreferences(
  preferences: WorkspacePreferences,
  userId: string,
  binderId: string,
  suiteTemplateId?: string | null,
) {
  return normalizeWorkspacePreferences({
    ...createDefaultWorkspacePreferences(userId, binderId, suiteTemplateId),
    ...preferences,
    userId,
    binderId,
  });
}

export function useWorkspacePreferences(
  userId: string | undefined,
  binderId: string | undefined,
  suiteTemplateId?: string | null,
) {
  const [saved, setSaved] = useState<WorkspacePreferences | null>(null);
  const [draft, setDraft] = useState<WorkspacePreferences | null>(null);
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!userId || !binderId) {
      setSaved(null);
      setDraft(null);
      return;
    }

    let cancelled = false;
    setSaved(null);
    setDraft(null);

    void getWorkspacePreferencesRecord(userId, binderId)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        const normalized = normalizeLoadedWorkspacePreferences(loaded, userId, binderId, suiteTemplateId);
        setSaved(normalized);
        setDraft(normalized);
      })
      .catch((error) => {
        console.error("Failed to load workspace preferences.", error);
        if (cancelled) {
          return;
        }
        const fallback = createDefaultWorkspacePreferences(userId, binderId, suiteTemplateId);
        setSaved(fallback);
        setDraft(fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [binderId, suiteTemplateId, userId]);

  useEffect(() => {
    const active = draft ?? saved;
    if (active) {
      setTheme(active.theme);
    }
  }, [draft, saved, setTheme]);

  const updateDraft = (updater: (current: WorkspacePreferences) => WorkspacePreferences) => {
    setDraft((current) => {
      const base =
        current ??
        (userId && binderId
          ? createDefaultWorkspacePreferences(userId, binderId, suiteTemplateId)
          : null);
      return base && userId && binderId
        ? normalizeLoadedWorkspacePreferences(updater(base), userId, binderId, suiteTemplateId)
        : base;
    });
  };

  const persist = useCallback((next: WorkspacePreferences) => {
    void upsertWorkspacePreferencesRecord(next)
      .then((persisted) => {
        setSaved(persisted);
        setDraft((current) => (current?.updatedAt === next.updatedAt ? persisted : current));
      })
      .catch((error) => {
        console.error("Failed to save workspace preferences.", error);
      });
  }, []);

  const save = () => {
    if (!draft) {
      return null;
    }
    const next = normalizeLoadedWorkspacePreferences(
      { ...draft, locked: true, updatedAt: new Date().toISOString() },
      draft.userId,
      draft.binderId,
      draft.suiteTemplateId,
    );
    setSaved(next);
    setDraft(next);
    persist(next);
    return next;
  };

  const commit = (next: WorkspacePreferences) => {
    const savedNext = normalizeLoadedWorkspacePreferences(
      { ...next, updatedAt: new Date().toISOString() },
      next.userId,
      next.binderId,
      next.suiteTemplateId,
    );
    setSaved(savedNext);
    setDraft(savedNext);
    persist(savedNext);
    return savedNext;
  };

  const saveUnlocked = () => {
    if (!draft) {
      return null;
    }
    const next = normalizeLoadedWorkspacePreferences(
      { ...draft, locked: false, updatedAt: new Date().toISOString() },
      draft.userId,
      draft.binderId,
      draft.suiteTemplateId,
    );
    setSaved(next);
    setDraft(next);
    persist(next);
    return next;
  };

  const cancel = () => {
    if (saved) {
      setDraft(saved);
    }
  };

  const reset = () => {
    if (!userId || !binderId) {
      return null;
    }
    const next = {
      ...createDefaultWorkspacePreferences(userId, binderId, suiteTemplateId),
      updatedAt: new Date().toISOString(),
    };
    setSaved(next);
    setDraft(next);
    persist(next);
    return next;
  };

  return {
    saved,
    draft,
    active: draft ?? saved,
    updateDraft,
    commit,
    save,
    saveUnlocked,
    cancel,
    reset,
  };
}
