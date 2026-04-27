import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eraser, MessageSquareText, Quote, Scale, Send, Sparkles, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildSelectionQuoteContext,
  createLessonSelection,
  selectionMatchesHighlight,
} from "@/lib/highlights";
import type { Highlight, HighlightColor, LessonTextSelection } from "@/types";

type SelectionAnchor = {
  left: number;
  top: number;
  placement: "above" | "below";
};

type SelectionState = {
  selection: LessonTextSelection;
  range: Range;
  anchor: SelectionAnchor;
};

export function LessonSelectionToolbar({
  containerSelector = "[data-lesson-content='true']",
  defaultHighlightColor,
  highlights,
  onHighlight,
  onRemoveHighlight,
  onSaveAsEvidence,
  onQuoteToNotes,
  onSendToNotes,
  onStickyNote,
  onCommentSelection,
}: {
  containerSelector?: string;
  defaultHighlightColor: HighlightColor;
  highlights: Highlight[];
  onHighlight: (selection: LessonTextSelection, color: HighlightColor) => void;
  onRemoveHighlight: (selection: LessonTextSelection, highlightIds: string[]) => void;
  onSaveAsEvidence?: (selection: LessonTextSelection) => void;
  onQuoteToNotes: (anchorText: string) => void;
  onSendToNotes: (anchorText: string) => void;
  onStickyNote: (anchorText: string) => void;
  onCommentSelection?: (selection: LessonTextSelection, body: string) => void;
}) {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const selectionRef = useRef<SelectionState | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const selectionHighlightIds = useMemo(() => {
    if (!selection) {
      return [];
    }

    const highlightIdsFromData = highlights
      .filter((highlight) => selectionMatchesHighlight(selection.selection, highlight))
      .map((highlight) => highlight.id);
    const highlightIdsFromDom = getIntersectingHighlightIds(selection.range, containerSelector);

    return Array.from(new Set([...highlightIdsFromData, ...highlightIdsFromDom]));
  }, [containerSelector, highlights, selection]);
  const hasSelectionHighlight = selectionHighlightIds.length > 0;
  const orderedHighlightButtons = [
    ...highlightButtons.filter((button) => button.color === defaultHighlightColor),
    ...highlightButtons.filter((button) => button.color !== defaultHighlightColor),
  ];

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const clearSelection = useCallback(() => {
    clearCurrentSelection();
    selectionRef.current = null;
    setCommentDraft("");
    setCommentOpen(false);
    setSelection(null);
  }, []);

  useEffect(() => {
    const syncSelection = () => {
      try {
        const next = readLessonSelection(containerSelector);
        if (next) {
          selectionRef.current = next;
          setSelection(next);
          return;
        }

        const preserved = refreshSelectionState(selectionRef.current, containerSelector);
        if (preserved) {
          selectionRef.current = preserved;
          setSelection(preserved);
          return;
        }

        selectionRef.current = null;
        setSelection(null);
      } catch {
        selectionRef.current = null;
        setSelection(null);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const root = document.querySelector(containerSelector);
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (toolbarRef.current?.contains(target)) {
        event.preventDefault();
        restoreSelection(selectionRef.current);
        return;
      }

      if (root?.contains(target)) {
        selectionRef.current = null;
        setSelection(null);
        return;
      }

      clearSelection();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearSelection();
      }
    };

    document.addEventListener("selectionchange", syncSelection);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", syncSelection, true);
    window.addEventListener("resize", syncSelection);
    document.addEventListener("fullscreenchange", syncSelection);

    return () => {
      document.removeEventListener("selectionchange", syncSelection);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", syncSelection, true);
      window.removeEventListener("resize", syncSelection);
      document.removeEventListener("fullscreenchange", syncSelection);
    };
  }, [clearSelection, containerSelector]);

  if (!selection) {
    return null;
  }

  const toolbarTransform =
    selection.anchor.placement === "above"
      ? "translate(-50%, calc(-100% - 12px))"
      : "translate(-50%, 12px)";

  const runSelectionAction = (action: (currentSelection: LessonTextSelection) => void) => {
    const currentSelection = selectionRef.current?.selection ?? selection.selection;
    action(currentSelection);
    clearSelection();
  };

  const openCommentComposer = () => {
    restoreSelection(selectionRef.current);
    setCommentOpen(true);
  };

  const submitComment = () => {
    const currentSelection = selectionRef.current?.selection ?? selection.selection;
    const body = commentDraft.trim();
    if (!body) {
      return;
    }

    if (onCommentSelection) {
      onCommentSelection(currentSelection, body);
    } else {
      onStickyNote(`${body}\n\n${currentSelection.text}`);
    }
    clearSelection();
  };

  const toolbar = (
    <div
      className="pointer-events-none fixed z-[70]"
      data-lesson-selection-toolbar="true"
      data-testid="whiteboard-annotation-popup"
      ref={toolbarRef}
      style={{
        left: selection.anchor.left,
        top: selection.anchor.top,
        transform: toolbarTransform,
      }}
    >
      <div className="pointer-events-auto flex max-w-[min(92vw,760px)] flex-wrap items-center gap-1 rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
        <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Highlight
        </span>
        {orderedHighlightButtons.map((button) => (
          <button
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-1.5 text-xs font-medium transition hover:border-primary/35 hover:bg-accent/60"
            key={button.color}
            onMouseDown={preserveSelection}
            onPointerDown={preserveSelection}
            onClick={() => {
              runSelectionAction((currentSelection) => onHighlight(currentSelection, button.color));
            }}
            type="button"
          >
            <span className={`size-2.5 rounded-full ${button.swatch}`} />
            {button.color === defaultHighlightColor ? `${button.label} default` : button.label}
          </button>
        ))}
        {hasSelectionHighlight ? (
          <Button
            onMouseDown={preserveSelection}
            onPointerDown={preserveSelection}
            onClick={() => {
              runSelectionAction((currentSelection) =>
                onRemoveHighlight(
                  currentSelection,
                  selectionHighlightIds,
                ),
              );
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <Eraser data-icon="inline-start" />
            De-highlight
          </Button>
        ) : null}
        <Button
          onMouseDown={preserveSelection}
          onPointerDown={preserveSelection}
          onClick={() => {
            runSelectionAction((currentSelection) => onStickyNote(currentSelection.text));
          }}
          size="sm"
          type="button"
        >
          <StickyNote data-icon="inline-start" />
          Sticky note
        </Button>
        <Button
          onMouseDown={preserveSelection}
          onPointerDown={preserveSelection}
          onClick={openCommentComposer}
          size="sm"
          type="button"
          variant="outline"
        >
          <MessageSquareText data-icon="inline-start" />
          Add comment
        </Button>
        <Button
          onMouseDown={preserveSelection}
          onPointerDown={preserveSelection}
          onClick={() => {
            runSelectionAction((currentSelection) => onSendToNotes(currentSelection.text));
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <Send data-icon="inline-start" />
          Add note
        </Button>
        <Button
          onMouseDown={preserveSelection}
          onPointerDown={preserveSelection}
          onClick={() => {
            runSelectionAction((currentSelection) => onQuoteToNotes(currentSelection.text));
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <Quote data-icon="inline-start" />
          Copy quote
        </Button>
        <Button
          disabled
          onMouseDown={preserveSelection}
          onPointerDown={preserveSelection}
          size="sm"
          title="Explanation notes are not available for this selection yet."
          type="button"
          variant="ghost"
        >
          <Sparkles data-icon="inline-start" />
          Explain this
        </Button>
        {onSaveAsEvidence ? (
          <Button
            onMouseDown={preserveSelection}
            onPointerDown={preserveSelection}
            onClick={() => {
              runSelectionAction((currentSelection) => onSaveAsEvidence(currentSelection));
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <Scale data-icon="inline-start" />
            Save as evidence
          </Button>
        ) : null}
        {commentOpen ? (
          <div
            className="mt-1 flex w-full min-w-[280px] items-center gap-2 rounded-xl border border-border/70 bg-background/95 p-2"
            onMouseDown={preserveSelection}
            onPointerDown={preserveSelection}
          >
            <Input
              aria-label="Comment"
              autoFocus
              className="h-9"
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitComment();
                }
              }}
              placeholder="Write a comment..."
              value={commentDraft}
            />
            <Button
              disabled={!commentDraft.trim()}
              onClick={submitComment}
              size="sm"
              type="button"
            >
              Save comment
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(toolbar, resolveToolbarPortalHost(containerSelector));
}

function readLessonSelection(containerSelector: string): SelectionState | null {
  const nativeSelection = window.getSelection();
  const text = nativeSelection?.toString().trim();
  if (!nativeSelection || !text || nativeSelection.rangeCount === 0 || nativeSelection.isCollapsed) {
    return null;
  }

  const root = document.querySelector(containerSelector);
  if (!root) {
    return null;
  }

  const range = nativeSelection.getRangeAt(0).cloneRange();
  if (!isRangeInsideRoot(range, root)) {
    return null;
  }

  const offsets = measureSelectionOffsets(root, range);
  if (!offsets) {
    return null;
  }

  const anchor = measureSelectionAnchor(range);
  if (!anchor) {
    return null;
  }

  const { prefixText, suffixText } = buildSelectionQuoteContext(
    root.textContent ?? "",
    offsets.startOffset,
    offsets.endOffset,
  );
  const blockId = findSelectionBlockId(root, range);

  return {
    selection: createLessonSelection(text, offsets.startOffset, offsets.endOffset, {
      prefixText,
      suffixText,
      blockId,
    }),
    range,
    anchor,
  };
}

function refreshSelectionState(
  selection: SelectionState | null,
  containerSelector: string,
): SelectionState | null {
  if (!selection) {
    return null;
  }

  const root = document.querySelector(containerSelector);
  if (!root || !isRangeInsideRoot(selection.range, root)) {
    return null;
  }

  let anchor: SelectionAnchor | null = null;
  try {
    anchor = measureSelectionAnchor(selection.range);
    if (!anchor) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    ...selection,
    range: selection.range.cloneRange(),
    anchor,
  };
}

function isRangeInsideRoot(range: Range, root: Element) {
  const commonAncestor =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

  return Boolean(commonAncestor && root.contains(commonAncestor));
}

function measureSelectionAnchor(range: Range): SelectionAnchor | null {
  const clientRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 || rect.height > 0,
  );
  const primaryRect = clientRects
    .slice()
    .sort((left, right) => left.top - right.top || left.left - right.left)[0];
  const fallbackRect = range.getBoundingClientRect();
  const rect =
    primaryRect && (primaryRect.width > 0 || primaryRect.height > 0)
      ? primaryRect
      : fallbackRect.width > 0 || fallbackRect.height > 0
        ? fallbackRect
        : null;

  if (!rect) {
    return null;
  }

  const maxToolbarWidth = Math.min(window.innerWidth * 0.92, 680);
  const horizontalInset = Math.min(24, maxToolbarWidth / 2);
  const left = clamp(
    rect.left + rect.width / 2,
    maxToolbarWidth / 2 + horizontalInset,
    window.innerWidth - maxToolbarWidth / 2 - horizontalInset,
  );
  const placeBelow = rect.top < 96;
  const top = placeBelow
    ? clamp(rect.bottom, 18, window.innerHeight - 18)
    : clamp(rect.top, 18, window.innerHeight - 18);

  return {
    left,
    top,
    placement: placeBelow ? "below" : "above",
  };
}

function measureSelectionOffsets(root: Element, range: Range) {
  const startOffset = resolveTextOffset(root, range.startContainer, range.startOffset);
  const endOffset = resolveTextOffset(root, range.endContainer, range.endOffset);

  if (startOffset === null || endOffset === null) {
    try {
      const startRange = document.createRange();
      startRange.selectNodeContents(root);
      startRange.setEnd(range.startContainer, range.startOffset);

      const endRange = document.createRange();
      endRange.selectNodeContents(root);
      endRange.setEnd(range.endContainer, range.endOffset);

      return {
        startOffset: startRange.toString().length,
        endOffset: endRange.toString().length,
      };
    } catch {
      return null;
    }
  }

  return {
    startOffset,
    endOffset,
  };
}

function resolveTextOffset(root: Element, container: Node, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const textLength = node.textContent?.length ?? 0;

    if (node === container) {
      return total + Math.min(offset, textLength);
    }

    if (container.nodeType === Node.ELEMENT_NODE && node.parentNode === container) {
      const childOffset = Array.from(container.childNodes)
        .slice(0, offset)
        .reduce((count, child) => count + measureTextLength(child), 0);
      return total + childOffset;
    }

    total += textLength;
  }

  return container === root ? total : null;
}

function measureTextLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.length ?? 0;
  }

  let total = 0;
  node.childNodes.forEach((child) => {
    total += measureTextLength(child);
  });
  return total;
}

function restoreSelection(selection: SelectionState | null) {
  if (!selection) {
    return;
  }

  const nextSelection = window.getSelection();
  if (!nextSelection) {
    return;
  }

  nextSelection.removeAllRanges();
  nextSelection.addRange(selection.range.cloneRange());
}

function clearCurrentSelection() {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
}

function findSelectionBlockId(root: Element, range: Range) {
  const node =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

  if (!node) {
    return root.getAttribute("data-lesson-id");
  }

  return (
    node.closest("[data-lesson-anchor]")?.getAttribute("data-lesson-anchor") ??
    root.getAttribute("data-lesson-id")
  );
}

export function resolveToolbarPortalHost(containerSelector: string) {
  const root = document.querySelector(containerSelector);
  const fullscreenHost = document.fullscreenElement;
  if (root && fullscreenHost instanceof HTMLElement && fullscreenHost.contains(root)) {
    return fullscreenHost;
  }

  return document.body;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getIntersectingHighlightIds(range: Range, containerSelector: string) {
  const root = document.querySelector(containerSelector);
  if (!root) {
    return [];
  }

  return Array.from(root.querySelectorAll<HTMLElement>("[data-highlight-id]"))
    .flatMap((element) => {
      const highlightId = element.dataset.highlightId;
      if (!highlightId) {
        return [];
      }

      try {
        return range.intersectsNode(element) ? [highlightId] : [];
      } catch {
        const elementRange = document.createRange();
        elementRange.selectNodeContents(element);
        return rangesIntersect(range, elementRange) ? [highlightId] : [];
      }
    });
}

function rangesIntersect(left: Range, right: Range) {
  return (
    left.compareBoundaryPoints(Range.END_TO_START, right) > 0 &&
    left.compareBoundaryPoints(Range.START_TO_END, right) < 0
  );
}

const highlightButtons: { color: HighlightColor; label: string; swatch: string }[] = [
  { color: "yellow", label: "Important", swatch: "bg-amber-400" },
  { color: "blue", label: "Definition", swatch: "bg-sky-500" },
  { color: "green", label: "Method", swatch: "bg-emerald-500" },
  { color: "pink", label: "Review", swatch: "bg-rose-400" },
  { color: "orange", label: "Question", swatch: "bg-orange-500" },
];

function preserveSelection(event: { preventDefault: () => void }) {
  event.preventDefault();
}
