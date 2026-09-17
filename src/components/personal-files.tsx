import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { listPrivateAssets, privateAssetDownloadUrl, removePrivateAsset, uploadPrivateAsset } from "@/services/private-assets-service";
import type { PrivateAsset } from "@/lib/user-assets";
export function PersonalFiles({ ownerId }: { ownerId: string }) {
  return import.meta.env.VITE_PRIVATE_ASSETS_ENABLED === "true" ? <PrivateFiles key={ownerId} ownerId={ownerId} /> : null;
}
function PrivateFiles({ ownerId }: { ownerId: string }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null); const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ asset: PrivateAsset; url: string } | null>(null);
  const abort = useRef<AbortController | null>(null); const mounted = useRef(true);
  const queryClient = useQueryClient(); const queryKey = ["private-assets", ownerId];
  const query = useQuery({ queryKey, queryFn: () => listPrivateAssets(ownerId), enabled: open });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort(); }; }, []);
  async function upload(file: File) {
    const controller = new AbortController(); abort.current = controller; setBusy(true); setProgress(0); setError(null);
    try { await uploadPrivateAsset(ownerId, file, { signal: controller.signal, onProgress: bytes => { if (mounted.current) setProgress(Math.round(bytes / file.size * 100)); } }); }
    catch (cause) { if (mounted.current) setError(controller.signal.aborted ? "Upload paused. Select the same file to resume." : cause instanceof Error ? cause.message : "Upload failed. Select the same file to retry."); }
    finally { if (mounted.current) { setBusy(false); await queryClient.invalidateQueries({ queryKey }); } }
  }
  async function act(asset: PrivateAsset, action: "preview" | "delete") {
    setError(null);
    try {
      if (action === "delete") { await removePrivateAsset(asset); setDeleting(null); setPreview(null); await queryClient.invalidateQueries({ queryKey }); }
      else setPreview({ asset, url: await privateAssetDownloadUrl(asset, false) });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The file service is unavailable. Try again."); }
  }
  return <details className="relative" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded border px-2 py-1.5 text-sm">Files / PDF</summary>
    {open && <section aria-label="Private files and PDF import" className="absolute right-0 top-full z-50 mt-2 max-h-[75vh] w-[min(36rem,90vw)] overflow-auto rounded-lg border bg-background p-4 shadow-xl">
      <h2 className="font-semibold">Private files</h2><p className="my-2 text-sm">Import PDF, PNG, JPEG or WebP files up to 50 MiB. Files remain private to this account. PDF text extraction is not included.</p>
      <label className="block text-sm">Import a PDF or image<input className="my-2 block w-full" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} /></label>
      {busy && <div role="status">Uploading {progress}% <Button size="sm" variant="outline" onClick={() => abort.current?.abort()}>Pause</Button></div>}
      {(error || query.error) && <p role="alert" className="my-2 text-sm">{error ?? "Private files could not be loaded."}</p>}
      {query.isLoading ? <p role="status">Loading files…</p> : <ul className="space-y-2">{query.data?.map(asset => <li key={asset.id} className="rounded border p-2 text-sm">
        <span className="break-words">{asset.name}</span> <span className="text-muted-foreground">{(asset.size_bytes / 1048576).toFixed(1)} MiB · {asset.status}</span>
        <div className="mt-1 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={asset.status !== "ready" || busy} onClick={() => void act(asset, "preview")}>Open</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setDeleting(asset.id)}>Remove file</Button>
          {deleting === asset.id && <Button size="sm" variant="destructive" disabled={busy} onClick={() => void act(asset, "delete")}>Confirm permanent file removal</Button>}</div>
        {asset.status === "pending" && <p className="mt-1">Select the same file above to resume an interrupted upload.</p>}
      </li>)}</ul>}
      {preview && <div className="mt-3"><a className="text-sm underline" href={preview.url} target="_blank" rel="noopener noreferrer">Open {preview.asset.name} in a separate tab</a>
        {preview.asset.mime_type === "application/pdf" ? <iframe title={preview.asset.name} src={preview.url} className="mt-2 h-80 w-full rounded border" /> : <img className="mt-2 max-h-80 max-w-full" src={preview.url} alt={preview.asset.name} />}</div>}
    </section>}
  </details>;
}
