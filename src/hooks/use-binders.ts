import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createComment,
  createHighlight,
  deleteHighlight,
  deleteComment,
  deleteLesson,
  getBinderOverview,
  getBinderBundle,
  getDashboard,
  getFolderWorkspace,
  resetHighlights,
  updateComment,
  updateHighlight,
  upsertBinder,
  upsertLearnerNote,
  upsertLesson,
} from "@/services/binder-service";
import { seedSystemSuites } from "@/services/system-seed-service";
import type {
  BinderBundle,
  BinderOverviewData,
  DashboardData,
  Highlight,
  HighlightColor,
  LearnerNote,
  MathBlock,
  Profile,
} from "@/types";
import type { JSONContent } from "@tiptap/react";

const DEFAULT_QUERY_STALE_TIME = 30_000;

type DashboardQueryOptions = {
  includeSystemStatus?: boolean;
  enabled?: boolean;
};

export function useDashboard(profile: Profile | null, options?: DashboardQueryOptions) {
  const includeSystemStatus = options?.includeSystemStatus ?? true;
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: ["dashboard", profile?.id, profile?.role, includeSystemStatus],
    queryFn: () => getDashboard(profile!, { includeSystemStatus }),
    enabled: Boolean(profile) && enabled,
    staleTime: DEFAULT_QUERY_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}

export function useBinderBundle(binderId: string | undefined, profile: Profile | null) {
  return useQuery({
    queryKey: ["binder", binderId, profile?.id],
    queryFn: () => getBinderBundle(binderId!, profile!),
    enabled: Boolean(binderId && profile),
    staleTime: DEFAULT_QUERY_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}

export function useFolderWorkspace(folderId: string | undefined, profile: Profile | null) {
  return useQuery({
    queryKey: ["folder", folderId, profile?.id],
    queryFn: () => getFolderWorkspace(folderId!, profile!),
    enabled: Boolean(folderId && profile),
    staleTime: DEFAULT_QUERY_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}

export function useBinderOverview(binderId: string | undefined, profile: Profile | null) {
  return useQuery({
    queryKey: ["binder-overview", binderId, profile?.id],
    queryFn: () => getBinderOverview(binderId!, profile!),
    enabled: Boolean(binderId && profile),
    staleTime: DEFAULT_QUERY_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}

export function useLearnerNoteMutation(profile: Profile | null, binderId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      id?: string;
      binderId: string;
      lessonId: string;
      folderId?: string | null;
      title: string;
      content: JSONContent;
      mathBlocks: MathBlock[];
    }) =>
      upsertLearnerNote({
        ...input,
        ownerId: profile!.id,
      }),
    onSuccess: (savedNote) => {
      updateBinderBundleCache(queryClient, binderId, profile, (current) => ({
        ...current,
        notes: upsertNoteByScope(current.notes, savedNote),
      }));

      if (profile) {
        queryClient.setQueryData<DashboardData | undefined>(
          ["dashboard", profile.id, profile.role],
          (current) =>
            current
              ? {
                  ...current,
                  notes: upsertNoteByScope(current.notes, savedNote),
                }
              : current,
        );

        queryClient.setQueryData<BinderOverviewData | undefined>(
          ["binder-overview", savedNote.binder_id, profile.id],
          (current) =>
            current
              ? {
                  ...current,
                  notes: upsertNoteByScope(current.notes, savedNote),
                }
              : current,
        );

        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === "folder" &&
            query.queryKey[2] === profile.id,
        });
      }
    },
  });
}

