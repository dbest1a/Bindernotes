import { useEffect, useState } from "react";
import { getCreatorAccess, type CreatorAccess } from "@/services/creator-workspace-service";
import type { Profile } from "@/types";
export function useCreatorAccess(profile: Profile | null) {
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{
    ownerId: string;
    access: CreatorAccess | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    if (!profile) return;
    let live = true;
    setResult(null);
    void getCreatorAccess(profile)
      .then((access) => {
        if (live) setResult({ ownerId: profile.id, access, error: "" });
      })
      .catch((error) => {
        if (live)
          setResult({
            ownerId: profile.id,
            access: null,
            error: error instanceof Error ? error.message : "Creator access unavailable.",
          });
      });
    return () => {
      live = false;
    };
  }, [profile?.id, profile?.role, reload]);
  const current = result?.ownerId === profile?.id ? result : null;
  return {
    access: current?.access ?? null,
    error: current?.error ?? "",
    loading: Boolean(profile && !current),
    retry: () => setReload((value) => value + 1),
  };
}
