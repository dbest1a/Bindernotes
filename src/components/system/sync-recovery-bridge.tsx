import { useSyncRecovery } from "@/lib/sync-recovery";

export function SyncRecoveryBridge() {
  useSyncRecovery([
    "highlight",
    "workspace_layout",
    "history_event",
    "history_source",
    "history_evidence",
    "history_argument",
    "myth_check",
  ]);

  return null;
}
