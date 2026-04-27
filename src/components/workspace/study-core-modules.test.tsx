// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivateNotesModule, SourceLessonModule } from "@/components/workspace/study-core-modules";
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
});
