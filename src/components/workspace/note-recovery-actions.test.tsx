// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteRecoveryActions, NoteSaveAnnouncer, type NoteRecoveryControls } from "@/components/workspace/note-recovery-actions";

function controls(overrides: Partial<NoteRecoveryControls> = {}): NoteRecoveryControls {
  return { conflict: true, busy: false, message: null, copyUrl: null, onKeepBoth: vi.fn(), onUseLatest: vi.fn(), onDownload: vi.fn(), ...overrides };
}

describe("NoteSaveAnnouncer", () => {
  afterEach(cleanup);

  it("stays silent through routine saving and announces only problems", () => {
    const view = render(<NoteSaveAnnouncer autosaveStatus="unsaved" conflict={false} error={null} />);
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("");
    view.rerender(<NoteSaveAnnouncer autosaveStatus="saving" conflict={false} error={null} />);
    expect(region.textContent).toBe("");
    view.rerender(<NoteSaveAnnouncer autosaveStatus="saved" conflict={false} error={null} />);
    expect(region.textContent).toBe("");
    view.rerender(<NoteSaveAnnouncer autosaveStatus="error" conflict={false} error="Connection was interrupted while saving." />);
    expect(region.textContent).toBe("Note not saved. Connection was interrupted while saving.");
    view.rerender(<NoteSaveAnnouncer autosaveStatus="offline" conflict={false} error={null} />);
    expect(region.textContent).toContain("You're offline");
    view.rerender(<NoteSaveAnnouncer autosaveStatus="error" conflict error="A newer saved version exists." />);
    expect(region.textContent).toContain("Another version of this note was saved");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});

describe("NoteRecoveryActions", () => {
  afterEach(cleanup);

  it("moves focus to the outcome when the chosen recovery button disappears", () => {
    const view = render(<NoteRecoveryActions recovery={controls()} />);
    const keepBoth = screen.getByRole("button", { name: "Keep both" });
    keepBoth.focus();
    fireEvent.click(keepBoth);
    view.rerender(<NoteRecoveryActions recovery={controls({ busy: true })} />);
    view.rerender(<NoteRecoveryActions recovery={controls({ conflict: false, message: "Both versions are kept. You're viewing the latest account version.", copyUrl: "/notes/n/copy" })} />);

    expect(document.activeElement?.textContent).toBe("Both versions are kept. You're viewing the latest account version.");
    // Focus already reads the outcome, so the live region stays quiet.
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("announces the outcome without stealing focus from a student who kept typing", () => {
    const view = render(<><input aria-label="Note title" /><NoteRecoveryActions recovery={controls()} /></>);
    view.rerender(<><input aria-label="Note title" /><NoteRecoveryActions recovery={controls({ busy: true })} /></>);
    const title = screen.getByRole("textbox", { name: "Note title" });
    title.focus();
    view.rerender(<><input aria-label="Note title" /><NoteRecoveryActions recovery={controls({ message: "The copy is saved. You made more edits while it saved; those edits are still here. Choose again to preserve them too." })} /></>);

    expect(document.activeElement).toBe(title);
    expect(screen.getByRole("status").textContent).toContain("You made more edits while it saved");
  });

  it("returns focus to the failure message so the student can choose again", () => {
    const view = render(<NoteRecoveryActions recovery={controls()} />);
    fireEvent.click(screen.getByRole("button", { name: "Use latest…" }));
    const replace = screen.getByRole("button", { name: "Replace my draft" });
    replace.focus();
    view.rerender(<NoteRecoveryActions recovery={controls({ busy: true })} />);
    view.rerender(<NoteRecoveryActions recovery={controls({ message: "Connection was interrupted while saving. Retry once you're back online." })} />);

    expect(document.activeElement?.textContent).toBe("Connection was interrupted while saving. Retry once you're back online.");
    expect(screen.getByRole("button", { name: "Keep both" })).toBeTruthy();
  });
});
