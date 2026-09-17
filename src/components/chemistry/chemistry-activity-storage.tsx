import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  listChemistryActivities,
  saveChemistryActivity,
  type ChemistryActivity,
  type ChemistryActivityKind,
  type SavedChemistryActivity,
} from "@/services/chemistry-activity-service";

export function ChemistryActivityStorage({
  ownerId,
  kind,
  snapshot,
  onRestore,
}: {
  ownerId: string | null;
  kind: ChemistryActivityKind;
  snapshot: ChemistryActivity | null;
  onRestore: (snapshot: ChemistryActivity) => void;
}) {
  if (!ownerId)
    return (
      <p className="text-sm text-muted-foreground">
        Sign in to save and reopen chemistry work. Current changes are only on this page.
      </p>
    );
  return (
    <AccountStorage
      key={`${ownerId}:${kind}`}
      ownerId={ownerId}
      kind={kind}
      snapshot={snapshot}
      onRestore={onRestore}
    />
  );
}

function AccountStorage({
  ownerId,
  kind,
  snapshot,
  onRestore,
}: {
  ownerId: string;
  kind: ChemistryActivityKind;
  snapshot: ChemistryActivity | null;
  onRestore: (snapshot: ChemistryActivity) => void;
}) {
  const serialized = JSON.stringify(snapshot);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [records, setRecords] = useState<SavedChemistryActivity[]>([]);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [unsupportedCount, setUnsupportedCount] = useState(0);
  const [reopen, setReopen] = useState<SavedChemistryActivity | null>(null);
  const lifecycle = useRef<AbortController | null>(null);
  const operation = useRef<{ id: string; fingerprint: string } | null>(null);
  const saving = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void listChemistryActivities({ ownerId, kind, page, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setRecords(result.records);
        setHasMore(result.hasMore);
        setUnsupportedCount(result.unsupportedCount);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoadError("Saved chemistry work could not be loaded. Your current work is unchanged.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [ownerId, kind, page, reload]);
  async function save() {
    if (!snapshot || saving.current) return;
    saving.current = true;
    setPending(true);
    setSaveError("");
    if (!operation.current || operation.current.fingerprint !== serialized)
      operation.current = { id: crypto.randomUUID(), fingerprint: serialized };
    const signal = lifecycle.current?.signal;
    try {
      await saveChemistryActivity({ ownerId, snapshot, id: operation.current.id, signal });
      if (signal?.aborted) return;
      setSavedFingerprint(serialized);
      setPage(0);
      setReload((value) => value + 1);
    } catch (error) {
      if (!signal?.aborted)
        setSaveError(error instanceof Error ? error.message : "Save failed. Your current work is unchanged.");
    } finally {
      if (!signal?.aborted) {
        saving.current = false;
        setPending(false);
      }
    }
  }
  function restore(record: SavedChemistryActivity) {
    if (record.ownerId !== ownerId || record.snapshot.kind !== kind) return;
    onRestore(record.snapshot);
    setSavedFingerprint(JSON.stringify(record.snapshot));
    setReopen(null);
    setSaveError("");
    operation.current = null;
  }
  return (
    <section aria-label="Saved chemistry work" className="grid gap-3 rounded-xl border border-border/70 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={pending || !snapshot || savedFingerprint === serialized}
          onClick={() => void save()}
        >
          {pending ? "Saving…" : "Save chemistry work"}
        </Button>
        <p role="status" className="text-xs text-muted-foreground">
          {pending
            ? "Saving to your account…"
            : savedFingerprint === serialized
              ? "Saved to your account."
              : "Unsaved changes. Save before leaving this page."}
        </p>
      </div>
      {saveError && (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">Reopen saved chemistry work</summary>
        <div className="mt-3 grid gap-2">
          {loading ? (
            <p className="text-sm">Loading saved work…</p>
          ) : loadError ? (
            <p role="alert" className="text-sm">
              {loadError}{" "}
              <Button type="button" variant="outline" onClick={() => setReload((value) => value + 1)}>
                Retry loading
              </Button>
            </p>
          ) : (
            <>
              {records.length === 0 && (
                <p className="text-sm text-muted-foreground">No supported saved work on this page.</p>
              )}
              {records.map((record) => (
                <Button
                  key={record.id}
                  disabled={pending}
                  variant="outline"
                  type="button"
                  onClick={() => setReopen(record)}
                >
                  Reopen {new Date(record.createdAt).toLocaleString()} · {record.id.slice(0, 8)}
                </Button>
              ))}
              {unsupportedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {unsupportedCount} older or invalid saved activities cannot be reopened here. They have been
                  kept in your account.
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Newer saves
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={!hasMore}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Older saves
                </Button>
              </div>
            </>
          )}
          {reopen && (
            <div className="grid gap-2 rounded-lg border p-3">
              <p className="text-sm">
                Reopen this snapshot? It will replace the current work in this tool. Save current changes
                first if you want to keep them.
              </p>
              <div className="flex gap-2">
                <Button type="button" disabled={pending} onClick={() => restore(reopen)}>
                  Reopen snapshot
                </Button>
                <Button type="button" variant="outline" onClick={() => setReopen(null)}>
                  Keep current work
                </Button>
              </div>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
