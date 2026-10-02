import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createLoosePersonalNote,
  createPersonalBinder,
  createPersonalDocument,
  createPersonalNoteFolder,
  getPersonalNotesWorkspace,
  setPersonalEntryPinned,
  updateBinderLinkedPersonalNote,
  updateLoosePersonalNote,
  updatePersonalDocument,
} from "@/services/personal-notes-service";
import {
  loadPersonalNotesPreferences,
  personalNotesPreferencesUpdatedEvent,
  savePersonalNotesPreferences,
} from "@/lib/personal-notes";
import { queryKeys } from "@/lib/query-keys";
import type {
  MathBlock,
  PersonalNotesPreferences,
  Profile,
} from "@/types";
import type { JSONContent } from "@tiptap/react";

export function usePersonalNotes(profile: Profile | null) {
  const query = useQuery({
    queryKey: queryKeys.personalNotes.forProfile(profile?.id),
    queryFn: () => getPersonalNotesWorkspace(profile!),
    enabled: Boolean(profile),
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === `bindernotes:notes-updated:${profile?.id}`) void query.refetch();
      if (event.key === "binder-notes:note-sync:v1" && event.newValue) {
        try { if (JSON.parse(event.newValue).ownerId === profile?.id) void query.refetch(); } catch { /* Ignore malformed cross-tab messages. */ }
      }
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [profile?.id, query.refetch]);
  return query;
}

export const usePersonalNotesWorkspace = usePersonalNotes;

export function usePersonalNotesMutations(profile: Profile | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.personalNotes.forProfile(profile?.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.forProfile(profile?.id) });
    try { localStorage.setItem(`bindernotes:notes-updated:${profile?.id}`, crypto.randomUUID()); } catch { /* Revision checks remain authoritative. */ }
  };

  return {
    createFolder: useMutation({
      mutationFn: (input: { name: string; color?: string }) =>
        createPersonalNoteFolder({
          ...input,
          ownerId: profile!.id,
        }),
      onSuccess: invalidate,
    }),
    createBinder: useMutation({
      mutationFn: (input: {
        title: string;
        folderId?: string | null;
        description?: string | null;
        color?: string | null;
        createFirstDocument?: boolean;
      }) =>
        createPersonalBinder({
          ...input,
          ownerId: profile!.id,
        }),
      onSuccess: invalidate,
    }),
    createDocument: useMutation({
      mutationFn: (input: {
        binderId: string;
        title: string;
        content?: JSONContent;
        mathBlocks?: MathBlock[];
        tags?: string[];
      }) =>
        createPersonalDocument({
          ...input,
          ownerId: profile!.id,
        }),
      onSuccess: invalidate,
    }),
    savePersonalNote: useMutation({
      mutationFn: (input: {
        id?: string;
        expectedUpdatedAt?: string;
        ownerId?: string;
        title: string;
        content?: JSONContent;
        mathBlocks?: MathBlock[];
        folderId?: string | null;
        binderId?: string | null;
        documentId?: string | null;
        tags?: string[];
        pinned?: boolean;
      }) =>
        updateLoosePersonalNote({
          ...input,
          ownerId: input.ownerId ?? profile!.id,
        }),
      onSuccess: invalidate,
      onError: invalidate,
    }),
    savePersonalDocument: useMutation({
      mutationFn: (input: {
        id?: string;
        expectedUpdatedAt?: string;
        ownerId?: string;
        binderId: string;
        title: string;
        content?: JSONContent;
        mathBlocks?: MathBlock[];
        tags?: string[];
        pinned?: boolean;
      }) =>
        updatePersonalDocument({
          ...input,
          ownerId: input.ownerId ?? profile!.id,
        }),
      onSuccess: invalidate,
      onError: invalidate,
    }),
    saveBinderLinkedNote: useMutation({
      mutationFn: (input: {
        id?: string;
        expectedUpdatedAt?: string;
        ownerId?: string;
        binderId: string;
        lessonId: string;
        folderId?: string | null;
        title: string;
        content: JSONContent;
        mathBlocks: MathBlock[];
      }) =>
        updateBinderLinkedPersonalNote({
          ...input,
          ownerId: input.ownerId ?? profile!.id,
        }),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === queryKeys.binder.all[0] &&
            query.queryKey[2] === profile?.id,
        });
      },
      onError: invalidate,
    }),
    setPinned: useMutation({
      mutationFn: (input: { kind: "personal-note" | "personal-document"; id: string; pinned: boolean }) =>
        setPersonalEntryPinned({
          ...input,
          ownerId: profile!.id,
        }),
      onSuccess: invalidate,
    }),
  };
}

export function useCreatePersonalNoteFolder(profile: Profile | null) {
  return usePersonalNotesMutations(profile).createFolder;
}

export function useCreatePersonalBinder(profile: Profile | null) {
  return usePersonalNotesMutations(profile).createBinder;
}

export function useCreatePersonalDocument(profile: Profile | null) {
  return usePersonalNotesMutations(profile).createDocument;
}

export function useCreateLoosePersonalNote(profile: Profile | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
        expectedUpdatedAt?: string;
        ownerId?: string;
      title: string;
      content?: JSONContent;
      mathBlocks?: MathBlock[];
      folderId?: string | null;
      binderId?: string | null;
      documentId?: string | null;
      tags?: string[];
      pinned?: boolean;
    }) =>
      createLoosePersonalNote({
        ...input,
        ownerId: profile!.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personalNotes.forProfile(profile?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.forProfile(profile?.id) });
    },
  });
}

export function useUpdatePersonalNote(profile: Profile | null) {
  return usePersonalNotesMutations(profile).savePersonalNote;
}

export function useUpdatePersonalDocument(profile: Profile | null) {
  return usePersonalNotesMutations(profile).savePersonalDocument;
}

export function usePersonalNotesPreferences(profile: Profile | null) {
  const [preferences, setPreferences] = useState<PersonalNotesPreferences>(() =>
    loadPersonalNotesPreferences(profile?.id),
  );

  useEffect(() => {
    setPreferences(loadPersonalNotesPreferences(profile?.id));
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || typeof window === "undefined") {
      return;
    }

    const onPreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        preferences?: PersonalNotesPreferences;
        userId?: string;
      }>).detail;
      if (detail?.userId === profile.id && detail.preferences) {
        setPreferences(detail.preferences);
      }
    };

    window.addEventListener(personalNotesPreferencesUpdatedEvent, onPreferencesUpdated);
    return () => window.removeEventListener(personalNotesPreferencesUpdatedEvent, onPreferencesUpdated);
  }, [profile?.id]);

  const updatePreferences = useCallback(
    (
      updater:
        | Partial<PersonalNotesPreferences>
        | ((current: PersonalNotesPreferences) => PersonalNotesPreferences),
    ) => {
      setPreferences((current) => {
        const next =
          typeof updater === "function"
            ? updater(current)
            : {
                ...current,
                ...updater,
              };
        savePersonalNotesPreferences(profile?.id, next);
        return next;
      });
    },
    [profile?.id],
  );

  return [preferences, updatePreferences] as const;
}
