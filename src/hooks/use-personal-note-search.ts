import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { searchPersonalNoteBodies } from "@/services/personal-note-search-service";

export function usePersonalNoteSearch(ownerId: string | undefined, query: string, enabled: boolean) {
  const text = query.trim();
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(text), 200);
    return () => window.clearTimeout(timer);
  }, [text]);
  const shouldSearch = Boolean(enabled && ownerId && text);
  const result = useQuery({
    queryKey: [...queryKeys.personalNotes.forProfile(ownerId), "search", settled],
    queryFn: ({ signal }) => searchPersonalNoteBodies(ownerId!, settled, signal),
    enabled: shouldSearch && settled === text,
    staleTime: 30_000,
  });
  return { matches: shouldSearch && settled === text ? result.data : undefined,
    searching: shouldSearch && (settled !== text || result.isFetching),
    error: shouldSearch && settled === text ? result.error : null, retry: result.refetch };
}