export function useAnnotationMutations(profile: Profile | null, binderId?: string) {
  const queryClient = useQueryClient();

  return {
    highlight: useMutation({
      mutationFn: (input: {
        binderId: string;
        lessonId: string;
        anchorText: string;
        color: HighlightColor;
        startOffset?: number;
        endOffset?: number;
        selectedText?: string;
        prefixText?: string;
        suffixText?: string;
        blockId?: string | null;
      }) =>
        createHighlight({
          ...input,
          ownerId: profile!.id,
        }),
      onMutate: async (input) => {
        const optimisticId = `highlight-optimistic:${crypto.randomUUID()}`;
        const previous = snapshotBinderBundle(queryClient, binderId, profile, (current) => ({
          ...current,
          highlights: upsertById(current.highlights, buildOptimisticHighlight(profile!, optimisticId, input)),
        }));

        return {
          ...previous,
          optimisticId,
        };
      },
      onError: (_error, _input, context) => restoreBinderBundle(queryClient, binderId, profile, context),
      onSuccess: (savedHighlight, _input, context) => {
        updateBinderBundleCache(queryClient, binderId, profile, (current) => ({
          ...current,
          highlights: upsertById(
            current.highlights.filter((highlight) => highlight.id !== context?.optimisticId),
            savedHighlight,
          ),
        }));
      },
    }),
    updateHighlight: useMutation({
      mutationFn: (input: {
        highlightId: string;
        anchorText: string;
        color: HighlightColor;
        startOffset?: number;
        endOffset?: number;
        selectedText?: string;
        prefixText?: string;
        suffixText?: string;
        blockId?: string | null;
      }) =>
        updateHighlight({
          ...input,
          ownerId: profile!.id,
        }),
      onMutate: async (input) => {
        return snapshotBinderBundle(queryClient, binderId, profile, (current) => ({
          ...current,
          highlights: current.highlights.map((highlight) =>
            highlight.id === input.highlightId
              ? {
                  ...highlight,
                  anchor_text: input.anchorText,
                  selected_text: input.selectedText ?? input.anchorText,
                  prefix_text: input.prefixText ?? highlight.prefix_text ?? null,
                  suffix_text: input.suffixText ?? highlight.suffix_text ?? null,
                  color: input.color,
                  start_offset: input.startOffset ?? highlight.start_offset ?? null,
                  end_offset: input.endOffset ?? highlight.end_offset ?? null,
                  updated_at: new Date().toISOString(),
                }
              : highlight,
          ),
        }));
      },
      onError: (_error, _input, context) => restoreBinderBundle(queryClient, binderId, profile, context),
      onSuccess: (savedHighlight) => {
        updateBinderBundleCache(queryClient, binderId, profile, (current) => ({
          ...current,
          highlights: upsertById(current.highlights, savedHighlight),
        }));
      },
    }),
    deleteHighlight: useMutation({
      mutationFn: (input: { highlightId: string }) =>
        deleteHighlight({
          ...input,
          ownerId: profile!.id,
        }),
      onMutate: async (input) => {
        return snapshotBinderBundle(queryClient, binderId, profile, (current) => ({
          ...current,
          highlights: current.highlights.filter((highlight) => highlight.id !== input.highlightId),
        }));
      },
      onError: (_error, _input, context) => restoreBinderBundle(queryClient, binderId, profile, context),
    }),
    resetHighlights: useMutation({
      mutationFn: (input: { binderId: string; lessonId?: string }) =>
        resetHighlights({
          ...input,
          ownerId: profile!.id,
        }),
      onMutate: async (input) => {
        return snapshotBinderBundle(queryClient, binderId, profile, (current) => ({
          ...current,
          highlights: current.highlights.filter((highlight) => {
            if (highlight.binder_id !== input.binderId) {
              return true;
            }

            return input.lessonId ? highlight.lesson_id !== input.lessonId : false;
          }),
        }));
      },
      onError: (_error, _input, context) => restoreBinderBundle(queryClient, binderId, profile, context),
      onSuccess: (_result, input) => {
        updateBinderBundleCache(queryClient, binderId, profile, (current) => ({
          ...current,
          highlights: current.highlights.filter((highlight) => {
            if (highlight.binder_id !== input.binderId) {
              return true;
            }

            return input.lessonId ? highlight.lesson_id !== input.lessonId : false;
          }),
        }));
      },
    }),
    comment: useMutation({
      mutationFn: (input: {
        binderId: string;
        lessonId: string;
        body: string;
        anchorText?: string | null;
      }) =>
        createComment({
          ...input,
          ownerId: profile!.id,
        }),
      onSuccess: (savedComment) => {
        updateBinderBundleCache(queryClient, binderId, profile, (current) => ({
          ...current,
          comments: upsertById(current.comments, savedComment),
        }));
      },
    }),
    updateComment: useMutation({
      mutationFn: (input: { commentId: string; body: string }) =>
        updateComment({
          ...input,
          ownerId: profile!.id,
        }),
      onMutate: async (input) => {
        return snapshotBinderBundle(queryClient, binderId, profile, (current) => ({
          ...current,
          comments: current.comments.map((comment) =>
            comment.id === input.commentId
              ? {
                  ...comment,
                  body: input.body,
                }
              : comment,
          ),
        }));
      },
      onError: (_error, _input, context) => restoreBinderBundle(queryClient, binderId, profile, context),
      onSuccess: (savedComment) => {
        updateBinderBundleCache(queryClient, binderId, profile, (current) => ({
          ...current,
          comments: upsertById(current.comments, savedComment),
        }));
      },
    }),
    deleteComment: useMutation({
      mutationFn: (input: { commentId: string }) =>
        deleteComment({
          ...input,
          ownerId: profile!.id,
        }),
      onMutate: async (input) => {
        return snapshotBinderBundle(queryClient, binderId, profile, (current) => ({
          ...current,
          comments: current.comments.filter((comment) => comment.id !== input.commentId),
        }));
      },
      onError: (_error, _input, context) => restoreBinderBundle(queryClient, binderId, profile, context),
    }),
  };
}

