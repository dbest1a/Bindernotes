import { useEffect, useRef, useState } from "react";
import { Copy, Download, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type NoteRecoveryControls = {
  conflict: boolean;
  busy: boolean;
  message: string | null;
  copyUrl: string | null;
  onKeepBoth: () => void;
  onUseLatest: () => void;
  onDownload: () => void;
};

export function NoteRecoveryActions({ recovery }: { recovery: NoteRecoveryControls }) {
  const [confirmReplace, setConfirmReplace] = useState(false);
  const replaceTrigger = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!recovery.conflict || recovery.busy) setConfirmReplace(false); }, [recovery.conflict, recovery.busy]);
  useEffect(() => { if (confirmReplace) cancelButton.current?.focus(); }, [confirmReplace]);
  return (
    <section aria-label="Note recovery" className="mt-3 rounded-xl border border-border bg-secondary/50 p-3 sm:p-4">
      {recovery.conflict ? <>
        <p className="text-sm font-semibold">Another version was saved</p>
        <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">
          Your draft is still in this editor. Keep both saves it as a separate Personal Note and loads the account version here.
        </p>
      </> : null}
      {recovery.message ? <p role="status" className="mt-1 text-sm leading-6">{recovery.message}</p> : null}
      {recovery.copyUrl ? <a className="mt-2 inline-flex min-h-10 items-center rounded-md text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={recovery.copyUrl}>Open saved copy in Personal Notes</a> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {recovery.conflict ? <>
          <Button disabled={recovery.busy} onClick={recovery.onKeepBoth} type="button"><Copy data-icon="inline-start" />{recovery.busy ? "Working…" : "Keep both"}</Button>
          <Button ref={replaceTrigger} disabled={recovery.busy} aria-expanded={confirmReplace} onClick={() => setConfirmReplace(true)} type="button" variant="outline"><RefreshCcw data-icon="inline-start" />Use latest…</Button>
        </> : null}
        <Button onClick={recovery.onDownload} type="button" variant="outline"><Download data-icon="inline-start" />Download draft (.json)</Button>
      </div>
      {confirmReplace ? <div className="mt-3 rounded-lg border border-border bg-background p-3">
        <p className="text-sm leading-6">Replace this editor's draft with the latest account version? Download your draft first if you want to keep it.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={recovery.onUseLatest} type="button" variant="destructive">Replace my draft</Button>
          <Button ref={cancelButton} onClick={() => { setConfirmReplace(false); replaceTrigger.current?.focus(); }} type="button" variant="outline">Cancel</Button>
        </div>
      </div> : null}
    </section>
  );
}
