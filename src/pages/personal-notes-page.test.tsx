// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPersonalNotesPreferences } from "@/lib/personal-notes";
import type { LearnerNote, PersonalNote, PersonalNotesData, PersonalNotesEntry, Profile } from "@/types";

const profile: Profile = {
  id: "user-1",
  email: "kai@example.com",
  full_name: "Kai Chen",
  role: "learner",
  created_at: "2026-04-29T12:00:00.000Z",
  updated_at: "2026-04-29T12:00:00.000Z",
};

const emptyWorkspace: PersonalNotesData = {
  entries: [],
  learnerNotes: [],
  personalNotes: [],
  personalFolders: [],
  personalBinders: [],
  personalDocuments: [],
  binders: [],
  lessons: [],
  folders: [],
  folderBinders: [],
};

const mocks = vi.hoisted(() => ({
  personalNotesState: {
    data: null as PersonalNotesData | null,
    error: null as Error | null,
    isLoading: false,
    refetch: vi.fn(),
  },
  preferences: null as typeof defaultPersonalNotesPreferences | null,
  updatePreferences: vi.fn(),
  createBinder: vi.fn(),
  createFolder: vi.fn(),
  createDocument: vi.fn(),
  savePersonalNote: vi.fn(),
  savePersonalDocument: vi.fn(),
  saveBinderLinkedNote: vi.fn(),
  setPinned: vi.fn(),
  editorChain: {
    focus: vi.fn(),
    toggleBold: vi.fn(),
    toggleItalic: vi.fn(),
    toggleUnderline: vi.fn(),
    toggleBlockquote: vi.fn(),
    toggleHighlight: vi.fn(),
    unsetHighlight: vi.fn(),
    setTextSelection: vi.fn(),
    setLink: vi.fn(),
    run: vi.fn(),
  },
  editor: {
    chain: vi.fn(),
  },
}));

const timestamp = "2026-04-29T12:00:00.000Z";

function doc(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

const learnerNote: LearnerNote = {
  id: "learner-note-1",
  owner_id: "user-1",
  binder_id: "binder-history",
  lesson_id: "lesson-russia",
  folder_id: null,
  title: "Russian Revolution private note",
  content: doc("Timeline notes and [[Loose reading note]]"),
  math_blocks: [],
  pinned: false,
  created_at: timestamp,
  updated_at: timestamp,
};

const mathLearnerNote: LearnerNote = {
  id: "learner-note-math",
  owner_id: "user-1",
  binder_id: "binder-math",
  lesson_id: "lesson-quadratics",
  folder_id: null,
  title: "Quadratics private note",
  content: doc("Completing the square and formulas"),
  math_blocks: [],
  pinned: false,
  created_at: timestamp,
  updated_at: timestamp,
};

const looseNote: PersonalNote = {
  id: "personal-note-1",
  owner_id: "user-1",
  title: "Loose reading note",
  content: doc("Connect this back to [[Russian Revolution private note]]"),
  math_blocks: [],
  folder_id: null,
  binder_id: null,
  document_id: null,
  tags: ["history"],
  pinned: true,
  archived_at: null,
  created_at: timestamp,
  updated_at: timestamp,
};

const personalBinder = {
  id: "personal-binder-1",
  owner_id: "user-1",
  folder_id: null,
  title: "Jacob Math Notes",
  description: "Personal math notebook",
  color: "blue",
  pinned: false,
  sort_order: null,
  created_at: timestamp,
  updated_at: timestamp,
};

const workspaceWithEntries: PersonalNotesData = {
  ...emptyWorkspace,
  entries: [
    {
      kind: "binder-note",
      id: learnerNote.id,
      title: learnerNote.title,
      content: learnerNote.content,
      excerpt: "Timeline notes and Loose reading note",
      searchText: "russian revolution private note timeline loose reading note history binder linked",
      updated_at: timestamp,
      pinned: false,
      folderId: null,
      folderName: "History",
      folderColor: "teal",
      tags: ["history"],
      math_blocks: [],
      sourceType: "Binder private note",
      sourceBinderId: "binder-history",
      sourceBinderTitle: "The Russian Revolution",
      sourceDocumentId: "lesson-russia",
      sourceDocumentTitle: "Overview",
      personalBinderId: null,
      personalBinderTitle: null,
      quickOpenUrl: "/notes/n/learner-note-1",
      quickJumpToBinderUrl: "/binders/binder-history/documents/lesson-russia",
      note: learnerNote,
      reviewLater: false,
    },
    {
      kind: "personal-note",
      id: looseNote.id,
      title: looseNote.title,
      content: looseNote.content,
      excerpt: "Connect this back to Russian Revolution private note",
      searchText: "loose reading note connect russian revolution private note history pinned",
      updated_at: timestamp,
      pinned: true,
      folderId: null,
      folderName: "Unfiled",
      folderColor: "slate",
      tags: ["history"],
      math_blocks: [],
      sourceType: "Loose note",
      sourceBinderId: null,
      sourceBinderTitle: null,
      sourceDocumentId: null,
      sourceDocumentTitle: null,
      personalBinderId: null,
      personalBinderTitle: null,
      quickOpenUrl: "/notes/n/personal-note-1",
      quickJumpToBinderUrl: null,
      note: looseNote,
      reviewLater: false,
    },
    {
      kind: "binder-note",
      id: mathLearnerNote.id,
      title: mathLearnerNote.title,
      content: mathLearnerNote.content,
      excerpt: "Completing the square and formulas",
      searchText: "quadratics private note completing square formulas math binder linked",
      updated_at: timestamp,
      pinned: false,
      folderId: null,
      folderName: "Math",
      folderColor: "blue",
      tags: ["math"],
      math_blocks: [],
      sourceType: "Binder private note",
      sourceBinderId: "binder-math",
      sourceBinderTitle: "Algebra 1 Foundations",
      sourceDocumentId: "lesson-quadratics",
      sourceDocumentTitle: "Completing the Square and Quadratics",
      personalBinderId: null,
      personalBinderTitle: null,
      quickOpenUrl: "/notes/n/learner-note-math",
      quickJumpToBinderUrl: "/binders/binder-math/documents/lesson-quadratics",
      note: mathLearnerNote,
      reviewLater: false,
    },
  ] satisfies PersonalNotesEntry[],
  learnerNotes: [learnerNote, mathLearnerNote],
  personalNotes: [looseNote],
  personalBinders: [personalBinder],
};

function missingTableIssue(table: string) {
  return {
    code: "personal_schema_missing" as const,
    severity: "error" as const,
    title: "Personal Notes schema is missing",
    message: `The ${table} table is not available for this Supabase workspace yet.`,
    technicalReason: `PGRST205: Could not find the table 'public.${table}' in the schema cache`,
    table,
  };
}

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ profile }),
}));

