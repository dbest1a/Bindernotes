import { useEffect } from "react";
import { saveQueue } from "@/lib/save-queue";
import type { SaveEntityType } from "@/types";

export function useSyncRecovery(entityTypes?: SaveEntityType[]) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const retry = () => {
      void saveQueue.retryPending(entityTypes);
    };

    window.addEventListener("online", retry);
    if (navigator.onLine) {
      retry();
    }

    return () => {
      window.removeEventListener("online", retry);
    };
  }, [entityTypes]);
}
