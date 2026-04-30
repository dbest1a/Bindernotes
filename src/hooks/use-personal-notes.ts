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
import type {
  MathBlock,
  PersonalNotesPreferences,
  Profile,
} from "@/types";
import type { JSONContent } from "@tiptap/react";

export function usePersonalNotes(profile: Profile | null) {
  return useQuery({
    queryKey: ["personal-notes", profile?.id],
    queryFn: () => getPersonalNotesWorkspace(profile!),
    enabled: Boolean(profile),
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

export const usePersonalNotesWorkspace = usePersonalNotes;

export function usePersonalNotesMutations(profile: Profile | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["personal-notes", profile?.id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", profile?.id] });
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
          ownerId: profile!.id,
        }),
      onSuccess: invalidate,
    }),
    savePersonalDocument: useMutation({
      mutationFn: (input: {
        id?: string;
        binderId: string;
        title: string;
        content?: JSONContent;
        mathBlocks?: MathBlock[];
        tags?: string[];
        pinned?: boolean;
      }) =>
        updatePersonalDocument({
          ...input,
          ownerId: profile!.id,
        }),
      onSuccess: invalidate,
    }),
    saveBinderLinkedNote: useMutation({
      mutationFn: (input: {
        id?: string;
        binderId: string;
        lessonId: string;
        folderId?: string | null;
        title: string;
        content: JSONContent;
        mathBlocks: MathBlock[];
      }) =>
        updateBinderLinkedPersonalNote({
          ...input,
          ownerId: profile!.id,
        }),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            (query.queryKey[0] === "dashboard" || query.queryKey[0] === "binder"),
        });
      },
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
      queryClient.invalidateQueries({ queryKey: ["personal-notes", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", profile?.id] });
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