vi.mock("@/hooks/use-personal-notes", () => ({
  usePersonalNotes: () => mocks.personalNotesState,
  usePersonalNotesPreferences: () => [mocks.preferences ?? defaultPersonalNotesPreferences, mocks.updatePreferences],
  usePersonalNotesMutations: () => ({
    createBinder: { mutateAsync: mocks.createBinder, isPending: false, error: null },
    createFolder: { mutateAsync: mocks.createFolder, isPending: false, error: null },
    createDocument: { mutateAsync: mocks.createDocument, isPending: false, error: null },
    savePersonalNote: { mutateAsync: mocks.savePersonalNote, isPending: false, error: null },
    savePersonalDocument: { mutateAsync: mocks.savePersonalDocument, isPending: false, error: null },
    saveBinderLinkedNote: { mutateAsync: mocks.saveBinderLinkedNote, isPending: false, error: null },
    setPinned: { mutateAsync: mocks.setPinned, isPending: false, error: null },
  }),
}));

vi.mock("@/components/editor/rich-text-editor", () => ({
  RichTextEditor: ({
    onEditorReady,
    showToolbar,
    value,
  }: {
    onEditorReady?: (editor: unknown) => void;
    showToolbar?: boolean;
    value: unknown;
  }) => {
    onEditorReady?.(mocks.editor);
    return <textarea aria-label="Note body" data-show-toolbar={String(showToolbar)} readOnly value={JSON.stringify(value)} />;
  },
}));

import { PersonalNotesPage } from "@/pages/personal-notes-page";

