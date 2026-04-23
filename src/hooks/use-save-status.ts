import { useEffect, useState } from "react";
import { saveQueue } from "@/lib/save-queue";
import type { SaveStatusSnapshot } from "@/types";

export function useSaveStatus(scopeKey: string) {
  const [snapshot, setSnapshot] = useState<SaveStatusSnapshot>(() => saveQueue.getSnapshot(scopeKey));

  useEffect(() => {
    setSnapshot(saveQueue.getSnapshot(scopeKey));
    return saveQueue.subscribe((changedScopeKey, nextSnapshot) => {
      if (changedScopeKey !== scopeKey) {
        return;
      }

      setSnapshot(nextSnapshot);
    });
  }, [scopeKey]);

  return {
    ...snapshot,
    retry: () => saveQueue.retry(scopeKey),
  };
}