function updateBinderBundleCache(
  queryClient: ReturnType<typeof useQueryClient>,
  binderId: string | undefined,
  profile: Profile | null,
  updater: (current: BinderBundle) => BinderBundle,
) {
  if (!binderId || !profile) {
    return;
  }

  queryClient.setQueryData<BinderBundle | undefined>(
    ["binder", binderId, profile.id],
    (current) => (current ? updater(current) : current),
  );
}

function snapshotBinderBundle(
  queryClient: ReturnType<typeof useQueryClient>,
  binderId: string | undefined,
  profile: Profile | null,
  updater: (current: BinderBundle) => BinderBundle,
) {
  if (!binderId || !profile) {
    return { previous: undefined as BinderBundle | undefined };
  }

  const key = ["binder", binderId, profile.id] as const;
  const previous = queryClient.getQueryData<BinderBundle>(key);
  if (previous) {
    queryClient.setQueryData<BinderBundle>(key, updater(previous));
  }

  return { previous };
}

function restoreBinderBundle(
  queryClient: ReturnType<typeof useQueryClient>,
  binderId: string | undefined,
  profile: Profile | null,
  context: { previous?: BinderBundle } | undefined,
) {
  if (!binderId || !profile || !context?.previous) {
    return;
  }

  queryClient.setQueryData(["binder", binderId, profile.id], context.previous);
}

function buildOptimisticHighlight(
  profile: Profile,
  optimisticId: string,
  input: {
    binderId: string;
    lessonId: string;
    anchorText: string;
    color: HighlightColor;
    startOffset?: number;
    endOffset?: number;
    selectedText?: string;
    prefixText?: string;
    suffixText?: string;
  },
): Highlight {
  const timestamp = new Date().toISOString();
  return {
    id: optimisticId,
    owner_id: profile.id,
    binder_id: input.binderId,
    lesson_id: input.lessonId,
    document_id: input.lessonId,
    source_version_id: null,
    anchor_text: input.anchorText,
    selected_text: input.selectedText ?? input.anchorText,
    prefix_text: input.prefixText ?? null,
    suffix_text: input.suffixText ?? null,
    selector_json: null,
    color: input.color,
    note_id: null,
    start_offset: input.startOffset ?? null,
    end_offset: input.endOffset ?? null,
    status: "active",
    reanchor_confidence: 1,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index < 0) {
    return [item, ...items];
  }

  const next = [...items];
  next[index] = item;
  return next;
}

function upsertNoteByScope(items: LearnerNote[], item: LearnerNote) {
  const next = items.filter(
    (candidate) =>
      candidate.id !== item.id &&
      !(candidate.owner_id === item.owner_id && candidate.lesson_id === item.lesson_id),
  );
  next.unshift(item);
  return next.sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
}

export function useAdminMutations(profile: Profile | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard", profile?.id, profile?.role] });
  };

  return {
    binder: useMutation({
      mutationFn: (input: Parameters<typeof upsertBinder>[0]) =>
        upsertBinder({ ...input, ownerId: profile!.id }),
      onSuccess: (binder) => {
        queryClient.setQueriesData<DashboardData | undefined>(
          {
            queryKey: ["dashboard", profile?.id, profile?.role],
          },
          (current) =>
            current
              ? {
                  ...current,
                  binders: upsertById(current.binders, binder).sort(
                    (left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at),
                  ),
                }
              : current,
        );
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["binder", binder.id, profile?.id] });
      },
    }),
    lesson: useMutation({
      mutationFn: upsertLesson,
      onSuccess: (lesson) => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["binder", lesson.binder_id, profile?.id] });
      },
    }),
    deleteLesson: useMutation({
      mutationFn: deleteLesson,
      onSuccess: invalidate,
    }),
    seedSystemSuites: useMutation({
      mutationFn: () => seedSystemSuites(profile!),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            ["binder", "binder-overview", "folder", "history-suite"].includes(
              String(query.queryKey[0] ?? ""),
            ),
        });
      },
    }),
  };
}
