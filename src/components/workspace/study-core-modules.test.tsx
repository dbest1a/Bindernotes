// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivateNotesModule, SourceLessonModule } from "@/components/workspace/study-core-modules";
import { extractPlainText } from "@/lib/math-detection";
import { emptyDoc } from "@/lib/utils";
import type { Binder, BinderLesson, SaveStatusSnapshot } from "@/types";

const idleStatus: SaveStatusSnapshot = {
  state: "idle",
  detail: "",
  lastSavedAt: null,
  error: null,
};

const binder: Binder = {
  id: "binder-1",
  owner_id: "admin-1",
  suite_template_id: null,
  title: "Algebra Foundations",
  slug: "algebra-foundations",
  description: "Study algebra.",
  subject: "Math",
  level: "Algebra 1",
  status: "published",
  price_cents: 0,
  cover_url: null,
  pinned: false,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const lesson: BinderLesson = {
  id: "lesson-1",
  binder_id: "binder-1",
  title: "Linear Equations",
  order_index: 0,
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Solve equations by keeping both sides balanced." }],
      },
    ],
  },
  math_blocks: [],
  is_preview: false,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const secondLesson: BinderLesson = {
  ...lesson,
  id: "lesson-2",
  title: "Resonance and Bond Order",
  order_index: 1,
};

