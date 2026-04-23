import { useEffect, useMemo, useRef, useState } from "react";
import { Pin, Plus, Quote } from "lucide-react";
import { createStickyNoteLayout } from "@/lib/workspace-preferences";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Comment, StickyNoteLayout } from "@/types";

type StickyNotesBoardProps = {
  comments: Comment[];
  draft: string;
  pendingAnchor: string | null;
  stickyLayouts: Record<string, StickyNoteLayout>;
  onAddSticky: () => void;
  onClearPendingAnchor: () => void;
  onDraftChange: (value: string) => void;
  onMoveSticky: (commentId: string, layout: StickyNoteLayout) => void;
};

const noteTintClasses: Record<StickyNoteLayout["color"], string> = {
  amber:
    "border-amber-300/70 bg-[linear-gradient(180deg,rgba(255,248,195,0.95),rgba(253,230,138,0.92))] text-amber-950 dark:border-amber-200/25 dark:bg-[linear-gradient(180deg,rgba(120,84,18,0.9),rgba(82,56,12,0.88))] dark:text-amber-50",
  mint:
    "border-emerald-300/70 bg-[linear-gradient(180deg,rgba(220,252,231,0.95),rgba(167,243,208,0.92))] text-emerald-950 dark:border-emerald-200/25 dark:bg-[linear-gradient(180deg,rgba(19,78,74,0.92),rgba(17,94,89,0.88))] dark:text-emerald-50",
  sky:
    "border-sky-300/70 bg-[linear-gradient(180deg,rgba(224,242,254,0.95),rgba(186,230,253,0.92))] text-sky-950 dark:border-sky-200/25 dark:bg-[linear-gradient(180deg,rgba(12,74,110,0.92),rgba(14,116,144,0.88))] dark:text-sky-50",
  rose:
    "border-rose-300/70 bg-[linear-gradient(180deg,rgba(255,228,230,0.96),rgba(254,205,211,0.92))] text-rose-950 dark:border-rose-200/25 dark:bg-[linear-gradient(180deg,rgba(136,19,55,0.9),rgba(159,18,57,0.88))] dark:text-rose-50",
  violet:
    "border-violet-300/70 bg-[linear-gradient(180deg,rgba(245,243,255,0.95),rgba(221,214,254,0.92))] text-violet-950 dark:border-violet-200/25 dark:bg-[linear-gradient(180deg,rgba(76,29,149,0.9),rgba(91,33,182,0.88))] dark:text-violet-50",
};

export function StickyNotesBoard({
  comments,
  draft,
  pendingAnchor,
  stickyLayouts,
  onAddSticky,
  onClearPendingAnchor,
  onDraftChange,
  onMoveSticky,
}: StickyNotesBoardProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const positionsRef = useRef<Record<string, StickyNoteLayout>>({});
  const [positions, setPositions] = useState<Record<string, StickyNoteLayout>>({});

  useEffect(() => {
    setPositions((current) => {
      const next = Object.fromEntries(
        comments.map((comment, index) => [
          comment.id,
          stickyLayouts[comment.id] ?? current[comment.id] ?? createStickyNoteLayout(index),
        ]),
      );
      positionsRef.current = next;
      return next;
    });
  }, [comments, stickyLayouts]);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  const orderedComments = useMemo(
    () =>
      [...comments].sort((left, right) => {
        const leftPos = positions[left.id] ?? createStickyNoteLayout(0);
        const rightPos = positions[right.id] ?? createStickyNoteLayout(0);
        return leftPos.y - rightPos.y || leftPos.x - rightPos.x;
      }),
    [comments, positions],
  );

  const startDrag = (commentId: string, event: React.PointerEvent<HTMLDivElement>) => {
    const board = boardRef.current;
    const current = positionsRef.current[commentId];
    if (!board || !current) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const boardRect = board.getBoundingClientRect();

    const onMove = (moveEvent: PointerEvent) => {
      const x = clamp(current.x + moveEvent.clientX - startX, 0, boardRect.width - 248);
      const y = clamp(current.y + moveEvent.clientY - startY, 0, Math.max(0, boardRect.height - 208));
      setPositions((existing) => {
        const next = {
          ...existing,
          [commentId]: { ...existing[commentId], x, y },
        };
        positionsRef.current = next;
        return next;
      });
    };

    const onUp = () => {
      const next = positionsRef.current[commentId];
      if (next) {
        onMoveSticky(commentId, next);
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-background/70 p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-tight">Drop a sticky note into the workspace</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Select lesson text to anchor a sticky note, or leave a loose note for yourself.
            </p>
          </div>
          {pendingAnchor ? (
            <button
              className="rounded-full border border-border/70 bg-secondary/80 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
              onClick={onClearPendingAnchor}
              type="button"
            >
              Clear anchor
            </button>
          ) : null}
        </div>
        {pendingAnchor ? (
          <div className="mt-3 rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-sm text-muted-foreground">
            <span className="mr-2 inline-flex items-center gap-1 font-medium text-foreground">
              <Pin className="size-3.5" />
              Anchored to
            </span>
            "{pendingAnchor}"
          </div>
        ) : null}
        <Textarea
          className="mt-3 min-h-24 resize-none border-border/70 bg-card/85"
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={
            pendingAnchor
              ? "Capture the key idea, confusion, or reminder."
              : "Add a loose sticky note for this lesson."
          }
          value={draft}
        />
        <div className="mt-3 flex justify-end">
          <Button onClick={onAddSticky} type="button">
            <Plus data-icon="inline-start" />
            Add sticky
          </Button>
        </div>
      </div>

      <div
        className="relative min-h-[360px] flex-1 overflow-hidden rounded-2xl border border-border/70 bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.14),transparent_30%),linear-gradient(180deg,hsl(var(--background)/0.9),hsl(var(--secondary)/0.4))] p-4"
        ref={boardRef}
      >
        {orderedComments.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="max-w-sm">
              <p className="text-base font-semibold tracking-tight">No sticky notes yet</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Highlight a line from the lesson or drop a quick note here to start building your study board.
              </p>
            </div>
          </div>
        ) : null}

        {orderedComments.map((comment, index) => {
          const position = positions[comment.id] ?? createStickyNoteLayout(index);
          return (
            <article
              className={cn(
                "absolute w-56 rounded-2xl border p-0 shadow-[0_16px_30px_rgba(15,23,42,0.12)] transition-transform duration-150 hover:-translate-y-1",
                noteTintClasses[position.color],
              )}
              key={comment.id}
              style={{ left: position.x, top: position.y }}
            >
              <div
                className="sticky-note-handle flex cursor-grab items-center justify-between gap-3 rounded-t-2xl border-b border-black/10 px-3 py-2 active:cursor-grabbing dark:border-white/10"
                onPointerDown={(event) => startDrag(comment.id, event)}
                role="presentation"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                  Sticky
                </span>
                <Pin className="size-3.5 opacity-65" />
              </div>
              <div className="space-y-3 px-3 py-3">
                {comment.anchor_text ? (
                  <p className="flex items-start gap-2 text-xs leading-5 opacity-80">
                    <Quote className="mt-0.5 size-3.5 shrink-0" />
                    <span>"{comment.anchor_text}"</span>
                  </p>
                ) : null}
                <p className="text-sm leading-6">{comment.body}</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
