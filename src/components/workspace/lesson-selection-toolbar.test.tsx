// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLessonContentSelector } from "@/components/workspace/lesson-content-renderer";
import { LessonSelectionToolbar, resolveToolbarPortalHost } from "@/components/workspace/lesson-selection-toolbar";
import type { LessonTextSelection } from "@/types";

describe("lesson selection toolbar helpers", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    window.getSelection()?.removeAllRanges();
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
  });

  it("builds a lesson-specific content selector", () => {
    expect(buildLessonContentSelector("lesson-rome-origins")).toBe(
      `[data-lesson-content="true"][data-lesson-id="lesson-rome-origins"]`,
    );
    expect(buildLessonContentSelector()).toBe(`[data-lesson-content="true"]`);
  });

  it("builds a module-scoped selector for duplicated whiteboard lesson cards", () => {
    expect(buildLessonContentSelector("lesson-1", "whiteboard-module-2")).toBe(
      `[data-lesson-content="true"][data-lesson-id="lesson-1"][data-whiteboard-module-id="whiteboard-module-2"]`,
    );
  });

  it("uses the document body when the lesson is not inside fullscreen", () => {
    document.body.innerHTML = `<div data-lesson-content="true" data-lesson-id="lesson-1"></div>`;

    expect(resolveToolbarPortalHost(buildLessonContentSelector("lesson-1"))).toBe(document.body);
  });

  it("uses the fullscreen host when the lesson surface is inside it", () => {
    const fullscreenHost = document.createElement("section");
    const lessonRoot = document.createElement("div");
    lessonRoot.setAttribute("data-lesson-content", "true");
    lessonRoot.setAttribute("data-lesson-id", "lesson-1");
    fullscreenHost.appendChild(lessonRoot);
    document.body.appendChild(fullscreenHost);

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: fullscreenHost,
    });

    expect(resolveToolbarPortalHost(buildLessonContentSelector("lesson-1"))).toBe(fullscreenHost);
  });

  it("opens the annotation popup for selected text inside the scoped whiteboard source module", async () => {
    const restoreRange = installSelectionRect();
    try {
      const onHighlight = vi.fn();
      render(
        <>
          <div data-lesson-content="true" data-lesson-id="lesson-1" data-whiteboard-module-id="source-one">
            First duplicate lesson.
          </div>
          <div data-lesson-content="true" data-lesson-id="lesson-1" data-whiteboard-module-id="source-two">
            <span>Second selectable quote</span>
          </div>
          <LessonSelectionToolbar
            containerSelector={buildLessonContentSelector("lesson-1", "source-two")}
            defaultHighlightColor="yellow"
            highlights={[]}
            onHighlight={onHighlight}
            onQuoteToNotes={vi.fn()}
            onRemoveHighlight={vi.fn()}
            onSendToNotes={vi.fn()}
            onStickyNote={vi.fn()}
          />
        </>,
      );

      selectText("Second selectable quote");
      document.dispatchEvent(new Event("selectionchange"));

      expect(await screen.findByTestId("whiteboard-annotation-popup")).toBeTruthy();
      expect(screen.getByText("Highlight")).toBeTruthy();
    } finally {
      restoreRange();
    }
  });

  it("renders above the full-screen whiteboard shell instead of underneath it", async () => {
    const restoreRange = installSelectionRect();
    try {
      renderSelectionToolbar({});
      selectText("Second selectable quote");
      document.dispatchEvent(new Event("selectionchange"));

      expect((await screen.findByTestId("whiteboard-annotation-popup")).className).toContain("z-[2147483647]");
    } finally {
      restoreRange();
    }
  });

  it("routes add note and copy quote actions from the annotation popup", async () => {
    const onSendToNotes = vi.fn();
    const onQuoteToNotes = vi.fn();
    const restoreRange = installSelectionRect();

    try {
      renderSelectionToolbar({ onQuoteToNotes, onSendToNotes });
      selectText("Second selectable quote");
      document.dispatchEvent(new Event("selectionchange"));

      await screen.findByTestId("whiteboard-annotation-popup");
      fireEvent.click(screen.getByRole("button", { name: /add note/i }));
      expect(onSendToNotes).toHaveBeenCalledWith("Second selectable quote");

      selectText("Second selectable quote");
      document.dispatchEvent(new Event("selectionchange"));

      await screen.findByTestId("whiteboard-annotation-popup");
      fireEvent.click(screen.getByRole("button", { name: /copy quote/i }));
      expect(onQuoteToNotes).toHaveBeenCalledWith("Second selectable quote");
    } finally {
      restoreRange();
    }
  });

  it("saves a comment through the annotation popup instead of silently doing nothing", async () => {
    const onCommentSelection = vi.fn();
    const restoreRange = installSelectionRect();

    try {
      renderSelectionToolbar({ onCommentSelection });
      selectText("Second selectable quote");
      document.dispatchEvent(new Event("selectionchange"));

      await screen.findByTestId("whiteboard-annotation-popup");
      fireEvent.click(screen.getByRole("button", { name: /add comment/i }));
      fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "This is the key step." } });
      fireEvent.click(screen.getByRole("button", { name: /save comment/i }));

      expect(onCommentSelection).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Second selectable quote" }),
        "This is the key step.",
      );
    } finally {
      restoreRange();
    }
  });
});

function renderSelectionToolbar({
  onCommentSelection = vi.fn(),
  onQuoteToNotes = vi.fn(),
  onSendToNotes = vi.fn(),
}: {
  onCommentSelection?: (selection: LessonTextSelection, body: string) => void;
  onQuoteToNotes?: (anchorText: string) => void;
  onSendToNotes?: (anchorText: string) => void;
}) {
  return render(
    <>
      <div data-lesson-content="true" data-lesson-id="lesson-1" data-whiteboard-module-id="source-two">
        <span>Second selectable quote</span>
      </div>
      <LessonSelectionToolbar
        containerSelector={buildLessonContentSelector("lesson-1", "source-two")}
        defaultHighlightColor="yellow"
        highlights={[]}
        onCommentSelection={onCommentSelection}
        onHighlight={vi.fn()}
        onQuoteToNotes={onQuoteToNotes}
        onRemoveHighlight={vi.fn()}
        onSendToNotes={onSendToNotes}
        onStickyNote={vi.fn()}
      />
    </>,
  );
}

function selectText(text: string) {
  const target = screen.getByText(text);
  const textNode = target.firstChild;
  if (!textNode) {
    throw new Error("Missing text node for selection test.");
  }

  const range = document.createRange();
  range.selectNodeContents(textNode);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function installSelectionRect() {
  const rect = {
    bottom: 132,
    height: 20,
    left: 120,
    right: 260,
    top: 112,
    width: 140,
    x: 120,
    y: 112,
    toJSON: () => ({}),
  } as DOMRect;
  const boundingDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
  const rectsDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects");

  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => rect,
  });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [rect],
  });

  return () => {
    if (boundingDescriptor) {
      Object.defineProperty(Range.prototype, "getBoundingClientRect", boundingDescriptor);
    } else {
      delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect;
    }

    if (rectsDescriptor) {
      Object.defineProperty(Range.prototype, "getClientRects", rectsDescriptor);
    } else {
      delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
    }
  };
}