function renderPage(path = "/notes") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PersonalNotesPage />} path="/notes" />
        <Route element={<PersonalNotesPage />} path="/notes/n/:noteId" />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PersonalNotesPage", () => {
  beforeEach(() => {
    mocks.editor.chain.mockReset();
    for (const command of Object.values(mocks.editorChain)) {
      command.mockReset();
    }
    mocks.editorChain.focus.mockReturnValue(mocks.editorChain);
    mocks.editorChain.toggleBold.mockReturnValue(mocks.editorChain);
    mocks.editorChain.toggleItalic.mockReturnValue(mocks.editorChain);
    mocks.editorChain.toggleUnderline.mockReturnValue(mocks.editorChain);
    mocks.editorChain.toggleBlockquote.mockReturnValue(mocks.editorChain);
    mocks.editorChain.toggleHighlight.mockReturnValue(mocks.editorChain);
    mocks.editorChain.unsetHighlight.mockReturnValue(mocks.editorChain);
    mocks.editorChain.setTextSelection.mockReturnValue(mocks.editorChain);
    mocks.editorChain.setLink.mockReturnValue(mocks.editorChain);
    mocks.editorChain.run.mockReturnValue(true);
    mocks.editor.chain.mockReturnValue(mocks.editorChain);
  });

  afterEach(() => {
    cleanup();
    mocks.personalNotesState.data = null;
    mocks.personalNotesState.error = null;
    mocks.personalNotesState.isLoading = false;
    mocks.preferences = null;
    vi.restoreAllMocks();
  });

  it("shows an empty notebook state instead of unavailable when the workspace loads empty", () => {
    mocks.personalNotesState.data = emptyWorkspace;

    renderPage();

    expect(screen.getByText("Start your notebook")).toBeTruthy();
    expect(screen.queryByText("Personal Notes unavailable")).toBeNull();
  });

  it("shows a diagnostics-style load failure with the technical reason", () => {
    mocks.personalNotesState.error = Object.assign(new Error("relation personal_note_binders does not exist"), {
      code: "42P01",
    });

    renderPage();

    expect(screen.getByText("Personal Notes could not load")).toBeTruthy();
    expect(screen.getByText(/personal_note_binders/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeTruthy();
  });

  it("opens a BinderNotes create binder dialog without native browser prompts", () => {
    mocks.personalNotesState.data = emptyWorkspace;
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Should not be used");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New binder" }));

    expect(promptSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "New binder" })).toBeTruthy();
    expect(screen.getByLabelText("Binder title")).toBeTruthy();
  });

  it("lets New Note choose an existing personal binder and saves the selected binder id", async () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.savePersonalNote.mockResolvedValue({
      ...looseNote,
      id: "created-note",
      title: "Binder note",
      binder_id: personalBinder.id,
    });

    renderPage("/notes/n/learner-note-1");
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New note" }));

    const dialog = within(screen.getByRole("dialog", { name: "New note" }));
    expect(dialog.getByLabelText("Binder")).toBeTruthy();
    expect(dialog.getByRole("option", { name: "Loose note / No binder" })).toBeTruthy();
    expect(dialog.getByRole("option", { name: "Jacob Math Notes" })).toBeTruthy();

    fireEvent.change(dialog.getByLabelText("Note title"), { target: { value: "Binder note" } });
    fireEvent.change(dialog.getByLabelText("Binder"), { target: { value: `personal:${personalBinder.id}` } });
    fireEvent.click(dialog.getByRole("button", { name: "Create note" }));

    await waitFor(() => {
      expect(mocks.savePersonalNote).toHaveBeenCalledWith(
        expect.objectContaining({
          binderId: personalBinder.id,
          title: "Binder note",
        }),
      );
    });
  });

  it("lets New Note choose an existing workspace folder and binder", async () => {
    mocks.savePersonalNote.mockClear();
    mocks.saveBinderLinkedNote.mockClear();
    const sourceFolder = {
      id: "folder-math",
      owner_id: "system",
      name: "Math",
      color: "blue",
      source: "system" as const,
      suite_template_id: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const sourceBinder = {
      id: "binder-algebra-foundations",
      owner_id: "system",
      title: "Algebra 1 Foundations",
      slug: "algebra-1-foundations",
      description: "Algebra practice",
      subject: "Math",
      level: "Algebra 1",
      status: "published" as const,
      price_cents: 0,
      cover_url: null,
      pinned: false,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const sourceLesson = {
      id: "lesson-completing-square",
      binder_id: sourceBinder.id,
      title: "Completing the Square",
      order_index: 1,
      content: doc("Quadratics"),
      math_blocks: [],
      is_preview: false,
      created_at: timestamp,
      updated_at: timestamp,
    };
    mocks.personalNotesState.data = {
      ...emptyWorkspace,
      binders: [sourceBinder],
      folders: [sourceFolder],
      folderBinders: [
        {
          id: "folder-link-math-algebra",
          owner_id: "system",
          folder_id: sourceFolder.id,
          binder_id: sourceBinder.id,
          created_at: timestamp,
          updated_at: timestamp,
        },
      ],
      lessons: [sourceLesson],
    };
    mocks.saveBinderLinkedNote.mockResolvedValue({
      ...learnerNote,
      id: "created-source-note",
      binder_id: sourceBinder.id,
      lesson_id: sourceLesson.id,
      title: "Workspace note",
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New note" }));

    expect(screen.getByTestId("personal-notes-create-dialog-overlay").className).toContain("bg-background/72");
    const dialog = within(screen.getByRole("dialog", { name: "New note" }));
    expect(screen.getByRole("dialog", { name: "New note" }).className).toContain("max-w-lg");
    expect(dialog.getByLabelText("Note title").className).toContain("min-w-0");
    expect(dialog.queryByText("Create a binder first, then add notes to it.")).toBeNull();
    expect(dialog.getByRole("option", { name: "Math" })).toBeTruthy();
    expect(dialog.getByRole("option", { name: "Algebra 1 Foundations" })).toBeTruthy();

    fireEvent.change(dialog.getByLabelText("Folder"), { target: { value: `workspace:${sourceFolder.id}` } });
    fireEvent.change(dialog.getByLabelText("Binder"), { target: { value: `workspace:${sourceBinder.id}` } });
    expect(dialog.getByLabelText("Document")).toBeTruthy();
    expect(dialog.getByLabelText("Document").className).toContain("min-w-0");
    expect(dialog.getByRole("option", { name: "Completing the Square" })).toBeTruthy();

    fireEvent.change(dialog.getByLabelText("Note title"), { target: { value: "Workspace note" } });
    fireEvent.click(dialog.getByRole("button", { name: "Create note" }));

    await waitFor(() => {
      expect(mocks.saveBinderLinkedNote).toHaveBeenCalledWith(
        expect.objectContaining({
          binderId: sourceBinder.id,
          lessonId: sourceLesson.id,
          folderId: sourceFolder.id,
          title: "Workspace note",
        }),
      );
    });
    expect(mocks.savePersonalNote).not.toHaveBeenCalled();
  });

  it("lets New Note pick a folder and any existing binder without rendering undefined labels", async () => {
    const mathFolder = {
      id: "personal-folder-math",
      owner_id: "user-1",
      name: "Math",
      color: "blue",
      sort_order: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const mathBinder = {
      ...personalBinder,
      id: "personal-binder-math",
      folder_id: mathFolder.id,
      title: "Algebra Practice",
    };
    mocks.personalNotesState.data = {
      ...workspaceWithEntries,
      personalFolders: [mathFolder],
      personalBinders: [personalBinder, mathBinder],
    };
    mocks.savePersonalNote.mockResolvedValue({
      ...looseNote,
      id: "created-folder-note",
      title: "Folder binder note",
      folder_id: mathFolder.id,
      binder_id: mathBinder.id,
    });

    renderPage("/notes/n/learner-note-1");
    const sidebar = within(screen.getByLabelText("Personal Notes side monitor"));
    fireEvent.click(sidebar.getByRole("button", { name: /Math folder/i }));

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New note" }));

    const dialog = within(screen.getByRole("dialog", { name: "New note" }));
    expect(dialog.queryByRole("option", { name: /undefined/i })).toBeNull();
    expect((dialog.getByLabelText("Folder") as HTMLSelectElement).value).toBe("");

    fireEvent.change(dialog.getByLabelText("Folder"), { target: { value: `personal:${mathFolder.id}` } });
    expect(dialog.getByRole("option", { name: "Algebra Practice" })).toBeTruthy();
    expect(dialog.getByRole("option", { name: "Jacob Math Notes (Unfiled)" })).toBeTruthy();
    expect(dialog.queryByRole("option", { name: /No binders/i })).toBeNull();

    fireEvent.change(dialog.getByLabelText("Note title"), { target: { value: "Folder binder note" } });
    fireEvent.change(dialog.getByLabelText("Binder"), { target: { value: `personal:${mathBinder.id}` } });
    fireEvent.click(dialog.getByRole("button", { name: "Create note" }));

    await waitFor(() => {
      expect(mocks.savePersonalNote).toHaveBeenCalledWith(
        expect.objectContaining({
          binderId: mathBinder.id,
          folderId: mathFolder.id,
          title: "Folder binder note",
        }),
      );
    });
  });

  it("keeps binder choices available when the selected folder has no binders yet", () => {
    const historyFolder = {
      id: "personal-folder-history",
      owner_id: "user-1",
      name: "History",
      color: "teal",
      sort_order: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    mocks.personalNotesState.data = {
      ...workspaceWithEntries,
      personalFolders: [historyFolder],
      personalBinders: [personalBinder],
    };

    renderPage("/notes/n/learner-note-1");
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New note" }));

    const dialog = within(screen.getByRole("dialog", { name: "New note" }));
    fireEvent.change(dialog.getByLabelText("Folder"), { target: { value: `personal:${historyFolder.id}` } });

    expect(dialog.queryByRole("option", { name: /No binders in this folder/i })).toBeNull();
    expect(dialog.getByRole("option", { name: "Jacob Math Notes (Unfiled)" })).toBeTruthy();
  });

  it("uses a full-width compact notes shell instead of a centered hero lane", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    const { container } = renderPage("/notes/n/learner-note-1");

    const shell = screen.getByTestId("personal-notes-shell");
    expect(shell.className).toContain("max-w-none");
    expect(shell.getAttribute("data-personal-notes-view")).toBe("notes");
    expect(shell.getAttribute("data-notes-sidebars-hidden")).toBe("false");
    expect(container.textContent).not.toContain(
      "Your loose notes, custom notebook binders, documents, and binder private notes in one BinderNotes workspace.",
    );
    expect(container.textContent).not.toContain("Personal Notes preferences");
    expect(screen.queryByLabelText("Personal Notes view")).toBeNull();
    expect(screen.getByLabelText("Editor width")).toBeTruthy();
  });

  it("hides the Personal Notes view switcher while the Notes workspace is the only active view", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    renderPage("/notes/n/learner-note-1");

    expect(screen.queryByLabelText("Personal Notes view")).toBeNull();
    expect(screen.queryByRole("button", { name: "Notes view" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Home view" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Organize view" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Canvas view" })).toBeNull();
  });

  it("hides Review Queue from the notebook sidebar and exposes hierarchy settings", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    renderPage("/notes/n/learner-note-1");

    expect(screen.queryByText("Review")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Personal Notes settings" }));
    expect(screen.getByText("Personal Notes sidebar mode")).toBeTruthy();
    expect(screen.getByText("Remember last selected scope and binder")).toBeTruthy();
  });

  it("does not show a duplicate Review Queue sidebar even if the older preference is enabled", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, showReviewQueue: true };

    renderPage("/notes/n/learner-note-1");

    const sidebar = within(screen.getByLabelText("Personal Notes side monitor"));
    expect(sidebar.queryByText("Review")).toBeNull();
  });

  it("starts the notebook sidebar at scope level without note titles", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, sidebarNavigationMode: "scope-drill-in" };

    renderPage("/notes/n/learner-note-1");

    const sidebar = within(screen.getByLabelText("Personal Notes side monitor"));
    expect(sidebar.getByRole("button", { name: /All notes 3/i })).toBeTruthy();
    expect(sidebar.getByRole("button", { name: /History 1/i })).toBeTruthy();
    expect(sidebar.getByRole("button", { name: /Math 1/i })).toBeTruthy();
    expect(sidebar.getByRole("button", { name: /Loose notes 1/i })).toBeTruthy();
    expect(sidebar.getByRole("button", { name: /Binder-linked 2/i })).toBeTruthy();
    expect(sidebar.queryByText("Russian Revolution private note")).toBeNull();
    expect(sidebar.queryByText("Quadratics private note")).toBeNull();
  });

  it("drills from a scope into binders, then into that binder's notes", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, sidebarNavigationMode: "scope-drill-in" };

    renderPage("/notes/n/learner-note-1");

    fireEvent.click(screen.getByRole("button", { name: /Math 1/i }));
    let sidebar = within(screen.getByLabelText("Personal Notes side monitor"));
    expect(sidebar.getByText("Math")).toBeTruthy();
    expect(sidebar.getByRole("button", { name: /Algebra 1 Foundations 1/i })).toBeTruthy();
    expect(sidebar.queryByText("Quadratics private note")).toBeNull();
    expect(screen.getAllByText("Math").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quadratics private note").length).toBeGreaterThan(0);
    expect(screen.queryByText("Russian Revolution private note")).toBeNull();

    fireEvent.click(sidebar.getByRole("button", { name: /Algebra 1 Foundations 1/i }));
    sidebar = within(screen.getByLabelText("Personal Notes side monitor"));
    expect(sidebar.getByText("Algebra 1 Foundations")).toBeTruthy();
    expect(sidebar.queryByRole("button", { name: /The Russian Revolution/i })).toBeNull();
    expect(screen.getByText("Math / Algebra 1 Foundations")).toBeTruthy();
    expect(screen.getAllByText("Quadratics private note").length).toBeGreaterThan(0);
    expect(screen.queryByText("Russian Revolution private note")).toBeNull();

    fireEvent.click(sidebar.getByRole("button", { name: "Back to Math binders" }));
    sidebar = within(screen.getByLabelText("Personal Notes side monitor"));
    expect(sidebar.getByRole("button", { name: /Algebra 1 Foundations 1/i })).toBeTruthy();
  });

  it("uses All notes as a binder list instead of a note dump", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, sidebarNavigationMode: "scope-drill-in" };

    renderPage("/notes/n/learner-note-1");

    fireEvent.click(screen.getByRole("button", { name: /All notes 3/i }));
    const sidebar = within(screen.getByLabelText("Personal Notes side monitor"));
    expect(sidebar.getByRole("button", { name: /The Russian Revolution 1/i })).toBeTruthy();
    expect(sidebar.getByRole("button", { name: /Algebra 1 Foundations 1/i })).toBeTruthy();
    expect(sidebar.queryByText("Russian Revolution private note")).toBeNull();
    expect(sidebar.queryByText("Quadratics private note")).toBeNull();
  });

  it("keeps empty notebook categories render-safe instead of breaking the editor", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, sidebarNavigationMode: "scope-drill-in" };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderPage("/notes/n/learner-note-1");
    fireEvent.click(screen.getByRole("button", { name: /Chemistry 0/i }));

    expect(screen.getByText("No binders in Chemistry yet.")).toBeTruthy();
    expect(screen.getByTestId("personal-note-empty-editor")).toBeTruthy();
    expect(screen.getByText("Choose a note")).toBeTruthy();
    expect(screen.queryByText("This page could not render")).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("shows loose notes directly in the middle pane", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, sidebarNavigationMode: "scope-drill-in" };

    renderPage("/notes/n/learner-note-1");

    fireEvent.click(screen.getByRole("button", { name: /Loose notes 1/i }));
    const sidebar = within(screen.getByLabelText("Personal Notes side monitor"));
    expect(sidebar.getByText("Loose notes")).toBeTruthy();
    expect(sidebar.queryByText("Loose reading note")).toBeNull();
    expect(screen.getAllByText("Loose notes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Loose reading note").length).toBeGreaterThan(0);
  });

  it("uses the drill-in notebook sidebar as the default navigation and toggles the larger notes pane on demand", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, sidebarNavigationMode: "scope-drill-in" };

    renderPage("/notes/n/learner-note-1");

    expect(screen.getByTestId("notes-list-pane")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /History 1/i }));
    expect(within(screen.getByLabelText("Personal Notes side monitor")).getByRole("button", { name: /The Russian Revolution 1/i })).toBeTruthy();
    expect(screen.getAllByText("Russian Revolution private note").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Hide notes list pane" }));
    expect(mocks.updatePreferences).toHaveBeenCalledWith({ showNotesListPane: false });
  });

  it("renders the larger notes pane when the notes list preference is enabled", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, sidebarNavigationMode: "scope-drill-in", showNotesListPane: true };

    renderPage("/notes/n/learner-note-1");

    expect(screen.getByTestId("notes-list-pane")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide notes list pane" })).toBeTruthy();
  });

  it("defaults to Project Tree and keeps binders closed until the user opens one", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    renderPage("/notes/n/learner-note-math");

    const sidebar = within(screen.getByLabelText("Personal Notes side monitor"));
    expect(sidebar.getByRole("button", { name: /Math folder 1/i })).toBeTruthy();
    expect(sidebar.getByRole("button", { name: /History folder 1/i })).toBeTruthy();
    expect(sidebar.getByRole("button", { name: /Algebra 1 Foundations binder 1/i })).toBeTruthy();
    expect(sidebar.queryByRole("button", { name: /Quadratics private note/i })).toBeNull();
    fireEvent.click(sidebar.getByRole("button", { name: /Algebra 1 Foundations binder 1/i }));
    expect(sidebar.getByRole("button", { name: /Quadratics private note/i })).toBeTruthy();
    expect(sidebar.queryByText("Review")).toBeNull();
    expect(sidebar.queryByRole("button", { name: "math" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open Personal Notes settings" }));
    const drawer = within(screen.getByRole("dialog", { name: "Personal Notes settings" }));
    expect((drawer.getByLabelText("Personal Notes sidebar mode") as HTMLSelectElement).value).toBe("project-tree");
  });

  it("expands Project Tree folders and binders without changing the current note", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    renderPage("/notes/n/learner-note-1");

    expect((screen.getByLabelText("Note title") as HTMLInputElement).value).toBe("Russian Revolution private note");
    const sidebar = within(screen.getByLabelText("Personal Notes side monitor"));

    fireEvent.click(sidebar.getByRole("button", { name: /Math folder 1/i }));
    expect((screen.getByLabelText("Note title") as HTMLInputElement).value).toBe("Russian Revolution private note");

    fireEvent.click(sidebar.getByRole("button", { name: /Algebra 1 Foundations binder 1/i }));
    expect(sidebar.getByRole("button", { name: /Quadratics private note/i })).toBeTruthy();
    expect((screen.getByLabelText("Note title") as HTMLInputElement).value).toBe("Russian Revolution private note");
  });

  it("can show tags quietly in the side monitor when enabled", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, showSideMonitorTags: true };

    renderPage("/notes/n/learner-note-math");

    const sidebar = within(screen.getByLabelText("Personal Notes side monitor"));
    expect(sidebar.getByRole("button", { name: "math" })).toBeTruthy();
    expect(sidebar.getByRole("button", { name: "history" })).toBeTruthy();
  });

  it("renders Organize as reorderable cards with corner drag handles", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, defaultView: "organize" };

    renderPage("/notes/n/learner-note-1");

    const organize = within(screen.getByTestId("personal-notes-organize-view"));
    expect(organize.getByTestId("personal-notes-organize-card-list").className).toContain("grid-cols-1");
    expect(organize.getByTestId("organize-card-quick-access")).toBeTruthy();
    expect(organize.getByRole("button", { name: /Drag Quick Access to reorder/i })).toBeTruthy();
    expect(organize.getByRole("button", { name: /Drag History folder to reorder/i })).toBeTruthy();
    expect(organize.getByRole("button", { name: /Drag Math folder to reorder/i })).toBeTruthy();
    expect(organize.getByRole("button", { name: "Save order" })).toBeTruthy();
  });

  it("reorders Organize cards from the full card body while preserving child controls", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, defaultView: "organize" };

    renderPage("/notes/n/learner-note-1");

    const cardList = screen.getByTestId("personal-notes-organize-card-list");
    const cardIds = () =>
      Array.from(cardList.querySelectorAll("[data-organize-card-id]")).map((node) =>
        node.getAttribute("data-organize-card-id"),
      );

    expect(cardIds()[0]).toBe("quick-access");
    fireEvent.pointerDown(screen.getByTestId("organize-card-folder:Math"));
    expect(screen.getByTestId("organize-card-folder:Math").getAttribute("data-dragging")).toBe("true");
    fireEvent.pointerEnter(screen.getByTestId("organize-card-quick-access"));
    fireEvent.pointerUp(window);

    expect(cardIds()[0]).toBe("folder:Math");
    expect(screen.getByTestId("organize-card-folder:Math").getAttribute("data-dragging")).toBe("false");

    const quickAccess = within(screen.getByTestId("organize-card-quick-access"));
    fireEvent.pointerDown(quickAccess.getByRole("button", { name: "Note" }));
    expect(screen.getByTestId("organize-card-quick-access").getAttribute("data-dragging")).toBe("false");
  });

  it("still reorders Organize cards from the grip cue", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, defaultView: "organize" };

    renderPage("/notes/n/learner-note-1");

    fireEvent.pointerDown(screen.getByRole("button", { name: /Drag Math folder to reorder/i }));
    expect(screen.getByTestId("organize-card-folder:Math").getAttribute("data-dragging")).toBe("true");
  });

  it("saves Organize card order and auto-dismisses the toast after about three seconds", () => {
    vi.useFakeTimers();
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, defaultView: "organize" };

    try {
      renderPage("/notes/n/learner-note-1");

      fireEvent.click(screen.getByRole("button", { name: "Save order" }));

      expect(mocks.updatePreferences).toHaveBeenCalledWith({
        organizeCardOrder: expect.arrayContaining(["quick-access", "folder:History", "folder:Math"]),
      });
      expect(screen.getByRole("status").textContent).toContain("Order saved");

      fireEvent.click(screen.getByRole("button", { name: "Save order" }));
      expect(screen.getAllByRole("status")).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(2999);
      });
      expect(screen.getByRole("status").textContent).toContain("Order saved");

      act(() => {
        vi.advanceTimersByTime(2);
      });
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets Quick Access hide through settings without deleting organizer data", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = {
      ...defaultPersonalNotesPreferences,
      defaultView: "organize",
      showQuickAccess: false,
    };

    renderPage("/notes/n/learner-note-1");

    expect(screen.queryByTestId("organize-card-quick-access")).toBeNull();
    expect(screen.getByTestId("organize-card-folder:History")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open Personal Notes settings" }));
    fireEvent.change(screen.getByLabelText("Search Personal Notes settings"), { target: { value: "quick access" } });
    fireEvent.click(screen.getByLabelText("Show Quick Access"));

    expect(mocks.updatePreferences).toHaveBeenCalledWith({ showQuickAccess: true });
  });

  it("keeps Organize usable on mobile with compact move controls instead of desktop squeeze", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, defaultView: "organize" };

    renderPage("/notes/n/learner-note-1");

    const organize = screen.getByTestId("personal-notes-organize-view");
    expect(organize.className).toContain("overflow-hidden");
    expect(screen.getByTestId("personal-notes-organize-card-list").className).toContain("grid-cols-1");
    expect(screen.getByRole("button", { name: /Move Math folder up/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Move History folder down/i })).toBeTruthy();
  });

  it("Home represents Folder to Binder to Notes without a duplicate Review Queue column", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = { ...defaultPersonalNotesPreferences, defaultView: "home" };

    renderPage();

    expect(screen.getByText("Notebooks by folder")).toBeTruthy();
    expect(screen.getByText("Math")).toBeTruthy();
    expect(screen.getAllByText("Algebra 1 Foundations").length).toBeGreaterThan(0);
    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getAllByText("The Russian Revolution").length).toBeGreaterThan(0);
    expect(screen.getByText("Binder-linked notes")).toBeTruthy();
    expect(screen.getByText("Loose notes")).toBeTruthy();
    expect(screen.getAllByText("Loose reading note").length).toBeGreaterThan(0);
    expect(screen.queryByText("Review Queue")).toBeNull();
    expect(screen.queryByText("Canvas tools")).toBeNull();
  });

  it("keeps source actions in a non-overlapping row and fullscreen focus calls the browser API", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });

    renderPage("/notes/n/learner-note-1");

    expect(screen.getByTestId("binder-source-action-row").className).toContain("flex-col");
    expect(screen.getByTestId("binder-source-action-row").className).toContain("xl:flex-row");
    expect(screen.getByTestId("open-binder-workspace-button").className).toContain("whitespace-nowrap");
    expect(screen.getByTestId("open-binder-workspace-button").className).toContain("overflow-hidden");
    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen focus" }));
    expect(requestFullscreen).toHaveBeenCalled();
  });

  it("keeps saved search chips in the filter menu instead of the default chrome", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    renderPage();

    expect(screen.queryByRole("button", { name: "Pinned" })).toBeNull();
    expect(screen.queryByLabelText("Source filter")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open note filters" }));
    expect(screen.getByTestId("personal-notes-filter-dock")).toBeTruthy();
    expect(screen.getByLabelText("Source filter")).toBeTruthy();
    expect(screen.getByRole("menu", { name: "Saved note filters" }).getAttribute("data-overlap-safe")).toBe("true");
    for (const chip of ["Recent", "Pinned", "Binder-linked", "Loose notes", "Math", "History", "Review later", "Has formulas", "Untitled", "Unfiled"]) {
      expect(screen.getByRole("menuitem", { name: chip })).toBeTruthy();
    }
  });

  it("closes the filter menu on selection, Escape, and outside click", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Open note filters" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pinned" }));
    expect(screen.queryByRole("menu", { name: "Saved note filters" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open note filters" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Saved note filters" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open note filters" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu", { name: "Saved note filters" })).toBeNull();
  });

  it("opens settings in a drawer instead of rendering preferences at the bottom", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    renderPage("/notes/n/learner-note-1");

    expect(screen.queryByText("Personal Notes preferences")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Personal Notes settings" }));

    const drawer = within(screen.getByRole("dialog", { name: "Personal Notes settings" }));
    expect(drawer.getByText("Personal Notes settings")).toBeTruthy();
    expect(drawer.getAllByLabelText("App Appearance")).toHaveLength(1);
    expect(drawer.getByText("Editor state")).toBeTruthy();
  });

  it("adds annotator tools settings and makes annotation terms searchable", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    renderPage("/notes/n/learner-note-1");

    fireEvent.click(screen.getByRole("button", { name: "Open Personal Notes settings" }));
    const drawer = within(screen.getByRole("dialog", { name: "Personal Notes settings" }));

    expect(drawer.getByText("Editor")).toBeTruthy();
    const annotatorTools = within(drawer.getByRole("radiogroup", { name: "Annotator tools" }));
    expect(annotatorTools.getByRole("radio", { name: "Selection popup" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(annotatorTools.getByRole("radio", { name: "Off" }));
    expect(mocks.updatePreferences).toHaveBeenCalledWith({ annotatorTools: "off" });

    fireEvent.change(drawer.getByLabelText("Search Personal Notes settings"), { target: { value: "highlighter" } });
    expect(drawer.getByText("Editor")).toBeTruthy();
    expect(drawer.getByRole("radiogroup", { name: "Annotator tools" })).toBeTruthy();
  });

  it("uses one workspace-style selection toolbar and hides the fixed editor toolbar", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = {
      ...defaultPersonalNotesPreferences,
      annotatorTools: "floating",
      showAnnotationColorFilter: true,
    };
    vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      rangeCount: 0,
      removeAllRanges: vi.fn(),
      toString: () => "selected text",
    } as unknown as Selection);

    renderPage("/notes/n/learner-note-1");
    fireEvent.mouseUp(screen.getByLabelText("Note body"));

    expect(screen.getByLabelText("Note body").getAttribute("data-show-toolbar")).toBe("false");
    expect(screen.queryByLabelText("Top annotator toolbar")).toBeNull();
    expect(screen.queryByRole("toolbar", { name: "Floating annotation toolkit" })).toBeNull();

    const toolbar = within(screen.getByRole("toolbar", { name: "Personal Notes selection toolbar" }));
    expect(toolbar.getByRole("button", { name: "Bold selection" })).toBeTruthy();
    expect(toolbar.getByRole("button", { name: "Italic selection" })).toBeTruthy();
    expect(toolbar.getByRole("button", { name: "Underline selection" })).toBeTruthy();
    expect(toolbar.getByRole("button", { name: "Quote selection" })).toBeTruthy();
    expect(toolbar.getByRole("button", { name: "Link selection" })).toBeTruthy();
    expect(toolbar.getByRole("button", { name: "Important highlight" })).toBeTruthy();
    expect(toolbar.getByRole("button", { name: "Definition highlight" })).toBeTruthy();
    expect(toolbar.getByLabelText("Highlight color filter")).toBeTruthy();

    fireEvent.click(toolbar.getByRole("button", { name: "Bold selection" }));
    expect(mocks.editorChain.toggleBold).toHaveBeenCalled();

    fireEvent.click(toolbar.getByRole("button", { name: "Italic selection" }));
    expect(mocks.editorChain.toggleItalic).toHaveBeenCalled();

    fireEvent.click(toolbar.getByRole("button", { name: "Underline selection" }));
    expect(mocks.editorChain.toggleUnderline).toHaveBeenCalled();

    fireEvent.click(toolbar.getByRole("button", { name: "Quote selection" }));
    expect(mocks.editorChain.toggleBlockquote).toHaveBeenCalled();

    fireEvent.click(toolbar.getByRole("button", { name: "Link selection" }));
    expect(screen.getByRole("dialog", { name: "Annotation link popover" })).toBeTruthy();

    fireEvent.click(toolbar.getByRole("button", { name: "Definition highlight" }));
    expect(mocks.editorChain.toggleHighlight).toHaveBeenCalledWith({ color: "#93c5fd" });

    fireEvent.click(toolbar.getByRole("button", { name: "Remove highlight" }));
    expect(mocks.editorChain.unsetHighlight).toHaveBeenCalled();
  });

  it("hides the highlight color filter beside the highlighter when the Personal Notes setting is off", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = {
      ...defaultPersonalNotesPreferences,
      annotatorTools: "floating",
      showAnnotationColorFilter: false,
    };
    vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      rangeCount: 0,
      removeAllRanges: vi.fn(),
      toString: () => "selected text",
    } as unknown as Selection);

    renderPage("/notes/n/learner-note-1");
    fireEvent.mouseUp(screen.getByLabelText("Note body"));

    expect(screen.getByRole("toolbar", { name: "Personal Notes selection toolbar" })).toBeTruthy();
    expect(screen.queryByLabelText("Highlight color filter")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open Personal Notes settings" }));
    const drawer = within(screen.getByRole("dialog", { name: "Personal Notes settings" }));
    expect(drawer.getByText("Show highlight color filter")).toBeTruthy();
  });

  it("filters the annotations drawer by highlight color without mutating note content", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    mocks.preferences = {
      ...defaultPersonalNotesPreferences,
      annotatorTools: "top",
      showAnnotationColorFilter: true,
    };
    vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      rangeCount: 0,
      removeAllRanges: vi.fn(),
      toString: () => "selected text",
    } as unknown as Selection);

    renderPage("/notes/n/learner-note-1");
    const originalBody = (screen.getByLabelText("Note body") as HTMLTextAreaElement).value;
    fireEvent.mouseUp(screen.getByLabelText("Note body"));
    const toolbar = within(screen.getByRole("toolbar", { name: "Personal Notes selection toolbar" }));

    fireEvent.click(toolbar.getByRole("button", { name: "Important highlight" }));
    fireEvent.click(toolbar.getByRole("button", { name: "Definition highlight" }));
    fireEvent.change(toolbar.getByLabelText("Highlight color filter"), { target: { value: "blue" } });
    fireEvent.click(toolbar.getByRole("button", { name: "Open annotations drawer" }));

    const drawer = within(screen.getByRole("dialog", { name: "Annotations drawer" }));
    expect(drawer.getByText("Blue highlight")).toBeTruthy();
    expect(drawer.queryByText("Yellow highlight")).toBeNull();
    expect(screen.getByTestId("personal-note-writing-surface").getAttribute("data-highlight-filter")).toBe("blue");
    expect((screen.getByLabelText("Note body") as HTMLTextAreaElement).value).toBe(originalBody);
  });

  it("hides the side monitor and enters focus mode without losing the editor surface", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    renderPage("/notes/n/learner-note-1");
    const shell = screen.getByTestId("personal-notes-shell");

    fireEvent.click(screen.getByRole("button", { name: "Hide side monitor" }));
    expect(mocks.updatePreferences).toHaveBeenCalledWith({ showNotebookPane: false });
    expect(screen.getByTestId("personal-note-editor")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Enter focus mode" }));
    expect(shell.getAttribute("data-notes-focus-mode")).toBe("true");
    expect(shell.getAttribute("data-notes-top-chrome-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "Show Personal Notes toolbar" })).toBeTruthy();
    expect(screen.getByTestId("show-personal-notes-toolbar-button").className).toContain("fixed");
    expect(screen.getByTestId("show-personal-notes-toolbar-button").className).toContain("bottom-4");
    expect(screen.getByTestId("show-personal-notes-toolbar-button").className).not.toContain("top-3");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(mocks.updatePreferences).toHaveBeenCalledWith({ focusMode: false });
  });

  it("adds V2 command palette actions without native prompts", () => {
    mocks.personalNotesState.data = workspaceWithEntries;
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Should not be used");

    renderPage("/notes/n/learner-note-1");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const palette = within(screen.getByRole("dialog", { name: "Personal Notes command palette" }));

    for (const group of ["Create", "Recent Notes", "Find And Open", "Side Monitor", "Editor And Layout", "Highlights And Annotations", "Current Note"]) {
      expect(palette.getByText(group)).toBeTruthy();
    }
    expect(palette.getByRole("button", { name: /Open note: Loose reading note/i })).toBeTruthy();

    for (const command of [
      "New folder",
      "New canvas notebook",
      "Toggle App Appearance Minimal/Studio",
      "Hide side monitor",
      "Hide top chrome",
      "Enter focus mode",
      "Enter fullscreen focus",
      "Open settings",
      "Open Review Queue",
      "Open Templates",
      "Focus editor",
      "Copy note link",
    ]) {
      expect(palette.getByRole("button", { name: new RegExp(command) })).toBeTruthy();
    }
    expect(palette.queryByRole("button", { name: /Switch to Notes view/ })).toBeNull();
    expect(palette.queryByRole("button", { name: /Switch to Home view/ })).toBeNull();
    expect(palette.queryByRole("button", { name: /Switch to Organize view/ })).toBeNull();
    fireEvent.change(palette.getByLabelText("Command search"), { target: { value: "quadratics" } });
    expect(palette.getByText("Matching Notes")).toBeTruthy();
    expect(palette.getByRole("button", { name: /Open note: Quadratics private note/i })).toBeTruthy();
    expect(promptSpy).not.toHaveBeenCalled();
  });

  it("keeps note links and backlinks in a drawer until requested", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    renderPage("/notes/n/learner-note-1");

    expect(screen.queryByText("Linked notes")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Links" }));
    const drawer = screen.getByRole("dialog", { name: "Note links and backlinks drawer" });
    expect(drawer).toBeTruthy();
    expect(drawer.className).toContain("personal-notes-tools-drawer");
    expect(drawer.className).toContain("bg-popover");
    expect(drawer.className).not.toContain("backdrop-blur");
    expect(screen.getByText("Linked notes")).toBeTruthy();
    expect(screen.getAllByText("Loose reading note").length).toBeGreaterThan(0);
    expect(screen.getByText("Backlinks")).toBeTruthy();
  });

  it("asks for a starting layout in the canvas notebook dialog", () => {
    mocks.personalNotesState.data = workspaceWithEntries;

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New canvas notebook" }));

    expect(screen.getByLabelText("Starting layout")).toBeTruthy();
  });

  it("gives schema repair guidance when Supabase is missing personal tables", () => {
    mocks.personalNotesState.data = {
      ...workspaceWithEntries,
      loadIssues: [
        missingTableIssue("personal_notes"),
      ],
    };

    renderPage();

    expect(screen.getByText("Supabase workspace needs the Personal Notes tables")).toBeTruthy();
    expect(screen.getByText(/supabase\/migrations\/0016_personal_notes_workspace\.sql/)).toBeTruthy();
  });

  it("keeps binder-linked learner notes visible while every personal table is missing", () => {
    mocks.personalNotesState.data = {
      ...workspaceWithEntries,
      entries: workspaceWithEntries.entries.filter((entry) => entry.kind === "binder-note"),
      personalNotes: [],
      loadIssues: [
        missingTableIssue("personal_notes"),
        missingTableIssue("personal_note_folders"),
        missingTableIssue("personal_note_binders"),
        missingTableIssue("personal_note_documents"),
      ],
    };

    renderPage();

    expect(screen.getByText("Supabase workspace needs the Personal Notes tables")).toBeTruthy();
    expect(screen.getAllByText("Personal Notes schema is missing")).toHaveLength(4);
    for (const table of [
      "personal_notes",
      "personal_note_folders",
      "personal_note_binders",
      "personal_note_documents",
    ]) {
      expect(screen.getByText(new RegExp(`public\\.${table}`))).toBeTruthy();
    }
    expect(screen.getAllByText("Russian Revolution private note").length).toBeGreaterThan(0);
    expect(screen.queryByText("Personal Notes unavailable")).toBeNull();
  });

  it("gates personal create actions while the personal schema is missing", () => {
    mocks.personalNotesState.data = {
      ...emptyWorkspace,
      loadIssues: [missingTableIssue("personal_notes")],
    };

    renderPage();

    expect((screen.getByRole("button", { name: "New" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "New note" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Create binder" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Create folder" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(screen.queryByRole("dialog", { name: "New note" })).toBeNull();
  });

  it("disables command-palette create commands while the personal schema is missing", () => {
    mocks.personalNotesState.data = {
      ...workspaceWithEntries,
      loadIssues: [missingTableIssue("personal_notes")],
    };

    renderPage("/notes/n/learner-note-1");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const palette = within(screen.getByRole("dialog", { name: "Personal Notes command palette" }));

    for (const command of ["New note", "New binder", "New document", "New folder", "New canvas notebook"]) {
      expect((palette.getByRole("button", { name: new RegExp(command) }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((palette.getByRole("button", { name: /Open source binder workspace/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
