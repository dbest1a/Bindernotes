// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePersonalNotesNavigation } from "@/hooks/use-personal-notes-navigation";
import type { PersonalNote, PersonalNotesEntry } from "@/types";

vi.mock("@/hooks/use-personal-note-search", () => ({
  usePersonalNoteSearch: () => ({ matches: undefined, searching: false, error: null, retry: vi.fn() }),
}));

function entry(id: string, folderName: string, ownerId = "owner-a"): PersonalNotesEntry {
  const content = { type: "doc", content: [{ type: "paragraph" }] };
  const note: PersonalNote = {
    id,
    owner_id: ownerId,
    title: id,
    content,
    math_blocks: [],
    folder_id: null,
    binder_id: `binder-${id}`,
    document_id: null,
    tags: [folderName.toLowerCase()],
    pinned: false,
    archived_at: null,
    created_at: "2026-09-17T00:00:00.000Z",
    updated_at: "2026-09-17T00:00:00.000Z",
  };
  return {
    kind: "personal-note",
    id,
    title: id,
    content,
    excerpt: id,
    searchText: id,
    updated_at: note.updated_at,
    pinned: false,
    folderId: null,
    folderName,
    folderColor: "blue",
    tags: note.tags,
    math_blocks: [],
    sourceType: "Loose note",
    sourceBinderId: null,
    sourceBinderTitle: null,
    sourceDocumentId: null,
    sourceDocumentTitle: null,
    personalBinderId: note.binder_id,
    personalBinderTitle: `Binder ${id}`,
    quickOpenUrl: `/notes/n/${id}`,
    quickJumpToBinderUrl: null,
    note,
    reviewLater: false,
  };
}

const alpha = entry("alpha", "History");
const beta = entry("beta", "Math");
const gamma = entry("gamma", "Math");
const initialEntries = [alpha, beta, gamma];

function setup(paths = ["/notes"], ownerId: string | null = "owner-a", entries = initialEntries) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={paths}>
        <Routes>
          <Route path="/notes" element={children} />
          <Route path="/notes/n/:noteId" element={children} />
          <Route path="/notes/binders/:binderId/documents/:documentId" element={children} />
        </Routes>
      </MemoryRouter>
    );
  }
  return renderHook(
    (props: { ownerId: string | null; entries: PersonalNotesEntry[]; showBinderNotes: boolean }) => ({
      navigation: usePersonalNotesNavigation(props),
      location: useLocation(),
      router: useNavigate(),
    }),
    { wrapper: Wrapper, initialProps: { ownerId, entries, showBinderNotes: true } },
  );
}

afterEach(cleanup);

