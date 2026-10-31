import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

type NoteSaveAnnouncerProps = {
  autosaveStatus: "saved" | "saving" | "unsaved" | "offline" | "error";
  conflict: boolean;
  error: string | null;
};

/**
 * The single live region for a lesson note. Routine saving/saved cycles stay
 * silent; only problems a student must act on are announced.
 */
export function NoteSaveAnnouncer({ autosaveStatus, conflict, error }: NoteSaveAnnouncerProps) {
  const message = conflict
    ? "Another version of this note was saved. Your draft is still here; choose Keep both or Use latest."
    : autosaveStatus === "offline"
      ? "You're offline. Keep this tab open so your note can sync."
      : autosaveStatus === "error"
        ? `Note not saved. ${error ?? "Retry to keep this lesson note."}`
        : "";
  return <p aria-live="polite" className="sr-only" role="status">{message}</p>;
}

function focusIsLost(section: HTMLElement | null) {
  const active = document.activeElement;
  return !active || active === document.body || Boolean(section?.contains(active));
}

export function NoteRecoveryActions({ recovery }: { recovery: NoteRecoveryControls }) {
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const replaceTrigger = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const wasBusyRef = useRef(recovery.busy);
  useEffect(() => { if (!recovery.conflict || recovery.busy) setConfirmReplace(false); }, [recovery.conflict, recovery.busy]);
  useEffect(() => { if (confirmReplace) cancelButton.current?.focus(); }, [confirmReplace]);
  // When a recovery choice finishes, the button that started it is disabled or
  // removed. Put focus on the outcome instead of dropping it to the page body;
  // if the student moved on (for example, kept typing), announce it instead.
  useLayoutEffect(() => {
    const finished = wasBusyRef.current && !recovery.busy;
    wasBusyRef.current = recovery.busy;
    if (!finished || !recovery.message) return;
    if (focusIsLost(sectionRef.current) && messageRef.current) {
      messageRef.current.focus();
      setAnnouncement("");
    } else {
      setAnnouncement(recovery.message);
    }
  }, [recovery.busy, recovery.message]);
  useEffect(() => { if (!recovery.message) setAnnouncement(""); }, [recovery.message]);
  return (
    <section ref={sectionRef} aria-label="Note recovery" className="mt-3 rounded-xl border border-border bg-secondary/50 p-3 sm:p-4">
      {recovery.conflict ? <>
        <p className="text-sm font-semibold">Another version was saved</p>
        <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">
          Your draft is still in this editor. Keep both saves it as a separate Personal Note and loads the account version here.
        </p>
      </> : null}
      {recovery.message ? <p ref={messageRef} className="mt-1 rounded-md text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={-1}>{recovery.message}</p> : null}
      <p aria-live="polite" className="sr-only" role="status">{announcement}</p>
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
