import { describe, expect, it } from "vitest";
import type {
  Binder,
  BinderLesson,
  Folder,
  LearnerNote,
  PersonalNote,
  PersonalNotebookBinder,
  PersonalNotebookDocument,
} from "@/types";
import {
  buildPersonalNotesEntries,
  defaultPersonalNotesPreferences,
  filterPersonalNotesEntries,
  getPersonalNoteHealth,
  getPersonalNoteReviewQueue,
  normalizePersonalNotesPreferences,
  personalNoteTemplates,
} from "@/lib/personal-notes";

const timestamp = new Date("2026-04-29T12:00:00.000Z").toISOString();

function binder(overrides: Partial<Binder> = {}): Binder {
  return {
    id: "binder-math",
    owner_id: "user-1",
    title: "Algebra Foundations",
    slug: "algebra-foundations",
    description: "Math binder",
    subject: "Math",
    level: "Foundations",
    status: "published",
    price_cents: 0,
    cover_url: null,
    pinned: false,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

function lesson(overrides: Partial<BinderLesson> = {}): BinderLesson {
  return {
    id: "lesson-like-terms",
    binder_id: "binder-math",
    title: "Like Terms",
    order_index: 1,
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Source lesson" }] }] },
    math_blocks: [],
    is_preview: false,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

function folder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "folder-custom",
    owner_id: "user-1",
    name: "Research",
    color: "teal",
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

function learnerNote(overrides: Partial<LearnerNote> = {}): LearnerNote {
  return {
    id: "learner-note-1",
    owner_id: "user-1",
    binder_id: "binder-math",
    lesson_id: "lesson-like-terms",
    folder_id: null,
    title: "Private work on combining terms",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "2x plus 3x becomes 5x" }] }] },
    math_blocks: [],
    pinned: false,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

function personalNote(overrides: Partial<PersonalNote> = {}): PersonalNote {
  return {
    id: "personal-note-1",
    owner_id: "user-1",
    title: "Loose reading note",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "argument plan" }] }] },
    math_blocks: [],
    folder_id: null,
    binder_id: null,
    document_id: null,
    tags: ["essay"],
    pinned: false,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

function notebookBinder(overrides: Partial<PersonalNotebookBinder> = {}): PersonalNotebookBinder {
  return {
    id: "personal-binder-1",
    owner_id: "user-1",
    folder_id: null,
    title: "History notebook",
    description: null,
    color: "amber",
    pinned: false,
    sort_order: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

function notebookDocument(overrides: Partial<PersonalNotebookDocument> = {}): PersonalNotebookDocument {
  return {
    id: "personal-doc-1",
    owner_id: "user-1",
    binder_id: "personal-binder-1",
    title: "Evidence notes",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "primary source quote" }] }] },
    math_blocks: [],
    tags: ["sources"],
    pinned: true,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

