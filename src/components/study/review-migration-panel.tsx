import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  importLocalReviews,
  previewLocalReviewMigration,
  type LocalReviewMigration,
} from "@/services/review-migration-service";

export function ReviewMigrationPanel({ ownerId, onImported }: { ownerId: string; onImported: () => void }) {
  const [preview, setPreview] = useState<LocalReviewMigration | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function inspect() {
    try {
      setPreview(previewLocalReviewMigration(ownerId, window.localStorage));
      setMessage("");
    } catch {
      setMessage("Device storage could not be read. No data was changed.");
    }
  }
  async function migrate() {
    if (!preview || pending) return;
    setPending(true);
    try {
      const result = await importLocalReviews(preview);
      if (!alive.current) return;
      setMessage(
        `${result.saved} saved, ${result.unchanged} already saved, ${result.sessions} session summaries preserved. ${result.conflicts} conflicts, ${result.failed} failed, ${result.issues.length} device-data issues. All browser originals were kept.`,
      );
      onImported();
    } catch {
      if (alive.current)
        setMessage("Migration could not finish. Browser originals are unchanged; reconnect and retry.");
    } finally {
      if (alive.current) setPending(false);
    }
  }
  return (
    <section className="grid gap-2 rounded-xl border p-3" aria-label="Recover browser review work">
      <p className="text-sm">
        Older review work may exist only in this browser. Inspect and import work belonging to this account;
        browser originals are kept.
      </p>
      <Button variant="outline" type="button" disabled={pending} onClick={inspect}>
        Inspect device review data
      </Button>
      {preview && (
        <>
          <p className="text-sm">
            {preview.records.length} cards, {preview.events.length} review events, {preview.sessions.length}{" "}
            session summaries. {preview.issues.length} records or files require recovery. Anonymous and
            other-account data are not imported.
          </p>
          <Button
            type="button"
            disabled={pending || !(preview.records.length || preview.sessions.length)}
            onClick={() => void migrate()}
          >
            {pending ? "Importing…" : "Import validated review data"}
          </Button>
        </>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
