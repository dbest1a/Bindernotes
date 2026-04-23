import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, Palette, Quote, Send, X } from "lucide-react";
import { createStickyNoteLayout } from "@/lib/workspace-preferences";
import { cn } from "@/lib/utils";
import type { Comment, StickyNoteLayout } from "@/types";

type WorkspaceStickyOverlayProps = {
  canvasHeight: number;
  canvasWidth: number;
  comments: Comment[];
  stickyLayouts: Record<string, StickyNoteLayout>;
  onDeleteSticky: (commentId: string) => void;
  onLayoutChange: (commentId: string, layout: StickyNoteLayout) => void;
  onSendToNotes: (comment: Comment) => void;
  onUpdateSticky: (commentId: string, body: string) => void;
};

const stickyColorClasses: Record<StickyNoteLayout["color"], string> = {
  amber:
    "border-amber-300/70 bg-[linear-gradient(180deg,rgba(255,248,195,0.96),rgba(253,230,138,0.9))] text-amber-950 dark:border-amber-200/25 dark:bg-[linear-gradient(180deg,rgba(120,84,18,0.95),rgba(82,56,12,0.9))] dark:text-amber-50",
  mint:
    "border-emerald-300/70 bg-[linear-gradient(180deg,rgba(220,252,231,0.96),rgba(167,243,208,0.9))] text-emerald-950 dark:border-emerald-200/25 dark:bg-[linear-gradient(180deg,rgba(17,94,89,0.95),rgba(19,78,74,0.9))] dark:text-emerald-50",
  sky:
    "border-sky-300/70 bg-[linear-gradient(180deg,rgba(224,242,254,0.96),rgba(186,230,253,0.9))] text-sky-950 dark:border-sky-200/25 dark:bg-[linear-gradient(180deg,rgba(12,74,110,0.95),rgba(14,116,144,0.9))] dark:text-sky-50",
  rose:
    "border-rose-300/70 bg-[linear-gradient(180deg,rgba(255,228,230,0.96),rgba(254,205,211,0.9))] text-rose-950 dark:border-rose-200/25 dark:bg-[linear-gradient(180deg,rgba(136,19,55,0.95),rgba(159,18,57,0.9))] dark:text-rose-50",
  violet:
    "border-violet-300/70 bg-[linear-gradient(180deg,rgba(245,243,255,0.96),rgba(221,214,254,0.9))] text-violet-950 dark:border-violet-200/25 dark:bg-[linear-gradient(180deg,rgba(76,29,149,0.95),rgba(91,33,182,0.9))] dark:text-violet-50",
};
const stickyColors: StickyNoteLayout["color"][] = ["amber", "mint", "sky", "rose", "violet"];