describe("Personal Notes unified model", () => {
  it("surfaces learner_notes as binder-linked entries without changing their source ids", () => {
    const entries = buildPersonalNotesEntries({
      learnerNotes: [learnerNote()],
      personalNotes: [],
      personalDocuments: [],
      personalBinders: [],
      binders: [binder()],
      lessons: [lesson()],
      folders: [],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "binder-note",
      id: "learner-note-1",
      sourceType: "Binder private note",
      folderName: "Math",
      sourceBinderId: "binder-math",
      sourceDocumentId: "lesson-like-terms",
      quickOpenUrl: "/notes/n/learner-note-1",
      quickJumpToBinderUrl: "/binders/binder-math/documents/lesson-like-terms",
    });
  });

  it("uses explicit folders for standalone notes and notebook documents when present", () => {
    const entries = buildPersonalNotesEntries({
      learnerNotes: [],
      personalNotes: [personalNote({ folder_id: "folder-custom" })],
      personalDocuments: [notebookDocument()],
      personalBinders: [notebookBinder({ folder_id: "folder-custom" })],
      binders: [],
      lessons: [],
      folders: [folder()],
    });

    expect(entries.map((entry) => [entry.kind, entry.folderName])).toEqual([
      ["personal-document", "Research"],
      ["personal-note", "Research"],
    ]);
    expect(entries[0].quickOpenUrl).toBe("/notes/binders/personal-binder-1/documents/personal-doc-1");
  });

  it("filters binder-linked notes without deleting or detaching them", () => {
    const entries = buildPersonalNotesEntries({
      learnerNotes: [learnerNote()],
      personalNotes: [personalNote()],
      personalDocuments: [notebookDocument()],
      personalBinders: [notebookBinder()],
      binders: [binder()],
      lessons: [lesson()],
      folders: [],
    });

    expect(filterPersonalNotesEntries(entries, { query: "", sourceFilter: "all", showBinderNotes: false }))
      .toHaveLength(2);
    expect(filterPersonalNotesEntries(entries, { query: "", sourceFilter: "binder-linked", showBinderNotes: true }))
      .toHaveLength(1);
    expect(filterPersonalNotesEntries(entries, { query: "5x", sourceFilter: "all", showBinderNotes: true })[0].id)
      .toBe("learner-note-1");
  });

  it("creates quiet health signals and a review queue from note metadata", () => {
    const entries = buildPersonalNotesEntries({
      learnerNotes: [learnerNote({ math_blocks: [{ id: "m1", type: "latex", latex: "x^2", label: "Quadratic" }] })],
      personalNotes: [personalNote({ pinned: true, tags: ["review-later"] })],
      personalDocuments: [notebookDocument()],
      personalBinders: [notebookBinder()],
      binders: [binder()],
      lessons: [lesson()],
      folders: [],
    });

    expect(getPersonalNoteHealth(entries[0]).map((signal) => signal.label)).toContain("Pinned");
    expect(getPersonalNoteHealth(entries.find((entry) => entry.kind === "binder-note")!).map((signal) => signal.label))
      .toEqual(expect.arrayContaining(["Has math blocks", "Linked binder"]));
    expect(getPersonalNoteReviewQueue(entries).map((entry) => entry.id)).toEqual([
      "personal-doc-1",
      "personal-note-1",
      "learner-note-1",
    ]);
  });

  it("ships BinderNotes-native templates without competitor labels", () => {
    expect(personalNoteTemplates.map((template) => template.name)).toEqual(
      expect.arrayContaining(["Blank note", "Math notes", "Formula sheet", "Review checklist"]),
    );
    expect(personalNoteTemplates.map((template) => template.name).join(" ")).not.toMatch(
      /Obsidian|Evernote|Notion|Excalidraw|Note Studio/i,
    );
  });

  it("defaults Personal Notes to the space-efficient minimal workspace", () => {
    expect(defaultPersonalNotesPreferences).toMatchObject({
      defaultView: "notes",
      style: "minimal",
      editorWidth: "wide",
      showReviewQueue: false,
      showNotesListPane: true,
      showSideMonitorTags: false,
      sidebarNavigationMode: "project-tree",
      rememberNotebookContext: true,
      annotatorTools: "floating",
      noteLinkAutocomplete: true,
    });

    expect(normalizePersonalNotesPreferences({})).toMatchObject({
      defaultView: "notes",
      style: "minimal",
      editorWidth: "wide",
    });

    expect(normalizePersonalNotesPreferences({ defaultView: "normal" as never }).defaultView).toBe("organize");
    expect(normalizePersonalNotesPreferences({ defaultView: "minimal" as never }).defaultView).toBe("notes");
    expect(normalizePersonalNotesPreferences({ sidebarNavigationMode: "structured" as never }).sidebarNavigationMode).toBe("project-tree");
    expect(normalizePersonalNotesPreferences({ sidebarNavigationMode: "expanded" as never }).sidebarNavigationMode).toBe("project-tree");
    expect(normalizePersonalNotesPreferences({ sidebarNavigationMode: "loose" as never }).sidebarNavigationMode).toBe("scope-drill-in");
    expect(normalizePersonalNotesPreferences({ sidebarNavigationMode: "drill-in" as never }).sidebarNavigationMode).toBe("scope-drill-in");
    expect(normalizePersonalNotesPreferences({}).showSideMonitorTags).toBe(false);
  });

  it("includes the expanded V2 template set", () => {
    expect(personalNoteTemplates.map((template) => template.name)).toEqual(
      expect.arrayContaining(["Meeting/class recap", "Flashcard seed note"]),
    );
  });
});
