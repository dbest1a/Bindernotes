import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WhiteboardCanvasActions } from "./whiteboard-canvas";
import type { BinderWhiteboard } from "@/lib/whiteboards/whiteboard-types";
import type { WhiteboardViewportTransform } from "@/lib/whiteboards/whiteboard-coordinate-utils";
import { getDrawingFrames, getFramesBounds, getWhiteboardModuleExportFrame, searchWhiteboard, fitWhiteboardFrames } from "@/lib/whiteboards/whiteboard-navigation";
import { downloadWhiteboardFile, serializeWhiteboardBackup, WHITEBOARD_EXPORT_SCOPE } from "@/lib/whiteboards/whiteboard-export";

type Bookmark = { name: string; viewport: WhiteboardViewportTransform };

function readBookmarks(key: string): Bookmark[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const names = new Set<string>();
    return parsed.filter((item): item is Bookmark => {
      if (!item || typeof item !== "object" || typeof item.name !== "string" || !item.name.trim() || names.has(item.name)) return false;
      if (!item.viewport || ![item.viewport.zoom, item.viewport.scrollX, item.viewport.scrollY].every(Number.isFinite) || item.viewport.zoom <= 0) return false;
      names.add(item.name);
      return true;
    }).slice(0, 20);
  } catch { return []; }
}

type Props = {
  board: BinderWhiteboard;
  getActions: () => WhiteboardCanvasActions | null;
  viewport: WhiteboardViewportTransform;
  onViewport: (viewport: WhiteboardViewportTransform) => void;
  sourceText: Record<string, string>;
  onStickyNote: () => void;
  onArrange: () => void;
};

export function WhiteboardStudyTools({ board, getActions, viewport, onViewport, sourceText, onStickyNote, onArrange }: Props) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [bookmarkName, setBookmarkName] = useState("");
  const [exporting, setExporting] = useState(false);
  const key = `bindernotes:whiteboard-bookmarks:${board.ownerId}:${board.id}`;
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => readBookmarks(key));
  useEffect(() => {
    setBookmarks(readBookmarks(key));
    setQuery("");
    setBookmarkName("");
    setMessage("");
  }, [key]);
  const current = { ...board, scene: getActions()?.getScene() ?? board.scene };
  const results = searchWhiteboard(current, query, sourceText);
  const frames = [...getDrawingFrames(current.scene.elements), ...board.modules.map((module) => getWhiteboardModuleExportFrame(module, viewport))];
  const bounds = getFramesBounds(frames);
  const mapBounds = { x: bounds.x - 40, y: bounds.y - 40, width: bounds.width + 80, height: bounds.height + 80 };
  const exportSvg = async () => {
    setExporting(true);
    setMessage("");
    try {
      const actions = getActions();
      if (!actions) throw new Error("The canvas is still loading. Try again shortly.");
      await actions.exportSvg(sourceText);
      setMessage("Board SVG downloaded.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Export failed. Your board is unchanged."); }
    finally { setExporting(false); }
  };
  return <details className="whiteboard-study-tools rounded-md border border-border p-2" onKeyDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()}>
    <summary className="cursor-pointer py-1 font-semibold">Navigate, organize & export</summary>
    <div className="mt-2 grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={() => {
          const actions = getActions();
          if (actions) actions.fitAll();
          else setMessage("The canvas is still loading. Try again shortly.");
        }}>Fit all content</Button>
        <Button size="sm" variant="outline" onClick={onStickyNote}>Add sticky note</Button>
        <Button size="sm" variant="outline" onClick={onArrange} disabled={!board.modules.length}>Arrange cards</Button>
        <Button size="sm" variant="outline" onClick={() => onViewport({ ...viewport, zoom: 1 })}>100% zoom</Button>
      </div>
      <label className="grid gap-1">Find text or a card
        <input className="rounded border border-border bg-background px-2 py-2" type="search" placeholder="Search drawings and lessons…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {query.trim() && <div className="grid max-h-36 gap-1 overflow-auto" aria-label="Board search results">
        {!results.length && <p role="status">No matching content.</p>}
        {results.map((result) => <button className="rounded border border-border p-2 text-left" key={`${result.kind}-${result.id}`} type="button" onClick={() => {
          const module = result.kind === "module" ? board.modules.find((item) => item.id === result.id) : null;
          onViewport(fitWhiteboardFrames([module ? getWhiteboardModuleExportFrame(module, viewport) : result.frame], viewport));
        }}>{result.label}</button>)}
      </div>}
      <svg role="img" aria-label="Board overview" className="h-24 w-full rounded border border-border bg-background" viewBox={`${mapBounds.x} ${mapBounds.y} ${mapBounds.width} ${mapBounds.height}`}>
        {frames.map((frame, index) => <rect key={index} {...frame} fill="#64748b" opacity="0.7" rx="3" />)}
        <rect x={-viewport.scrollX} y={-viewport.scrollY} width={viewport.viewportWidth / viewport.zoom} height={viewport.viewportHeight / viewport.zoom} fill="none" stroke="#38bdf8" strokeWidth={Math.max(mapBounds.width, mapBounds.height) / 100} />
      </svg>
      <label className="grid gap-1">Bookmark this view
        <input className="rounded border border-border bg-background px-2 py-2" maxLength={60} value={bookmarkName} onChange={(event) => setBookmarkName(event.target.value)} placeholder="e.g. Exam revision" />
      </label>
      <Button size="sm" variant="outline" disabled={!bookmarkName.trim() || (bookmarks.length >= 20 && !bookmarks.some((item) => item.name === bookmarkName.trim()))} onClick={() => {
        const next = [...bookmarks.filter((item) => item.name !== bookmarkName.trim()), { name: bookmarkName.trim(), viewport }].slice(0, 20);
        try { localStorage.setItem(key, JSON.stringify(next)); setBookmarks(next); setBookmarkName(""); setMessage("View saved on this device."); }
        catch { setMessage("This device could not save the bookmark."); }
      }}>Save view on this device</Button>
      {bookmarks.map((bookmark) => <div key={bookmark.name} className="flex gap-1"><button className="min-w-0 flex-1 truncate rounded border border-border p-2 text-left" type="button" onClick={() => onViewport({ ...viewport, scrollX: bookmark.viewport.scrollX, scrollY: bookmark.viewport.scrollY, zoom: bookmark.viewport.zoom })}>{bookmark.name}</button><button aria-label={`Remove bookmark ${bookmark.name}`} className="rounded border border-border px-3" type="button" onClick={() => { const next = bookmarks.filter((item) => item.name !== bookmark.name); try { localStorage.setItem(key, JSON.stringify(next)); setBookmarks(next); } catch { setMessage("Could not update bookmarks."); } }}>×</button></div>)}
      <Button size="sm" variant="outline" disabled={exporting} onClick={() => void exportSvg()}>{exporting ? "Exporting board…" : "Export board SVG"}</Button>
      <Button size="sm" variant="outline" onClick={() => {
        try { downloadWhiteboardFile(board.title, "json", serializeWhiteboardBackup({ ...board, scene: getActions()?.getScene() ?? board.scene }), "application/json"); setMessage("Board JSON backup downloaded."); }
        catch { setMessage("Could not export backup. Try again."); }
      }}>Download JSON backup</Button>
      <p className="text-[11px] leading-4 text-muted-foreground">{WHITEBOARD_EXPORT_SCOPE} The canvas Image menu exports drawings only.</p>
      {message && <p role="status" className="text-xs">{message}</p>}
    </div>
  </details>;
}
