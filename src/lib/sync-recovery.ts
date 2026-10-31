import { useEffect } from "react";
import { saveQueue } from "@/lib/save-queue";
import type { SaveEntityType } from "@/types";

export function useSyncRecovery(entityTypes?: SaveEntityType[]) {
  // Callers pass inline arrays; key the effect by content so a re-render does
  // not re-subscribe and retry every failed write again.
  const entityTypesKey = entityTypes?.join("|") ?? null;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const types = entityTypesKey === null ? undefined : (entityTypesKey.split("|").filter(Boolean) as SaveEntityType[]);
    const retry = () => {
      // Each scope's status already shows what is still unsynced; a failed
      // retry must not surface as an unhandled rejection.
      saveQueue.retryPending(types).catch(() => undefined);
    };

    window.addEventListener("online", retry);
    if (navigator.onLine) {
      retry();
    }

    return () => {
      window.removeEventListener("online", retry);
    };
  }, [entityTypesKey]);
}
