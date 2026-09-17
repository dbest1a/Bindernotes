import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getPersonalNoteEntryContent } from "@/services/personal-notes-service";
import type { PersonalNotesEntry } from "@/types";

export function usePersonalEntryContent(entry: PersonalNotesEntry | null, ownerId: string | undefined) {
  const needsContent = entry?.contentLoaded === false;
  const query = useQuery({
    queryKey: queryKeys.personalNotes.detail(ownerId, entry?.kind, entry?.id, entry?.updated_at),
    queryFn: ({ signal }) => getPersonalNoteEntryContent(entry!, ownerId!, signal),
    enabled: Boolean(needsContent && ownerId),
    staleTime: 60_000,
  });
  return { ...query, data: needsContent ? query.data ?? null : entry, loadingContent: needsContent && !query.data && !query.isError };
}
