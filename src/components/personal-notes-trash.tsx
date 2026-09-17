import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/query-keys";
import { listPersonalTrash, setPersonalTrash, type PersonalTrashKind } from "@/services/personal-trash-service";
import type { PersonalNotesData } from "@/types";

export function PersonalNotesTrash({ ownerId, data, hasUnsavedChanges }: { ownerId: string; data: PersonalNotesData | undefined; hasUnsavedChanges: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const queryClient = useQueryClient();
  const queryKey = ["personal-trash", ownerId];
  const trash = useQuery({ queryKey, queryFn: listPersonalTrash, enabled: open });
  const mutation = useMutation({
    mutationFn: ({ kind, id, action }: { kind: PersonalTrashKind; id: string; action: "trash" | "restore" | "delete" }) => setPersonalTrash(kind, id, action, action === "delete" ? confirmation : undefined),
    onSuccess: async () => {
      setDeleting(null); setConfirmation(""); setSelected("");
      await Promise.all([queryClient.invalidateQueries({ queryKey }), queryClient.invalidateQueries({ queryKey: queryKeys.personalNotes.forProfile(ownerId) })]);
    },
  });
  const active = [
    ...(data?.personalFolders ?? []).map((item) => ({ kind: "folder" as const, id: item.id, title: item.name })),
    ...(data?.personalBinders ?? []).map((item) => ({ kind: "binder" as const, id: item.id, title: item.title })),
    ...(data?.personalDocuments ?? []).map((item) => ({ kind: "document" as const, id: item.id, title: item.title })),
    ...(data?.personalNotes ?? []).map((item) => ({ kind: "note" as const, id: item.id, title: item.title })),
  ];
  const error = mutation.error ?? trash.error;
  return <details className="relative" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded-md border px-2 py-1.5 text-sm">Trash</summary>
    {open && <section aria-label="Personal Notes trash" className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[min(28rem,90vw)] overflow-auto rounded-xl border bg-background p-4 shadow-xl">
      <h2 className="font-semibold">Trash and restore</h2>
      <p className="my-2 text-sm text-muted-foreground">Items stay in trash until you permanently delete them. Restoring a folder or course keeps its documents and links.</p>
      {hasUnsavedChanges && <p role="status" className="my-2 text-sm">Save or recover your current changes before moving or permanently deleting items.</p>}
      <label className="block text-sm">Move an item to trash
        <select aria-label="Item to move to trash" className="my-2 w-full rounded border bg-background p-2" value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Choose an item</option>
          {active.map((item) => <option key={item.id} value={`${item.kind}:${item.id}`}>{item.kind === "binder" ? "course" : item.kind}: {item.title}</option>)}
        </select>
      </label>
      <Button size="sm" variant="outline" disabled={!selected || mutation.isPending || hasUnsavedChanges} onClick={() => {
        const item = active.find((candidate) => `${candidate.kind}:${candidate.id}` === selected);
        if (item) mutation.mutate({ ...item, action: "trash" });
      }}>Move to trash</Button>
      {error && <p role="alert" className="my-2 text-sm">{error instanceof Error ? error.message : "This change failed. Try again."}</p>}
      {trash.isLoading ? <p role="status">Loading trash…</p> : !trash.data?.length ? <p className="mt-4 text-sm">Trash is empty.</p> : <ul className="mt-4 space-y-3">
        {trash.data.map((item) => <li className="rounded border p-2" key={`${item.kind}:${item.id}`}>
          <p className="break-words text-sm font-medium">{item.title} <span className="font-normal text-muted-foreground">({item.kind === "binder" ? "course" : item.kind})</span></p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ ...item, action: "restore" })}>Restore</Button>
            <Button size="sm" variant="outline" disabled={mutation.isPending || hasUnsavedChanges} onClick={() => { setDeleting(item.id); setConfirmation(""); }}>Delete permanently</Button>
          </div>
          {deleting === item.id && <form className="mt-2 text-sm" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ ...item, action: "delete" }); }}>
            <p>This permanently deletes this item and all its contained documents and notes.</p>
            <label>Type DELETE to confirm<input aria-label="Permanent deletion confirmation" autoComplete="off" className="my-2 w-full rounded border bg-background p-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <Button size="sm" variant="destructive" disabled={confirmation !== "DELETE" || mutation.isPending || hasUnsavedChanges}>Confirm permanent deletion</Button>
          </form>}
        </li>)}
      </ul>}
    </section>}
  </details>;
}
