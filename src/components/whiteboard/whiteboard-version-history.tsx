import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { listWhiteboardVersions, restoreWhiteboardVersion, type WhiteboardVersionSummary } from "@/lib/whiteboards/whiteboard-storage";
import type { BinderWhiteboard } from "@/lib/whiteboards/whiteboard-types";

export function WhiteboardVersionHistory({ board, expectedRevision, disabled, onRestored }: {
  board: BinderWhiteboard; expectedRevision: number; disabled: boolean; onRestored: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef<{ versionId: string; revision: number; id: string } | null>(null);
  const [versions, setVersions] = useState<WhiteboardVersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true; setLoading(true); setError(null);
    void listWhiteboardVersions(board).then((items) => { if (active) setVersions(items); })
      .catch(() => { if (active) setError("Version history could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, board.id, board.ownerId, expectedRevision]);
  async function restore(versionId: string) {
    if (pending || disabled) return;
    const previous = operation.current;
    const request = previous?.versionId === versionId && previous.revision === expectedRevision ? previous : { versionId, revision: expectedRevision, id: crypto.randomUUID() };
    operation.current = request; setPending(true); setError(null);
    try {
      await restoreWhiteboardVersion(board, versionId, request.revision, request.id);
      await onRestored(); setVersions(await listWhiteboardVersions(board)); operation.current = null;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Restore failed. Your current board is preserved; retry when connected."); }
    finally { setPending(false); }
  }
  return <details className="relative" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded border px-2 py-1 text-sm">Version history</summary>
    {open && <section aria-label="Whiteboard version history" className="absolute right-0 top-full z-50 mt-1 max-h-80 w-80 max-w-[85vw] overflow-auto rounded-lg border bg-background p-3 shadow-xl">
      <p className="text-sm">The newest 50 automatic versions and explicit checkpoints are retained. Restoring creates a new version and keeps the chosen checkpoint.</p>
      {disabled && <p className="mt-2 text-sm">Save or recover your current draft before restoring.</p>}
      {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
      {loading ? <p role="status">Loading versions…</p> : <ul className="mt-2 space-y-2">{versions.map(version => <li key={version.id} className="flex items-center justify-between gap-2 text-sm">
        <span>Version {version.version}<br /><span className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</span></span>
        <Button size="sm" variant="outline" disabled={disabled || pending} onClick={() => void restore(version.id)}>Restore version {version.version}</Button>
      </li>)}</ul>}
      {!loading && !error && !versions.length && <p className="mt-2 text-sm">No saved versions yet.</p>}
    </section>}
  </details>;
}
