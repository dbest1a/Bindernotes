import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createArgumentChain,
  createArgumentEdge,
  createArgumentNode,
  createHistoryEvent,
  createHistorySource,
  getHistorySuiteData,
  updateArgumentChain,
  upsertEvidenceCard,
  upsertMythCheck,
} from "@/services/history-service";
import type {
  Binder,
  BinderLesson,
  HistoryArgumentChain,
  HistoryArgumentEdge,
  HistoryArgumentNode,
  HistoryEvidenceCard,
  HistoryEvent,
  HistoryMythCheck,
  HistorySource,
  HistorySuiteData,
  Profile,
} from "@/types";
import { queryKeys } from "@/lib/query-keys";

const HISTORY_QUERY_STALE_TIME = 30_000;

export function useHistorySuite(
  binder: Binder | undefined,
  lessons: BinderLesson[],
  profile: Profile | null,
) {
  return useQuery({
    queryKey: queryKeys.historySuite.detail(binder?.id, binder?.suite_template_id, profile?.id),
    queryFn: () => getHistorySuiteData({ binder: binder!, lessons, profile }),
    enabled: Boolean(binder),
    staleTime: HISTORY_QUERY_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}

export function useHistoryMutations(binder: Binder | undefined, profile: Profile | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    if (!binder || !profile) {
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: queryKeys.historySuite.forBinder(binder.id),
      exact: false,
      predicate: (query) => query.queryKey[3] === profile.id,
    });
  };

  return {
    createEvent: useMutation({
      mutationFn: (input: Omit<HistoryEvent, "id" | "owner_id" | "created_at" | "updated_at">) =>
        createHistoryEvent(profile!, input),
      onSuccess: invalidate,
    }),
    createSource: useMutation({
      mutationFn: (input: Omit<HistorySource, "id" | "owner_id" | "created_at" | "updated_at">) =>
        createHistorySource(profile!, input),
      onSuccess: invalidate,
    }),
    upsertEvidence: useMutation({
      mutationFn: (
        input: Partial<HistoryEvidenceCard> & Pick<HistoryEvidenceCard, "binder_id" | "evidence_strength">,
      ) => upsertEvidenceCard(profile!, input),
      onSuccess: invalidate,
    }),
    createArgumentChain: useMutation({
      mutationFn: (input: Omit<HistoryArgumentChain, "id" | "owner_id" | "created_at" | "updated_at">) =>
        createArgumentChain(profile!, input),
      onSuccess: invalidate,
    }),
    updateArgumentChain: useMutation({
      mutationFn: (input: {
        chainId: string;
        patch: Partial<
          Omit<
            HistoryArgumentChain,
            "id" | "owner_id" | "binder_id" | "lesson_id" | "created_at" | "updated_at"
          >
        >;
      }) => updateArgumentChain(profile!, input.chainId, input.patch),
      onSuccess: invalidate,
    }),
    createArgumentNode: useMutation({
      mutationFn: (input: Omit<HistoryArgumentNode, "id" | "owner_id" | "created_at" | "updated_at">) =>
        createArgumentNode(profile!, input),
      onSuccess: invalidate,
    }),
    createArgumentEdge: useMutation({
      mutationFn: (input: Omit<HistoryArgumentEdge, "id" | "owner_id" | "created_at" | "updated_at">) =>
        createArgumentEdge(profile!, input),
      onSuccess: invalidate,
    }),
    upsertMythCheck: useMutation({
      mutationFn: (
        input: Partial<HistoryMythCheck> &
          Pick<HistoryMythCheck, "binder_id" | "myth_text" | "corrected_claim" | "status" | "explanation">,
      ) => upsertMythCheck(profile!, input),
      onSuccess: invalidate,
    }),
  };
}

export function patchHistorySuiteQuery(
  queryClient: ReturnType<typeof useQueryClient>,
  binderId: string,
  profileId: string,
  updater: (current: HistorySuiteData) => HistorySuiteData,
) {
  queryClient.setQueriesData<HistorySuiteData>(
    {
      queryKey: queryKeys.historySuite.forBinder(binderId),
      exact: false,
      predicate: (query) => query.queryKey[3] === profileId,
    },
    (current) => (current ? updater(current) : current),
  );
}
