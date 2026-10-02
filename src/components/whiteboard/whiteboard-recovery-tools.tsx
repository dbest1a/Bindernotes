import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { parseWhiteboardBackup } from "@/lib/whiteboards/whiteboard-import";
import { importWhiteboard, listArchivedWhiteboards, openLatestWhiteboardKeepingDraft, restoreArchivedWhiteboard } from "@/lib/whiteboards/whiteboard-storage";
import type { BinderWhiteboard, WhiteboardScope } from "@/lib/whiteboards/whiteboard-types";
import { MAX_SCENE_SIZE_BYTES } from "@/lib/whiteboards/whiteboard-limits";

export function WhiteboardRecoveryTools({ scope, scopeOnly = false, conflictedBoard, onRecovered }: { scope: WhiteboardScope; scopeOnly?: boolean; conflictedBoard?: BinderWhiteboard; onRecovered: (board: BinderWhiteboard) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archived, setArchived] = useState<BinderWhiteboard[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const loadArchive = async () => {
    setBusy(true);
    try {
      const result = await listArchivedWhiteboards(scope);
      const boards = result.boards.filter((board) => !scopeOnly || (board.binderId === scope.binderId && (board.lessonId ?? null) === (scope.lessonId ?? null)));
      setArchived(boards);
      setMessage(result.status === "error" ? result.message : boards.length ? "" : "No archived boards.");
    } catch { setMessage("Could not load the archive. Try again."); }
    finally { setBusy(false); }
  };
  const recover = async (operation: () => ReturnType<typeof importWhiteboard>) => {
    setBusy(true);
    setMessage("");
    try {
      const result = await operation();
      if (["error", "limit", "storage-limit"].includes(result.status)) { setMessage(result.message); return; }
      setArchived((current) => current.filter((item) => item.id !== result.board.id));
      onRecovered(result.board);
      setMessage(`${result.status === "saved" ? "Restored to your account." : result.message} Linked lessons must be accessible in this account; unavailable sources can be relinked from the card.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Restore failed. Existing boards are unchanged."); }
    finally { setBusy(false); }
  };
  return <details className="rounded-md border border-border p-2" onKeyDown={(event) => event.stopPropagation()} onToggle={(event) => { if (event.currentTarget.open) void loadArchive(); }}>
    <summary className="cursor-pointer py-1 font-semibold">Archive & restore backup</summary>
    <div className="mt-2 grid gap-2">
      <p className="text-xs text-muted-foreground">Restore an archived board or import a JSON backup as a new board. Existing boards are kept.</p>
      <input ref={inputRef} aria-label="Whiteboard JSON backup" className="sr-only" type="file" accept=".json,application/json" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        void recover(async () => {
          if (file.size > MAX_SCENE_SIZE_BYTES * 2) throw new Error("This backup is too large to import.");
          const board = parseWhiteboardBackup(await file.text(), scope);
          return importWhiteboard(board);
        });
      }} />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>Import JSON backup</Button>
      {conflictedBoard && <div className="grid gap-2 rounded border border-border p-2 text-xs">
        <p>A newer account version exists. Keep your current draft in this device's archive before loading it.</p>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void recover(() => openLatestWhiteboardKeepingDraft(conflictedBoard))}>Keep draft & load latest</Button>
      </div>}
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void loadArchive()}>Refresh archive</Button>
      <div className="grid max-h-56 gap-2 overflow-auto">
        {archived.map((board) => <div className="flex items-center gap-2 rounded border border-border p-2" key={board.id}>
          <span className="min-w-0 flex-1 break-words text-xs">{board.title}</span>
          <Button size="sm" variant="outline" disabled={busy} aria-label={`Restore ${board.title}`} onClick={() => void recover(() => restoreArchivedWhiteboard(scope, board))}>Restore</Button>
        </div>)}
      </div>
      {busy && <p role="status" className="text-xs">Working…</p>}
      {message && <p role="status" className="text-xs">{message}</p>}
    </div>
  </details>;
}
