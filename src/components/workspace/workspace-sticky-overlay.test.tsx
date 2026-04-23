// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceStickyOverlay } from "@/components/workspace/workspace-sticky-overlay";
import type { Comment, StickyNoteLayout } from "@/types";

const comment: Comment = {
  id: "comment-1",
  owner_id: "user-1",
  binder_id: "binder-1",
  lesson_id: "lesson-1",
  anchor_text: "A limit is the value a function approaches.",
  body: "Connect this to epsilon-delta later.",
  parent_id: null,
  resolved_at: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const stickyLayout: StickyNoteLayout = {
  x: 40,
  y: 50,
  w: 250,
  h: 206,
  z: 52,
  color: "amber",
};

describe("WorkspaceStickyOverlay", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(16), 0) as unknown as number;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => window.clearTimeout(handle));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the dragged sticky position when parent props rerender with stale saved layout", async () => {
    const onLayoutChange = vi.fn();
    const props = {
      canvasHeight: 800,
      canvasWidth: 1000,
      comments: [comment],
      stickyLayouts: {
        [comment.id]: stickyLayout,
      },
      onDeleteSticky: vi.fn(),
      onLayoutChange,
      onSendToNotes: vi.fn(),
      onUpdateSticky: vi.fn(),
    };

    const { container, rerender } = render(<WorkspaceStickyOverlay {...props} />);
    const handle = screen.getByRole("button", { name: /anchored sticky/i });

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: 180, clientY: 190 });

    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    await waitFor(() => {
      expect(article?.style.left).toBe("120px");
      expect(article?.style.top).toBe("120px");
    });

    rerender(
      <WorkspaceStickyOverlay
        {...props}
        comments={[{ ...comment }]}
        stickyLayouts={{
          [comment.id]: { ...stickyLayout },
        }}
      />,
    );

    const rerenderedArticle = container.querySelector("article");
    await waitFor(() => {
      expect(rerenderedArticle?.style.left).toBe("120px");
      expect(rerenderedArticle?.style.top).toBe("120px");
    });

    fireEvent.pointerUp(window);

    expect(onLayoutChange).toHaveBeenCalledWith(
      comment.id,
      expect.objectContaining({
        x: 120,
        y: 120,
      }),
    );
  });

  it("deletes a sticky from the close button without starting a drag commit", () => {
    const onDeleteSticky = vi.fn();
    const onLayoutChange = vi.fn();

    render(
      <WorkspaceStickyOverlay
        canvasHeight={800}
        canvasWidth={1000}
        comments={[comment]}
        stickyLayouts={{ [comment.id]: stickyLayout }}
        onDeleteSticky={onDeleteSticky}
        onLayoutChange={onLayoutChange}
        onSendToNotes={vi.fn()}
        onUpdateSticky={vi.fn()}
      />,
    );

    const close = screen.getByRole("button", { name: /dismiss sticky note/i });
    fireEvent.pointerDown(close, { clientX: 10, clientY: 10 });
    fireEvent.click(close);

    expect(onDeleteSticky).toHaveBeenCalledWith(comment.id);
    expect(onLayoutChange).not.toHaveBeenCalled();
  });
});