export const WorkspaceStickyOverlay = memo(function WorkspaceStickyOverlay({
  canvasHeight,
  canvasWidth,
  comments,
  stickyLayouts,
  onDeleteSticky,
  onLayoutChange,
  onSendToNotes,
  onUpdateSticky,
}: WorkspaceStickyOverlayProps) {
  const layoutsRef = useRef<Record<string, StickyNoteLayout>>({});
  const activeDragRef = useRef<string | null>(null);
  const pendingPersistRef = useRef(new Set<string>());
  const animationFrameRef = useRef<number | null>(null);
  const [layouts, setLayouts] = useState<Record<string, StickyNoteLayout>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setLayouts((current) => {
      const next = Object.fromEntries(
        comments.map((comment, index) => [
          comment.id,
          resolveIncomingLayout({
            currentLayout: current[comment.id],
            persistedLayout: stickyLayouts[comment.id],
            fallbackLayout: createStickyNoteLayout(index),
            isDragging: activeDragRef.current === comment.id,
            pendingPersist: pendingPersistRef.current.has(comment.id),
          }),
        ]),
      );
      layoutsRef.current = next;
      comments.forEach((comment) => {
        const persisted = stickyLayouts[comment.id];
        const currentLayout = next[comment.id];
        if (
          persisted &&
          currentLayout &&
          layoutsEqual(persisted, currentLayout)
        ) {
          pendingPersistRef.current.delete(comment.id);
        }
      });
      return next;
    });
    setDrafts((current) =>
      Object.fromEntries(
        comments.map((comment) => [comment.id, current[comment.id] ?? comment.body]),
      ),
    );
  }, [comments, stickyLayouts]);

  useEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  const scheduleLayoutRender = () => {
    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      setLayouts({ ...layoutsRef.current });
    });
  };

  const commitLayout = (commentId: string, nextLayout: StickyNoteLayout) => {
    pendingPersistRef.current.add(commentId);
    layoutsRef.current = {
      ...layoutsRef.current,
      [commentId]: nextLayout,
    };
    setLayouts((current) => ({
      ...current,
      [commentId]: nextLayout,
    }));
    onLayoutChange(commentId, nextLayout);
  };

  const mutateLayout = (
    commentId: string,
    updater: (layout: StickyNoteLayout) => StickyNoteLayout,
    persist = true,
  ) => {
    const base = layoutsRef.current[commentId];
    if (!base) {
      return;
    }
    const nextLayout = updater(base);
    layoutsRef.current = {
      ...layoutsRef.current,
      [commentId]: nextLayout,
    };
    if (persist) {
      commitLayout(commentId, nextLayout);
      return;
    }
    scheduleLayoutRender();
  };

  const bringToFront = (commentId: string, persist = false) => {
    const nextTopZ = Math.max(
      50,
      ...Object.values(layoutsRef.current).map((layout) => layout?.z ?? 50),
    );
    mutateLayout(commentId, (layout) => ({ ...layout, z: nextTopZ + 1 }), persist);
  };

  const beginDrag = (
    commentId: string,
    event: ReactPointerEvent<HTMLElement>,
    mode: "move" | "resize",
  ) => {
    event.preventDefault();
    activeDragRef.current = commentId;
    bringToFront(commentId, false);
    const startLayout = layoutsRef.current[commentId];
    if (!startLayout) {
      return;
    }
    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      mutateLayout(commentId, (layout) =>
        mode === "move"
          ? {
              ...layout,
              x: clamp(startLayout.x + dx, 0, canvasWidth - layout.w - 12),
              y: clamp(startLayout.y + dy, 0, canvasHeight - (layout.minimized ? 58 : layout.h) - 12),
            }
          : {
              ...layout,
              w: clamp(startLayout.w + dx, 210, 380),
              h: clamp(startLayout.h + dy, 150, 360),
            },
      false);
    };

    const onUp = () => {
      activeDragRef.current = null;
      const nextLayout = layoutsRef.current[commentId];
      if (nextLayout) {
        commitLayout(commentId, nextLayout);
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
    <div className="pointer-events-none absolute inset-0 z-40">
      {comments.map((comment, index) => {
        const layout = layouts[comment.id] ?? createStickyNoteLayout(index);
        const draft = drafts[comment.id] ?? comment.body;
        const isMinimized = Boolean(layout.minimized);
        return (
          <article
            className={cn(
              "sticky-note-card pointer-events-auto absolute overflow-hidden rounded-[22px] border shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur transition duration-150",
              stickyColorClasses[layout.color],
            )}
            key={comment.id}
            onPointerDown={(event) => {
              const target = event.target as HTMLElement;
              if (
                target.closest(
                  "button, textarea, input, select, a, [role='button'], [data-sticky-control='true']",
                )
              ) {
                return;
              }
              bringToFront(comment.id, false);
            }}
            style={{
              height: isMinimized ? 56 : layout.h,
              left: layout.x,
              top: layout.y,
              width: layout.w,
              zIndex: layout.z,
            }}
          >
            <div
              className="flex items-center justify-between gap-2 border-b border-black/10 px-3 py-2 dark:border-white/10"
              role="presentation"
            >
              <button
                className="sticky-note-handle flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-full px-1 py-0.5 text-left active:cursor-grabbing"
                data-sticky-control="true"
                onPointerDown={(event) => beginDrag(comment.id, event, "move")}
                type="button"
              >
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">
                  {comment.anchor_text ? "Anchored sticky" : "Workspace sticky"}
                </p>
              </button>
              <div className="relative z-10 flex items-center gap-1">
                <button
                  className="rounded-full p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
                  data-sticky-control="true"
                  onPointerDown={stopStickyControlEvent}
                  onClick={(event) => {
                    event.stopPropagation();
                    commitLayout(comment.id, {
                      ...layout,
                      color: stickyColors[(stickyColors.indexOf(layout.color) + 1) % stickyColors.length],
                    });
                  }}
                  type="button"
                >
                  <Palette className="size-3.5" />
                </button>
                <button
                  className="rounded-full p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
                  data-sticky-control="true"
                  onPointerDown={stopStickyControlEvent}
                  onClick={(event) => {
                    event.stopPropagation();
                    commitLayout(comment.id, {
                      ...layout,
                      minimized: !layout.minimized,
                    });
                  }}
                  type="button"
                >
                  {isMinimized ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                </button>
                <button
                  aria-label="Dismiss sticky note"
                  className="rounded-full p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
                  data-sticky-control="true"
                  onPointerDown={stopStickyControlEvent}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteSticky(comment.id);
                  }}
                  title="Dismiss sticky note"
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {!isMinimized ? (
              <div className="space-y-3 px-3 py-3">
                {comment.anchor_text ? (
                  <p className="flex items-start gap-2 text-xs leading-5 opacity-80">
                    <Quote className="mt-0.5 size-3.5 shrink-0" />
                    <span>"{comment.anchor_text}"</span>
                  </p>
                ) : null}

                <textarea
                  className="min-h-[88px] w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-current/55"
                  onBlur={() => {
                    if (draft.trim() !== comment.body.trim()) {
                      onUpdateSticky(comment.id, draft.trim() || "New sticky note");
                    }
                  }}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [comment.id]: event.target.value }))
                  }
                  placeholder="Write a quick idea, reminder, or question."
                  value={draft}
                />

                <div className="flex items-center justify-between gap-2 text-xs opacity-80">
                  <span>{comment.anchor_text ? "Linked to lesson text" : "Free-floating note"}</span>
                  <button
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2 py-1 font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                  data-sticky-control="true"
                  onPointerDown={stopStickyControlEvent}
                  onClick={() => onSendToNotes(comment)}
                  type="button"
                >
                    <Send className="size-3" />
                    Send to notes
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-3 py-2 text-xs opacity-80">
                {comment.body || "Minimized sticky note"}
              </div>
            )}

            {!isMinimized ? (
              <button
                className="absolute bottom-1.5 right-1.5 size-5 cursor-nwse-resize rounded-full border border-black/10 bg-white/55 text-black/60 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/20 dark:text-white/60"
                data-sticky-control="true"
                onPointerDown={(event) => {
                  stopStickyControlEvent(event);
                  beginDrag(comment.id, event, "resize");
                }}
                type="button"
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function stopStickyControlEvent(event: Pick<ReactPointerEvent<HTMLElement>, "preventDefault" | "stopPropagation">) {
  event.preventDefault();
  event.stopPropagation();
}

function resolveIncomingLayout({
  currentLayout,
  persistedLayout,
  fallbackLayout,
  isDragging,
  pendingPersist,
}: {
  currentLayout?: StickyNoteLayout;
  persistedLayout?: StickyNoteLayout;
  fallbackLayout: StickyNoteLayout;
  isDragging: boolean;
  pendingPersist: boolean;
}) {
  if ((isDragging || pendingPersist) && currentLayout) {
    return currentLayout;
  }

  return persistedLayout ?? currentLayout ?? fallbackLayout;
}

function layoutsEqual(left: StickyNoteLayout, right: StickyNoteLayout) {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.w === right.w &&
    left.h === right.h &&
    left.z === right.z &&
    left.minimized === right.minimized &&
    left.color === right.color
  );
}
