import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { usePersonalNoteSearch } from "@/hooks/use-personal-note-search";
import { filterPersonalNotesEntries } from "@/lib/personal-notes";
import {
  buildNotebookCategories,
  buildNotebookHierarchy,
  entriesForNotebookCategory,
  resolveSelectedCategoryId,
  type NotebookBinderNode,
  type NotebookCategory,
  type NotebookSidebarLevel,
} from "@/lib/personal-notes-navigation";
import type { PersonalNotesEntry, PersonalNotesSourceFilter } from "@/types";

type NavigationContext = { ownerId: string | null };
type NavigationState = {
  context: NavigationContext;
  pathname: string;
  query: string;
  sourceFilter: PersonalNotesSourceFilter;
  folderFilter: string | null;
  tagFilter: string | null;
  selectedId: string | null;
  notebookSidebarLevel: NotebookSidebarLevel;
  selectedNotebookScopeId: string;
  selectedNotebookBinderId: string | null;
};

type SavedSearch = {
  query: string;
  sourceFilter: PersonalNotesSourceFilter;
  folderName: string | null;
  tag: string | null;
};

function initialNavigation(context: NavigationContext, pathname: string): NavigationState {
  return {
    context,
    pathname,
    query: "",
    sourceFilter: "all",
    folderFilter: null,
    tagFilter: null,
    selectedId: null,
    notebookSidebarLevel: "scopes",
    selectedNotebookScopeId: "all",
    selectedNotebookBinderId: null,
  };
}

