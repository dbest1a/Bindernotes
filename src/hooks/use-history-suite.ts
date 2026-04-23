import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createArgumentChain,
  createArgumentEdge,
  createArgumentNode,
  createHistoryEvent,
  createHistorySource,
  getHistorySuiteData,
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

const HISTORY_QUERY_STALE_TIME = 30_000;

export function useHistorySuite(
  binder: Binder | undefined,
  lessons: BinderLesson[],
  profile: Profile | null,
) {
  return useQuery({
    queryKey: ["history-suite", binder?.id, binder?.suite_template_id, profile?.id],
    queryFn: () => getHistorySuiteData({ binder: binder!, lessons, profile }),
    enabled: Boolean(binder),
    staleTime: HISTORY_QUERY_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}

export function useHistoryMutations(
  binder: Binder | undefined,
  profile: Profile | null,
) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    if (!binder) {
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: ["history-suite", binder.id],
      exact: false,
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
        input: Partial<HistoryEvidenceCard> &
          Pick<HistoryEvidenceCard, "binder_id" | "evidence_strength">,
      ) => upsertEvidenceCard(profile!, input),
      onSuccess: invalidate,
    }),
    createArgumentChain: useMutation({
      mutationFn: (input: Omit<HistoryArgumentChain, "id" | "owner_id" | "created_at" | "updated_at">) =>
        createArgumentChain(profile!, input),
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
  updater: (current: HistorySuiteData) => HistorySuiteData,
) {
  queryClient.setQueriesData<HistorySuiteData>(
    {
      queryKey: ["history-suite", binderId],
      exact: false,
    },
    (current) => (current ? updater(current) : current),
  );
}
