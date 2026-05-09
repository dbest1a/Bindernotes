import { Archive, Layers3, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BinderWhiteboard } from "@/lib/whiteboards/whiteboard-types";
import { MAX_WHITEBOARDS_PER_USER } from "@/lib/whiteboards/whiteboard-limits";

type WhiteboardBoardListProps = {
  boards: BinderWhiteboard[];
  activeBoardId: string | null;
  compact?: boolean;
  onCreateBlankBoard?: () => void;
  onArchiveBoard?: (boardId: string) => void;
  onSelectBoard: (boardId: string) => void;
  showLimitStatus?: boolean;
};

export function WhiteboardBoardList({
  boards,
  activeBoardId,
  compact = false,
  onArchiveBoard,
  onCreateBlankBoard,
  onSelectBoard,
  showLimitStatus = false,
}: WhiteboardBoardListProps) {
  const shouldShowLimitStatus = !compact || showLimitStatus;

  return (
    <div className="grid gap-2" data-testid="whiteboard-board-manager">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Layers3 className="size-3.5" />
          Recent whiteboards
        </p>
        {shouldShowLimitStatus ? (
          <Badge data-testid="whiteboard-board-count" variant="outline">
            {boards.length} / {MAX_WHITEBOARDS_PER_USER}
          </Badge>
        ) : null}
      </div>
      {compact && onCreateBlankBoard ? (
        <Button
          className="justify-start"
          data-testid="whiteboard-new-blank-near-recent"
          onClick={onCreateBlankBoard}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus data-icon="inline-start" />
          New blank board
        </Button>
      ) : null}
      <div className={compact ? "grid gap-2" : "grid max-h-48 gap-2 overflow-auto pr-1"}>
        {boards.length === 0 ? (
          <p className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            No saved whiteboards yet.
          </p>
        ) : null}
        {boards.map((board) => (
          <div
            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-2 transition ${
              board.id === activeBoardId ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/70 bg-background/70"
            }`}
            key={board.id}
          >
            <button
              className="min-w-0 text-left"
              data-testid={`whiteboard-open-${board.id}`}
              onClick={() => onSelectBoard(board.id)}
              type="button"
            >
              <span className="block truncate text-sm font-semibold">{board.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{board.objectCount} objects</span>
            </button>
            {onArchiveBoard ? (
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
