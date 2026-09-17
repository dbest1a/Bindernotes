import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { archiveErrorMessage, type ArchiveOperation } from "@/lib/archive-errors";
import { archiveTables, readableArchive, type PortableArchive } from "@/lib/portable-archive";
import {
  exportPortableArchive,
  importPortableArchive,
  prepareArchiveImport,
  restoreImportedMath,
  type PreparedArchiveImport,
} from "@/services/portable-archive-service";

function download(name: string, value: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const collectionLabels = {
  personal_note_folders: "Notebook folders",
  personal_note_binders: "Notebooks",
  personal_note_documents: "Notebook documents",
  personal_notes: "Personal notes",
  folders: "Source folders",
  binders: "Source binders",
  binder_lessons: "Source lessons",
  folder_binders: "Folder links",
  learner_notes: "Linked notes",
  comments: "Comments",
  highlights: "Highlights",
  whiteboards: "Whiteboards",
  whiteboard_versions: "Whiteboard versions",
};
export function AccountDataPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [exported, setExported] = useState<PortableArchive | null>(null);
  const [prepared, setPrepared] = useState<PreparedArchiveImport | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof importPortableArchive>> | null>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );
  const run = async (operation: ArchiveOperation, work: () => Promise<void>) => {
    const token = ++request.current;
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (error) {
      if (request.current === token) setMessage(archiveErrorMessage(error, operation));
    } finally {
      if (request.current === token) setBusy(false);
    }
  };
  const exportData = () =>
    run("export", async () => {
      const archive = await exportPortableArchive(profile!.id);
      setExported(archive);
      download(
        `bindernotes-${archive.exportedAt.slice(0, 10)}.json`,
        JSON.stringify(archive),
        "application/json",
      );
      setMessage("Complete archive downloaded. Keep it private: it contains your notes and files.");
    });
  const selectFile = (file?: File) =>
    run("validate", async () => {
      setPrepared(null);
      setResult(null);
      if (!file) return;
      const checked = await prepareArchiveImport(profile!.id, file);
      setPrepared(checked);
      setMessage("Archive validated. Review its contents before importing.");
    });
  const importData = () =>
    run("import", async () => {
      if (!prepared) return;
      const imported = await importPortableArchive(prepared);
      setResult(imported);
      await queryClient.invalidateQueries();
      setMessage(
        imported.deviceMathReady
          ? "All workspace records were imported. Device Math work is ready."
          : "All workspace records were imported. Device Math setup still needs attention; its complete backup is preserved in this account.",
      );
    });
  if (!profile) return null;
  return (
    <main className="mx-auto grid max-w-4xl gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Data &amp; backups</h1>
        <p className="mt-2 text-muted-foreground">
          Take your study work with you, or restore a BinderNotes archive into this account.
        </p>
      </header>
      <section className="grid gap-4 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Export your workspace</h2>
        <p>
          Includes folders, notebooks, documents, linked notes and their source lessons, equations, tags,
          comments, highlights, cloud reviews and history, whiteboard scenes and versions, and supported
          private files. This device’s Math work and recoverable drafts are included too.
        </p>
        <p className="text-sm text-muted-foreground">
          The versioned JSON archive preserves full data. A readable Markdown companion is available after
          export. Archives up to 100 MiB are supported; an incomplete export is never downloaded.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void exportData()}>
            Export complete archive
          </Button>
          {exported && (
            <Button
              disabled={busy}
              variant="outline"
              onClick={() =>
                download("bindernotes-readable-notes.md", readableArchive(exported), "text/markdown")
              }
            >
              Download readable notes
            </Button>
          )}
        </div>
      </section>
      <section className="grid gap-4 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Import an archive</h2>
        <p>
          Imported records get new identities and keep their relationships. Existing work is never replaced.
          Source binders become private drafts; roles, purchases and publishing permissions are unchanged.
        </p>
        <label className="grid gap-2">
          Choose a BinderNotes JSON archive
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(event) => void selectFile(event.target.files?.[0])}
          />
        </label>
        {prepared && (
          <div className="grid gap-3">
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {archiveTables
                .filter((table) => prepared.archive.tables[table].length > 0)
                .map((table) => (
                  <li key={table}>
                    {collectionLabels[table]}: {prepared.archive.tables[table].length}
                  </li>
                ))}
              <li>Review cards: {prepared.archive.reviews.length}</li>
              <li>
                Review history:{" "}
                {prepared.archive.reviewEvents.length + prepared.archive.recallSessions.length}
              </li>
              <li>Private files: {prepared.archive.assets.length}</li>
              <li>Device recovery snapshots: {prepared.archive.deviceRecovery.length}</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Workspace records and verified files become visible together. If the connection fails, retry the
              same archive to confirm its result without duplicates. Device recovery snapshots are retained as
              backups, so they cannot overwrite newer saved work.
            </p>
            <Button disabled={busy || Boolean(result)} onClick={() => void importData()}>
              Import into this account
            </Button>
          </div>
        )}
        {result && !result.deviceMathReady && (
          <Button
            disabled={busy}
            variant="outline"
            onClick={() =>
              void run("restore", async () => {
                await restoreImportedMath(profile.id, result.batchId);
                setResult({ ...result, deviceMathReady: true });
                setMessage("Device Math setup completed.");
              })
            }
          >
            Retry device Math setup
          </Button>
        )}
        {result && prepared && prepared.archive.deviceRecovery.length > 0 && (
          <Button
            variant="outline"
            onClick={() =>
              download(
                "bindernotes-recovered-device-data.json",
                JSON.stringify(prepared.archive.deviceRecovery, null, 2),
                "application/json",
              )
            }
          >
            Download recovered device snapshots
          </Button>
        )}
      </section>
      {busy && <p role="status">Preparing your data… Keep this page open.</p>}
      {message && (
        <p role="status" className="rounded-lg border p-4">
          {message}
        </p>
      )}
    </main>
  );
}
