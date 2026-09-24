import { Archive, Layers3, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BinderWhiteboard } from "@/lib/whiteboards/whiteboard-types";
import { MAX_WHITEBOARDS_PER_USER } from "@/lib/whiteboards/whiteboard-limits";

type WhiteboardBoardListProps = {
  boards: BinderWhiteboard[];
  activeBoardId: string | null;
  archiveActionsVisible?: boolean;
  compact?: boolean;
  onCreateBlankBoard?: () => void;
  onCreateScratchBoard?: () => void;
  onArchiveBoard?: (boardId: string) => void;
  onSelectBoard: (boardId: string) => void;
  showLimitStatus?: boolean;
};

export function WhiteboardBoardList({
  archiveActionsVisible,
  boards,
  activeBoardId,
  compact = false,
  onArchiveBoard,
  onCreateBlankBoard,
  onCreateScratchBoard,
  onSelectBoard,
  showLimitStatus = false,
}: WhiteboardBoardListProps) {
  const [query, setQuery] = useState("");
  const visibleBoards = boards.filter((board) => `${board.title} ${board.subject}`.toLowerCase().includes(query.trim().toLowerCase()));
  const shouldShowLimitStatus = !compact || showLimitStatus;
  const limitReached = boards.length >= MAX_WHITEBOARDS_PER_USER;
  const showScratchOption = compact && limitReached && Boolean(onCreateScratchBoard);
  const showArchiveActions = archiveActionsVisible ?? Boolean(onArchiveBoard);

  return (
    <div className="whiteboard-board-manager grid gap-2" data-testid="whiteboard-board-manager">
      <div className="whiteboard-sidebar-section-heading flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Layers3 className="size-3.5" />
          <span>Recent whiteboards</span>
        </p>
        {shouldShowLimitStatus ? (
          <Badge data-testid="whiteboard-board-count" variant="outline">
            {boards.length} / {MAX_WHITEBOARDS_PER_USER} saved
          </Badge>
        ) : null}
      </div>
      {showScratchOption ? (
        <div
          className="whiteboard-scratch-limit-state rounded-lg border border-primary/35 bg-primary/10 p-2 text-xs text-foreground"
          data-testid="whiteboard-scratch-limit-state"
        >
          <p className="font-semibold">3/3 whiteboards saved</p>
          <p className="mt-1 leading-5 text-muted-foreground">
            Open a scratch board without archiving or deleting real boards.
          </p>
          <Button
            className="mt-2 w-full justify-start"
            data-testid="whiteboard-open-scratch-board"
            onClick={onCreateScratchBoard}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Plus data-icon="inline-start" />
            Open scratch board
          </Button>
        </div>
      ) : null}
      {onCreateBlankBoard ? (
        <Button
          className="whiteboard-new-board-button justify-start"
          data-testid="whiteboard-new-blank-near-recent"
          onClick={showScratchOption && onCreateScratchBoard ? onCreateScratchBoard : onCreateBlankBoard}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus data-icon="inline-start" />
          New board
        </Button>
      ) : null}
      {(boards.length > 1 || query) && <input aria-label="Search whiteboards" className="rounded-md border border-border bg-background px-2 py-2 text-sm" type="search" placeholder="Find a board…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()} />}
      <div className={compact ? "grid gap-2" : "grid max-h-48 gap-2 overflow-auto pr-1"}>
        {boards.length === 0 ? (
          <p className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            No saved whiteboards yet.
          </p>
        ) : null}
        {boards.length > 0 && visibleBoards.length === 0 && <p role="status">No matching boards.</p>}
        {visibleBoards.map((board) => (
          <div
            className={`whiteboard-board-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-2 transition ${
              board.id === activeBoardId ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/70 bg-background/70"
            }`}
            key={board.id}
          >
            <button
              className="min-w-0 overflow-hidden text-left"
              data-testid={`whiteboard-open-${board.id}`}
              onClick={() => onSelectBoard(board.id)}
              aria-current={board.id === activeBoardId ? "true" : undefined}
              title={board.title}
              type="button"
            >
              {board.thumbnailDataUrl?.startsWith("data:image/") && <img src={board.thumbnailDataUrl} alt="" className="mb-1 h-12 w-full rounded object-contain" />}
              <span className="block truncate text-sm font-semibold">{board.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{board.objectCount} {board.objectCount === 1 ? "object" : "objects"}</span>
              <time className="block text-[10px] text-muted-foreground" dateTime={board.updatedAt}>Edited {new Date(board.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
            </button>
            {showArchiveActions && onArchiveBoard ? (
              <button
                aria-label={`Archive ${board.title}`}
                className="rounded-md border border-border/70 p-1.5 text-muted-foreground transition hover:border-primary/45 hover:text-foreground"
                data-testid={`whiteboard-archive-${board.id}`}
                onClick={() => onArchiveBoard(board.id)}
                type="button"
              >
                <Archive className="size-3.5" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