/** Transient navigation only. Content and pending writes belong to the revisioned editor. */
export function usePersonalNotesNavigation({
  ownerId,
  entries,
  showBinderNotes,
}: {
  ownerId: string | null;
  entries: PersonalNotesEntry[];
  showBinderNotes: boolean;
}) {
  const params = useParams<{ noteId: string; documentId: string }>();
  const { pathname } = useLocation();
  const routerNavigate = useNavigate();
  const [searchParams] = useSearchParams();
  // An A -> B -> A transition is a new context, not permission for an old A callback.
  const context = useMemo<NavigationContext>(() => ({ ownerId }), [ownerId]);
  const currentContext = useRef<NavigationContext | null>(context);
  currentContext.current = context;
  const [stored, setStored] = useState(() => initialNavigation(context, pathname));
  const state =
    stored.context === context && stored.pathname === pathname
      ? stored
      : initialNavigation(context, pathname);

  useEffect(() => {
    currentContext.current = context;
    setStored((previous) =>
      previous.context === context && previous.pathname === pathname
        ? previous
        : initialNavigation(context, pathname),
    );
    return () => {
      if (currentContext.current === context) currentContext.current = null;
    };
  }, [context, pathname]);

  const ownedEntries = useMemo(
    () => entries.filter((entry) => Boolean(ownerId) && entry.note.owner_id === ownerId),
    [entries, ownerId],
  );
  const bodySearch = usePersonalNoteSearch(
    ownerId ?? undefined,
    state.query,
    ownedEntries.some((entry) => entry.contentLoaded === false),
  );
  const filteredEntries = useMemo(
    () =>
      filterPersonalNotesEntries(ownedEntries, {
        query: state.query,
        bodyMatches: bodySearch.matches,
        sourceFilter: state.sourceFilter,
        showBinderNotes,
        folderName: state.folderFilter,
        tag: state.tagFilter,
      }),
    [
      ownedEntries,
      state.query,
      state.sourceFilter,
      state.folderFilter,
      state.tagFilter,
      showBinderNotes,
      bodySearch.matches,
    ],
  );
  const notebookCategories = useMemo(
    () => buildNotebookCategories(ownedEntries, showBinderNotes),
    [ownedEntries, showBinderNotes],
  );
  const notebookTreeEntries = useMemo(
    () => (showBinderNotes ? ownedEntries : ownedEntries.filter((entry) => entry.kind !== "binder-note")),
    [ownedEntries, showBinderNotes],
  );
  const notebookHierarchy = useMemo(
    () => buildNotebookHierarchy(notebookTreeEntries, notebookCategories),
    [notebookTreeEntries, notebookCategories],
  );
  const selectedCategoryId = resolveSelectedCategoryId(
    notebookCategories,
    state.sourceFilter,
    state.folderFilter,
  );
  const selectedNotebookScope =
    notebookCategories.find((category) => category.id === state.selectedNotebookScopeId) ??
    notebookCategories[0];
  const selectedNotebookBinder = state.selectedNotebookBinderId
    ? (notebookHierarchy.bindersById.get(state.selectedNotebookBinderId) ?? null)
    : null;
  const notesViewEntries = useMemo(() => {
    const candidates =
      selectedNotebookBinder?.entries ??
      (selectedNotebookScope
        ? entriesForNotebookCategory(notebookTreeEntries, selectedNotebookScope)
        : notebookTreeEntries);
    return filterPersonalNotesEntries(candidates, {
      query: state.query,
      bodyMatches: bodySearch.matches,
      sourceFilter: state.sourceFilter,
      showBinderNotes,
      folderName: state.folderFilter,
      tag: state.tagFilter,
    });
  }, [
    notebookTreeEntries,
    selectedNotebookBinder,
    selectedNotebookScope,
    state.query,
    state.sourceFilter,
    state.folderFilter,
    state.tagFilter,
    showBinderNotes,
    bodySearch.matches,
  ]);

  const selectedMetadataEntry = useMemo(() => {
    if (params.documentId)
      return (
        filteredEntries.find(
          (entry) => entry.kind === "personal-document" && entry.id === params.documentId,
        ) ?? null
      );
    if (params.noteId)
      return (
        filteredEntries.find((entry) => entry.kind !== "personal-document" && entry.id === params.noteId) ??
        null
      );
    return notesViewEntries.find((entry) => entry.id === state.selectedId) ?? notesViewEntries[0] ?? null;
  }, [filteredEntries, notesViewEntries, params.documentId, params.noteId, state.selectedId]);

  const transition = useCallback(
    (change: (previous: NavigationState) => NavigationState, destination = pathname, replace = false) => {
      if (!ownerId || currentContext.current !== context) return;
      setStored((previous) => ({
        ...change(
          previous.context === context && previous.pathname === pathname
            ? previous
            : initialNavigation(context, pathname),
        ),
        context,
        pathname: destination,
      }));
      if (destination !== pathname) void routerNavigate(destination, { replace });
    },
    [context, ownerId, pathname, routerNavigate],
  );

  const setQuery = useCallback(
    (query: string) => transition((previous) => ({ ...previous, query, selectedId: null }), "/notes", true),
    [transition],
  );
  const setSourceFilter = useCallback(
    (sourceFilter: PersonalNotesSourceFilter) =>
      transition((previous) => ({ ...previous, sourceFilter, selectedId: null }), "/notes", true),
    [transition],
  );
  const setTagFilter = useCallback(
    (tagFilter: string | null) =>
      transition((previous) => ({ ...previous, tagFilter, selectedId: null }), "/notes", true),
    [transition],
  );
  const applySavedSearch = useCallback(
    (search: SavedSearch) =>
      transition(
        () => ({
          ...initialNavigation(context, "/notes"),
          query: search.query,
          sourceFilter: search.sourceFilter,
          folderFilter: search.folderName,
          tagFilter: search.tag,
        }),
        "/notes",
        true,
      ),
    [context, transition],
  );
  const selectNotebookCategory = useCallback(
    (requested: NotebookCategory) => {
      const category = notebookCategories.find((candidate) => candidate.id === requested.id);
      if (!category) return;
      transition(
        (previous) => ({
          ...previous,
          notebookSidebarLevel: "binders",
          selectedNotebookScopeId: category.id,
          selectedNotebookBinderId: null,
          sourceFilter: category.sourceFilter,
          folderFilter: category.folderName,
          tagFilter: null,
          selectedId: null,
        }),
        "/notes",
        true,
      );
    },
    [notebookCategories, transition],
  );
  const selectNotebookBinder = useCallback(
    (requested: NotebookBinderNode) => {
      const binder = notebookHierarchy.bindersById.get(requested.id);
      const first = binder?.entries[0];
      if (!binder || !first) return;
      const scope = notebookCategories.find((category) => category.id === binder.scopeId);
      transition(
        (previous) => ({
          ...previous,
          query: "",
          notebookSidebarLevel: "binder",
          selectedNotebookScopeId: binder.scopeId,
          selectedNotebookBinderId: binder.id,
          sourceFilter: scope?.sourceFilter ?? "all",
          folderFilter: scope?.folderName ?? null,
          tagFilter: null,
          selectedId: first.id,
        }),
        first.quickOpenUrl,
      );
    },
    [notebookCategories, notebookHierarchy, transition],
  );
  const stepBackNotebookSidebar = useCallback(
    () =>
      transition(
        (previous) =>
          previous.notebookSidebarLevel === "binder"
            ? {
                ...previous,
                notebookSidebarLevel: "binders",
                selectedNotebookBinderId: null,
                selectedId: null,
              }
            : initialNavigation(context, "/notes"),
        "/notes",
        true,
      ),
    [context, transition],
  );
  const showAllNotes = useCallback(
    () => transition(() => initialNavigation(context, "/notes"), "/notes", true),
    [context, transition],
  );
  const selectEntry = useCallback(
    (requested: PersonalNotesEntry) => {
      const entry = ownedEntries.find(
        (candidate) => candidate.id === requested.id && candidate.kind === requested.kind,
      );
      if (!entry) return;
      const visible = notesViewEntries.some(
        (candidate) => candidate.id === entry.id && candidate.kind === entry.kind,
      );
      transition(
        (previous) => ({
          ...(visible ? previous : initialNavigation(context, pathname)),
          selectedId: entry.id,
        }),
        entry.quickOpenUrl,
      );
    },
    [context, ownedEntries, notesViewEntries, pathname, transition],
  );
  const navigate = useCallback(
    (destination: string) => {
      if (!ownerId || currentContext.current !== context) return;
      void routerNavigate(destination);
    },
    [context, ownerId, routerNavigate],
  );

  return {
    query: state.query,
    setQuery,
    sourceFilter: state.sourceFilter,
    setSourceFilter,
    folderFilter: state.folderFilter,
    tagFilter: state.tagFilter,
    setTagFilter,
    bodySearch,
    filteredEntries,
    notebookCategories,
    notebookTreeEntries,
    notebookHierarchy,
    selectedCategoryId,
    selectedNotebookScope,
    selectedNotebookBinder,
    notesViewEntries,
    notesListTitle: selectedNotebookBinder
      ? `${selectedNotebookBinder.scopeLabel} / ${selectedNotebookBinder.title}`
      : (selectedNotebookScope?.label ?? "All notes"),
    notebookSidebarLevel: state.notebookSidebarLevel,
    selectedMetadataEntry,
    newNoteRequested: searchParams.get("action") === "new-note",
    applySavedSearch,
    selectNotebookCategory,
    selectNotebookBinder,
    stepBackNotebookSidebar,
    showAllNotes,
    selectEntry,
    navigate,
  };
}