function privateNotesProps(
  overrides: Partial<ComponentProps<typeof PrivateNotesModule>> = {},
): ComponentProps<typeof PrivateNotesModule> {
  return {
    autosaveStatus: "unsaved",
    canRetryNoteSave: false,
    currentNotebookSection: null,
    hasUnsavedNoteChanges: true,
    mathSuggestions: [],
    noteContent: { type: "doc", content: [] },
    noteInsertRequest: null,
    noteMath: [],
    noteSaveDetail: "Unsaved changes",
    noteSaveError: null,
    noteSaveLabel: "Unsaved",
    noteTitle: "",
    onAcceptMathSuggestion: vi.fn(),
    onCreateSticky: vi.fn(),
    onDismissMathSuggestion: vi.fn(),
    onEnterNotebookFocus: vi.fn(),
    onGraphMathSuggestion: vi.fn(),
    onInsertCallout: vi.fn(),
    onInsertChecklist: vi.fn(),
    onInsertDefinition: vi.fn(),
    onInsertFormulaReference: vi.fn(),
    onInsertGraphBlock: vi.fn(),
    onInsertGraphNote: vi.fn(),
    onInsertMathBlock: vi.fn(),
    onInsertProof: vi.fn(),
    onInsertTheorem: vi.fn(),
    onInsertWorkedExample: vi.fn(),
    onNoteContentChange: vi.fn(),
    onNoteInsertApplied: vi.fn(),
    onNoteMathChange: vi.fn(),
    onNoteTitleChange: vi.fn(),
    onRetryNoteSave: vi.fn(),
    onSaveNoteNow: vi.fn(),
    selectedLessonTitle: lesson.title,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("study core module headers", () => {
  it("does not duplicate workspace-level split and sticky controls in the source panel header", () => {
    render(
      <SourceLessonModule
        binder={binder}
        defaultHighlightColor="yellow"
        highlights={[]}
        highlightStatus={idleStatus}
        lesson={lesson}
        onHighlight={vi.fn()}
        onJumpToMathSource={vi.fn()}
        onQuoteToNotes={vi.fn()}
        onRemoveHighlight={vi.fn()}
        onSaveSelectionAsEvidence={vi.fn()}
        onSendToNotes={vi.fn()}
        onStickyNote={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Split study/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sticky manager/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Focus source/i })).toBeNull();
  });

  it("marks large source and notes headers as compactable while keeping critical actions", () => {
    render(
      <>
        <SourceLessonModule
          binder={binder}
          defaultHighlightColor="yellow"
          highlights={[]}
          highlightStatus={idleStatus}
          lesson={lesson}
          onHighlight={vi.fn()}
          onJumpToMathSource={vi.fn()}
          onQuoteToNotes={vi.fn()}
          onRemoveHighlight={vi.fn()}
          onSaveSelectionAsEvidence={vi.fn()}
          onSendToNotes={vi.fn()}
          onStickyNote={vi.fn()}
        />
        <PrivateNotesModule
          autosaveStatus="unsaved"
          canRetryNoteSave={false}
          currentNotebookSection={null}
          hasUnsavedNoteChanges
          mathSuggestions={[]}
          noteContent={{ type: "doc", content: [] }}
          noteInsertRequest={null}
          noteMath={[]}
          noteSaveDetail="Unsaved changes"
          noteSaveError={null}
          noteSaveLabel="Unsaved"
          noteTitle=""
          onAcceptMathSuggestion={vi.fn()}
          onCreateSticky={vi.fn()}
          onDismissMathSuggestion={vi.fn()}
          onEnterNotebookFocus={vi.fn()}
          onGraphMathSuggestion={vi.fn()}
          onInsertCallout={vi.fn()}
          onInsertChecklist={vi.fn()}
          onInsertDefinition={vi.fn()}
          onInsertFormulaReference={vi.fn()}
          onInsertGraphBlock={vi.fn()}
          onInsertGraphNote={vi.fn()}
          onInsertMathBlock={vi.fn()}
          onInsertProof={vi.fn()}
          onInsertTheorem={vi.fn()}
          onInsertWorkedExample={vi.fn()}
          onNoteContentChange={vi.fn()}
          onNoteInsertApplied={vi.fn()}
          onNoteMathChange={vi.fn()}
          onNoteTitleChange={vi.fn()}
          onRetryNoteSave={vi.fn()}
          onSaveNoteNow={vi.fn()}
          selectedLessonTitle={lesson.title}
        />
      </>,
    );

    expect(document.querySelector("[data-compact-module-header='source-lesson']")).toBeTruthy();
    expect(document.querySelector("[data-compact-module-header='private-notes']")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Notebook focus/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save now/i })).toBeTruthy();
  });

  it("lets the source header switch the active document from the lesson badge area", () => {
    const onSelectLesson = vi.fn();

    render(
      <SourceLessonModule
        binder={binder}
        defaultHighlightColor="yellow"
        highlights={[]}
        highlightStatus={idleStatus}
        lesson={lesson}
        lessons={[lesson, secondLesson]}
        onHighlight={vi.fn()}
        onJumpToMathSource={vi.fn()}
        onQuoteToNotes={vi.fn()}
        onRemoveHighlight={vi.fn()}
        onSaveSelectionAsEvidence={vi.fn()}
        onSelectLesson={onSelectLesson}
        onSendToNotes={vi.fn()}
        onStickyNote={vi.fn()}
      />,
    );

    const documentSwitcher = screen.getByRole("button", { name: /Switch source document/i });
    expect(documentSwitcher.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(documentSwitcher);
    expect(screen.getByRole("listbox", { name: /Source documents/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /Resonance and Bond Order/i }));

    expect(onSelectLesson).toHaveBeenCalledWith(secondLesson);
  });

  it("exposes source and notes content regions for maximize-space expansion", () => {
    render(
      <>
        <SourceLessonModule
          binder={binder}
          defaultHighlightColor="yellow"
          highlights={[]}
          highlightStatus={idleStatus}
          lesson={lesson}
          onHighlight={vi.fn()}
          onJumpToMathSource={vi.fn()}
          onQuoteToNotes={vi.fn()}
          onRemoveHighlight={vi.fn()}
          onSaveSelectionAsEvidence={vi.fn()}
          onSendToNotes={vi.fn()}
          onStickyNote={vi.fn()}
        />
        <PrivateNotesModule
          autosaveStatus="unsaved"
          canRetryNoteSave={false}
          currentNotebookSection={null}
          hasUnsavedNoteChanges
          mathSuggestions={[]}
          noteContent={{ type: "doc", content: [] }}
          noteInsertRequest={null}
          noteMath={[]}
          noteSaveDetail="Unsaved changes"
          noteSaveError={null}
          noteSaveLabel="Unsaved"
          noteTitle=""
          onAcceptMathSuggestion={vi.fn()}
          onCreateSticky={vi.fn()}
          onDismissMathSuggestion={vi.fn()}
          onEnterNotebookFocus={vi.fn()}
          onGraphMathSuggestion={vi.fn()}
          onInsertCallout={vi.fn()}
          onInsertChecklist={vi.fn()}
          onInsertDefinition={vi.fn()}
          onInsertFormulaReference={vi.fn()}
          onInsertGraphBlock={vi.fn()}
          onInsertGraphNote={vi.fn()}
          onInsertMathBlock={vi.fn()}
          onInsertProof={vi.fn()}
          onInsertTheorem={vi.fn()}
          onInsertWorkedExample={vi.fn()}
          onNoteContentChange={vi.fn()}
          onNoteInsertApplied={vi.fn()}
          onNoteMathChange={vi.fn()}
          onNoteTitleChange={vi.fn()}
          onRetryNoteSave={vi.fn()}
          onSaveNoteNow={vi.fn()}
          selectedLessonTitle={lesson.title}
        />
      </>,
    );

    expect(document.querySelector("[data-maximize-module-space-target='source-shell']")).toBeTruthy();
    expect(document.querySelector("[data-maximize-module-space-target='source-body']")).toBeTruthy();
    expect(document.querySelector("[data-maximize-module-space-target='notes-shell']")).toBeTruthy();
    expect(document.querySelector("[data-maximize-module-space-target='notes-editor']")).toBeTruthy();
  });

  it("prompts before cleaning an accidental-looking note prefix and does not delete automatically", () => {
    const onNoteContentChange = vi.fn();
    render(
      <PrivateNotesModule
        autosaveStatus="unsaved"
        canRetryNoteSave={false}
        currentNotebookSection={null}
        hasUnsavedNoteChanges
        mathSuggestions={[]}
        noteContent={emptyDoc(";;;'';;mm Rigid motion notes stay here.")}
        noteInsertRequest={null}
        noteMath={[]}
        noteSaveDetail="Unsaved changes"
        noteSaveError={null}
        noteSaveLabel="Unsaved"
        noteTitle=""
        onAcceptMathSuggestion={vi.fn()}
        onCreateSticky={vi.fn()}
        onDismissMathSuggestion={vi.fn()}
        onEnterNotebookFocus={vi.fn()}
        onGraphMathSuggestion={vi.fn()}
        onInsertCallout={vi.fn()}
        onInsertChecklist={vi.fn()}
        onInsertDefinition={vi.fn()}
        onInsertFormulaReference={vi.fn()}
        onInsertGraphBlock={vi.fn()}
        onInsertGraphNote={vi.fn()}
        onInsertMathBlock={vi.fn()}
        onInsertProof={vi.fn()}
        onInsertTheorem={vi.fn()}
        onInsertWorkedExample={vi.fn()}
        onNoteContentChange={onNoteContentChange}
        onNoteInsertApplied={vi.fn()}
        onNoteMathChange={vi.fn()}
        onNoteTitleChange={vi.fn()}
        onRetryNoteSave={vi.fn()}
        onSaveNoteNow={vi.fn()}
        selectedLessonTitle={lesson.title}
        studentCalmMode
      />,
    );

    expect(screen.getByText(/This note starts with accidental-looking text/i)).toBeTruthy();
    expect(onNoteContentChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Remove junk prefix/i }));

    expect(extractPlainText(onNoteContentChange.mock.calls[0][0])).toBe("Rigid motion notes stay here.");
  });

  it("separates private note title and body accessible labels without merging body text into the title", async () => {
    render(
      <PrivateNotesModule
        {...privateNotesProps({
          noteTitle: "Coordinate notes",
          noteContent: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "First paragraph." }] },
              { type: "paragraph", content: [{ type: "text", text: "Second paragraph." }] },
            ],
          },
          studentCalmMode: true,
        })}
      />,
    );

    const titleInput = screen.getByLabelText("Private note title") as HTMLInputElement;
    const bodyEditor = await screen.findByLabelText("Private note body");

    expect(titleInput.value).toBe("Coordinate notes");
    expect(titleInput.value).not.toContain("First paragraph");
    expect(titleInput.value).not.toContain("Second paragraph");
    expect(bodyEditor.textContent).toContain("First paragraph.");
    expect(bodyEditor.textContent).toContain("Second paragraph.");
    expect(bodyEditor.querySelectorAll("p")).toHaveLength(2);
  });

  it("explains disabled and pending save states while keeping manual save available for unsaved drafts", () => {
    const { rerender } = render(
      <PrivateNotesModule
        {...privateNotesProps({
          autosaveStatus: "saved",
          hasUnsavedNoteChanges: false,
          noteSaveDetail: "Saved to your account.",
          noteSaveLabel: "Saved",
          studentCalmMode: true,
        })}
      />,
    );

    const savedButton = screen.getByRole("button", { name: /No changes to save/i });
    expect(savedButton).toHaveProperty("disabled", true);
    expect(savedButton.getAttribute("title")).toBe("No changes to save.");
    expect(screen.getAllByText("No changes to save").length).toBeGreaterThan(0);

    rerender(
      <PrivateNotesModule
        {...privateNotesProps({
          autosaveStatus: "offline",
          hasUnsavedNoteChanges: true,
          noteSaveDetail: "You're offline. Keep this tab open.",
          noteSaveLabel: "Offline - keep this tab open",
          studentCalmMode: true,
        })}
      />,
    );

    expect(screen.getByText("Autosave pending")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save now/i })).toHaveProperty("disabled", false);

    rerender(
      <PrivateNotesModule
        {...privateNotesProps({
          autosaveStatus: "saving",
          hasUnsavedNoteChanges: true,
          noteSaveDetail: "Saving this lesson note to your account now.",
          noteSaveLabel: "Saving...",
          studentCalmMode: true,
        })}
      />,
    );

    const savingButton = screen.getByRole("button", { name: /Saving/i });
    expect(savingButton).toHaveProperty("disabled", true);
    expect(savingButton.getAttribute("title")).toBe("Saving is already in progress.");
  });
});