describe("Personal Notes route and selection coordination", () => {
  it("opens the exact deep-linked entry and does not substitute another note for an unavailable route", () => {
    const view = setup(["/notes/n/beta"]);
    expect(view.result.current.navigation.selectedMetadataEntry?.id).toBe("beta");
    act(() => {
      void view.result.current.router("/notes/n/missing");
    });
    expect(view.result.current.navigation.selectedMetadataEntry).toBeNull();
  });

  it("drills into another binder from an existing note URL and keeps URL, list and editor coherent", () => {
    const view = setup(["/notes/n/beta"]);
    const navigation = () => view.result.current.navigation;
    act(() =>
      navigation().selectNotebookCategory(
        navigation().notebookCategories.find((item) => item.id === "math")!,
      ),
    );
    expect(view.result.current.location.pathname).toBe("/notes");
    expect(navigation().notebookSidebarLevel).toBe("binders");
    act(() =>
      navigation().selectNotebookBinder(
        navigation().notebookHierarchy.bindersById.get("math:personal:binder-gamma")!,
      ),
    );
    expect(view.result.current.location.pathname).toBe("/notes/n/gamma");
    expect(navigation().selectedMetadataEntry?.id).toBe("gamma");
    expect(navigation().notesViewEntries.map((item) => item.id)).toEqual(["gamma"]);
    expect(navigation().notesListTitle).toBe("Math / Binder gamma");
    act(() => navigation().stepBackNotebookSidebar());
    expect(view.result.current.location.pathname).toBe("/notes");
    expect(navigation().notebookSidebarLevel).toBe("binders");
    expect(navigation().notesViewEntries.map((item) => item.id)).toEqual(["beta", "gamma"]);
  });

  it("browser Back clears transient filters that would hide its destination", () => {
    const view = setup(["/notes/n/alpha", "/notes/n/beta"]);
    act(() => view.result.current.navigation.setQuery("gamma"));
    expect(view.result.current.navigation.selectedMetadataEntry?.id).toBe("gamma");
    act(() => {
      void view.result.current.router(-1);
    });
    expect(view.result.current.location.pathname).toBe("/notes/n/alpha");
    expect(view.result.current.navigation.query).toBe("");
    expect(view.result.current.navigation.selectedMetadataEntry?.id).toBe("alpha");
  });

  it("opening a command-palette entry outside the current scope clears the hiding filters", () => {
    const view = setup();
    act(() =>
      view.result.current.navigation.applySavedSearch({
        query: "beta",
        sourceFilter: "all",
        folderName: "Math",
        tag: "math",
      }),
    );
    expect(view.result.current.navigation.notesViewEntries.map((item) => item.id)).toEqual(["beta"]);
    act(() => view.result.current.navigation.selectEntry(alpha));
    expect(view.result.current.location.pathname).toBe("/notes/n/alpha");
    expect(view.result.current.navigation.selectedMetadataEntry?.id).toBe("alpha");
    expect(view.result.current.navigation.query).toBe("");
    expect(view.result.current.navigation.tagFilter).toBeNull();
  });

  it("resets owner-specific state before rendering a new account and retires retained callbacks", () => {
    const view = setup();
    act(() => view.result.current.navigation.setQuery("beta"));
    const retired = view.result.current.navigation;
    const other = entry("other", "Chemistry", "owner-b");
    view.rerender({ ownerId: "owner-b", entries: [...initialEntries, other], showBinderNotes: true });
    expect(view.result.current.navigation.query).toBe("");
    expect(view.result.current.navigation.filteredEntries.map((item) => item.id)).toEqual(["other"]);
    expect(view.result.current.navigation.selectedMetadataEntry?.id).toBe("other");
    act(() => {
      retired.selectEntry(alpha);
      retired.setQuery("alpha");
      retired.navigate("/notes/n/alpha");
    });
    expect(view.result.current.location.pathname).toBe("/notes");
    expect(view.result.current.navigation.query).toBe("");
    expect(view.result.current.navigation.selectedMetadataEntry?.id).toBe("other");
  });

  it("does not reactivate an earlier owner's callbacks when that owner signs in again", () => {
    const view = setup();
    const retired = view.result.current.navigation;
    view.rerender({ ownerId: "owner-b", entries: [], showBinderNotes: true });
    view.rerender({ ownerId: "owner-a", entries: initialEntries, showBinderNotes: true });
    act(() => retired.selectEntry(beta));
    expect(view.result.current.location.pathname).toBe("/notes");
    act(() => view.result.current.navigation.selectEntry(beta));
    expect(view.result.current.location.pathname).toBe("/notes/n/beta");
  });

  it("leaves an empty category empty and reset restores the current owner's list", () => {
    const view = setup(["/notes/n/alpha"]);
    act(() =>
      view.result.current.navigation.selectNotebookCategory(
        view.result.current.navigation.notebookCategories.find((item) => item.id === "chemistry")!,
      ),
    );
    expect(view.result.current.navigation.notesViewEntries).toEqual([]);
    expect(view.result.current.navigation.selectedMetadataEntry).toBeNull();
    act(() => view.result.current.navigation.showAllNotes());
    expect(view.result.current.navigation.selectedMetadataEntry?.id).toBe("alpha");
    expect(view.result.current.navigation.notebookSidebarLevel).toBe("scopes");
  });

  it("distinguishes document routes from a note with the same ID and interprets new-note actions", () => {
    const document: PersonalNotesEntry = {
      ...alpha,
      kind: "personal-document",
      sourceType: "Notebook document",
      quickOpenUrl: "/notes/binders/binder-alpha/documents/alpha",
    };
    const view = setup([document.quickOpenUrl], "owner-a", [alpha, document]);
    expect(view.result.current.navigation.selectedMetadataEntry?.kind).toBe("personal-document");
    act(() => {
      void view.result.current.router("/notes?action=new-note");
    });
    expect(view.result.current.navigation.newNoteRequested).toBe(true);
  });
});
