import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Editor, JSONContent } from "@tiptap/react";
import {
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  BookMarked,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  FilePlus2,
  FileText,
  FolderPlus,
  Focus,
  GripVertical,
  Highlighter,
  Layers3,
  LayoutGrid,
  Link2,
  ListFilter,
  Maximize2,
  MessageSquare,
  NotebookTabs,
  PanelLeft,
  Pin,
  Plus,
  Save,
  Search,
  Settings2,
  Sparkles,
  Tags,
  Underline,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { WorkspaceWindow } from "@/components/workspace/workspace-window";
import { useAuth } from "@/hooks/use-auth";
import {
  usePersonalNotes,
  usePersonalNotesMutations,
  usePersonalNotesPreferences,
} from "@/hooks/use-personal-notes";
import {
  filterPersonalNotesEntries,
  getPersonalNoteHealth,
  getPersonalNoteReviewQueue,
  personalNoteTemplates,
} from "@/lib/personal-notes";
import { emptyDoc } from "@/lib/utils";
import { extractPlainText } from "@/lib/workspace-records";
import type {
  LearnerNote,
  PersonalNote,
  PersonalNoteFolder,
  PersonalNotebookDocument,
  PersonalNotesAnnotatorMode,
  PersonalNotesEntry,
  PersonalNotesEditorWidth,
  PersonalNotesLoadIssue,
  PersonalNotesPreferences,
  PersonalNotesSidebarNavigationMode,
  PersonalNotesSourceFilter,
  PersonalNotesViewMode,
  WorkspaceModuleId,
  WorkspaceWindowFrame,
} from "@/types";

type SaveState = "saved" | "saving" | "error";
type CreateDialogKind = "note" | "binder" | "document" | "folder" | "canvas" | "tag" | "move-folder";
type PersonalNotesMutations = ReturnType<typeof usePersonalNotesMutations>;
type AnnotationHighlightFilter = "all" | "yellow" | "blue" | "green" | "pink";
type AnnotationRecord = {
  id: string;
  type: "highlight" | "comment" | "link" | "tag" | "source-marker";
  label: string;
  color: AnnotationHighlightFilter;
  text: string;
};
type NotebookCategory = {
  id: string;
  label: string;
  count: number;
  color: string;
  sourceFilter: PersonalNotesSourceFilter;
  folderName: string | null;
};
type NotebookSidebarLevel = "scopes" | "binders" | "binder";
type NotebookBinderNode = {
  id: string;
  groupId: string;
  title: string;
  count: number;
  entries: PersonalNotesEntry[];
  scopeId: string;
  scopeLabel: string;
  sourceUrl: string | null;
  kind: "source-binder" | "personal-binder";
};
type NotebookHierarchy = {
  bindersById: Map<string, NotebookBinderNode>;
  bindersByScope: Record<string, NotebookBinderNode[]>;
};
type OrganizeCard = {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  kind: "quick-access" | "folder" | "binder" | "document" | "loose" | "linked";
  tone: string;
};
type OrganizeToast = {
  message: string;
  type: "success" | "error";
};

const sourceFilterOptions: Array<{
  value: PersonalNotesSourceFilter;
  label: string;
}> = [
  { value: "all", label: "All notes" },
  { value: "main", label: "Main notes only" },
  { value: "binder-linked", label: "Binder-linked notes only" },
  { value: "personal-binders", label: "Personal binders/documents only" },
  { value: "loose", label: "Loose notes only" },
];

const savedSearchChips = [
  { label: "Recent", query: "", sourceFilter: "all" as PersonalNotesSourceFilter, tag: null, folderName: null },
  { label: "Pinned", query: "pinned", sourceFilter: "all" as PersonalNotesSourceFilter, tag: null, folderName: null },
  { label: "Binder-linked", query: "", sourceFilter: "binder-linked" as PersonalNotesSourceFilter, tag: null, folderName: null },
  { label: "Loose notes", query: "", sourceFilter: "loose" as PersonalNotesSourceFilter, tag: null, folderName: null },
  { label: "Math", query: "math", sourceFilter: "all" as PersonalNotesSourceFilter, tag: null, folderName: null },
  { label: "History", query: "history", sourceFilter: "all" as PersonalNotesSourceFilter, tag: null, folderName: null },
  { label: "Review later", query: "", sourceFilter: "all" as PersonalNotesSourceFilter, tag: "review-later", folderName: null },
  { label: "Has formulas", query: "formula math", sourceFilter: "all" as PersonalNotesSourceFilter, tag: null, folderName: null },
  { label: "Untitled", query: "untitled", sourceFilter: "all" as PersonalNotesSourceFilter, tag: null, folderName: null },
  { label: "Unfiled", query: "", sourceFilter: "all" as PersonalNotesSourceFilter, tag: null, folderName: "Unfiled" },
];

const editorWidthOptions: Array<{ value: PersonalNotesEditorWidth; label: string }> = [
  { value: "focused", label: "Focused" },
  { value: "comfortable", label: "Comfortable" },
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full" },
];

const annotationHighlightColors: Array<{
  value: Exclude<AnnotationHighlightFilter, "all">;
  label: string;
  color: string;
  swatch: string;
}> = [
  { value: "yellow", label: "Yellow", color: "#fde68a", swatch: "bg-amber-300" },
  { value: "blue", label: "Blue", color: "#93c5fd", swatch: "bg-sky-300" },
  { value: "green", label: "Green", color: "#86efac", swatch: "bg-emerald-300" },
  { value: "pink", label: "Pink/Purple", color: "#d8b4fe", swatch: "bg-violet-300" },
];

const defaultCanvasFrames: Record<WorkspaceModuleId, WorkspaceWindowFrame> = {
  "private-notes": { x: 24, y: 24, w: 520, h: 500, z: 4 },
  search: { x: 576, y: 24, w: 340, h: 250, z: 3 },
  "binder-notebook": { x: 24, y: 560, w: 520, h: 320, z: 2 },
  tasks: { x: 576, y: 310, w: 380, h: 320, z: 2 },
  "formula-sheet": { x: 980, y: 24, w: 340, h: 440, z: 1 },
  whiteboard: { x: 980, y: 500, w: 340, h: 300, z: 1 },
  lesson: { x: 0, y: 0, w: 0, h: 0, z: 0 },
  comments: { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "desmos-graph": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  flashcards: { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "graph-panel": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "history-argument": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "history-evidence": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "history-myth-checks": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "history-timeline": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "lesson-outline": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "math-blocks": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "mini-tools": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "recent-highlights": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "related-concepts": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "saved-graphs": { x: 0, y: 0, w: 0, h: 0, z: 0 },
  "scientific-calculator": { x: 0, y: 0, w: 0, h: 0, z: 0 },
};

const canvasModuleIds: WorkspaceModuleId[] = [
  "private-notes",
  "search",
  "binder-notebook",
  "tasks",
  "formula-sheet",
  "whiteboard",
];

export function PersonalNotesPage() {
  const { profile } = useAuth();
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, isLoading, error, refetch: refetchPersonalNotes } = usePersonalNotes(profile);
  const mutations = usePersonalNotesMutations(profile);
  const [preferences, updatePreferences] = usePersonalNotesPreferences(profile);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<PersonalNotesSourceFilter>("all");
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notebookSidebarLevel, setNotebookSidebarLevel] = useState<NotebookSidebarLevel>("scopes");
  const [selectedNotebookScopeId, setSelectedNotebookScopeId] = useState("all");
  const [selectedNotebookBinderId, setSelectedNotebookBinderId] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [createDialog, setCreateDialog] = useState<CreateDialogKind | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarsHidden, setSidebarsHidden] = useState(false);
  const [topChromeHidden, setTopChromeHidden] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState<JSONContent>(() => emptyDoc(""));
  const [draftTagsInput, setDraftTagsInput] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const newMenuRef = useRef<HTMLDivElement | null>(null);
  const newButtonRef = useRef<HTMLButtonElement | null>(null);

  const entries = data?.entries ?? [];
  const filteredEntries = useMemo(
    () =>
      filterPersonalNotesEntries(entries, {
        query,
        sourceFilter,
        showBinderNotes: preferences.showBinderNotes,
        folderName: folderFilter,
        tag: tagFilter,
      }),
    [entries, folderFilter, preferences.showBinderNotes, query, sourceFilter, tagFilter],
  );
  const reviewQueue = useMemo(() => getPersonalNoteReviewQueue(entries), [entries]);
  const notebookCategories = useMemo(
    () => buildNotebookCategories(entries, preferences.showBinderNotes),
    [entries, preferences.showBinderNotes],
  );
  const notebookTreeEntries = useMemo(
    () => (preferences.showBinderNotes ? entries : entries.filter((entry) => entry.kind !== "binder-note")),
    [entries, preferences.showBinderNotes],
  );
  const notebookHierarchy = useMemo(
    () => buildNotebookHierarchy(notebookTreeEntries, notebookCategories),
    [notebookCategories, notebookTreeEntries],
  );
  const selectedCategoryId = useMemo(
    () => resolveSelectedCategoryId(notebookCategories, sourceFilter, folderFilter),
    [folderFilter, notebookCategories, sourceFilter],
  );
  const selectedCategory = notebookCategories.find((category) => category.id === selectedCategoryId) ?? notebookCategories[0];
  const selectedNotebookScope =
    notebookCategories.find((category) => category.id === selectedNotebookScopeId) ?? notebookCategories[0];
  const selectedNotebookBinder = selectedNotebookBinderId
    ? notebookHierarchy.bindersById.get(selectedNotebookBinderId) ?? null
    : null;
  const notesViewEntries = useMemo(() => {
    const baseEntries = selectedNotebookBinder
      ? selectedNotebookBinder.entries
      : selectedNotebookScope
        ? entriesForNotebookCategory(notebookTreeEntries, selectedNotebookScope)
        : notebookTreeEntries;
    return filterPersonalNotesEntries(baseEntries, {
      query,
      sourceFilter: "all",
      showBinderNotes: preferences.showBinderNotes,
      folderName: null,
      tag: tagFilter,
    });
  }, [notebookTreeEntries, preferences.showBinderNotes, query, selectedNotebookBinder, selectedNotebookScope, tagFilter]);
  const notesListTitle = selectedNotebookBinder
    ? `${selectedNotebookBinder.scopeLabel} / ${selectedNotebookBinder.title}`
    : selectedNotebookScope?.label ?? (selectedCategory?.id === "all" ? "All notes" : `${selectedCategory?.label ?? "All"} notes`);
  const routeSelectedId = params.noteId ?? params.documentId ?? null;
  const selectedEntry = useMemo(() => {
    const wanted = routeSelectedId ?? selectedId;
    return filteredEntries.find((entry) => entry.id === wanted) ?? filteredEntries[0] ?? null;
  }, [filteredEntries, routeSelectedId, selectedId]);
  const folderSummaries = useMemo(() => buildFolderSummaries(entries), [entries]);
  const tagSummaries = useMemo(() => buildTagSummaries(entries), [entries]);
  const mainNotesCount = entries.filter((entry) => entry.kind !== "binder-note").length;
  const binderLinkedCount = entries.filter((entry) => entry.kind === "binder-note").length;
  const personalDocumentsCount = entries.filter((entry) => entry.kind === "personal-document").length;
  const personalStorageReady = !data?.loadIssues?.some((issue) =>
    issue.code === "personal_schema_missing" || issue.code === "personal_schema_blocked",
  );

  const setView = useCallback(
    (view: PersonalNotesViewMode) => {
      updatePreferences({ defaultView: view });
    },
    [updatePreferences],
  );

  const applySavedSearch = useCallback((chip: (typeof savedSearchChips)[number]) => {
    setQuery(chip.query);
    setSourceFilter(chip.sourceFilter);
    setTagFilter(chip.tag);
    setFolderFilter(chip.folderName);
  }, []);

  const selectNotebookCategory = useCallback((category: NotebookCategory) => {
    setNotebookSidebarLevel("binders");
    setSelectedNotebookScopeId(category.id);
    setSelectedNotebookBinderId(null);
    setSourceFilter(category.sourceFilter);
    setFolderFilter(category.folderName);
    setTagFilter(null);
    setSelectedId(null);
  }, []);

  const selectNotebookBinder = useCallback((binder: NotebookBinderNode) => {
    setNotebookSidebarLevel("binder");
    setSelectedNotebookScopeId(binder.scopeId);
    setSelectedNotebookBinderId(binder.id);
    setTagFilter(null);
    const firstEntry = binder.entries[0];
    if (firstEntry) {
      setSelectedId(firstEntry.id);
    }
  }, []);

  const stepBackNotebookSidebar = useCallback(() => {
    if (notebookSidebarLevel === "binder") {
      setNotebookSidebarLevel("binders");
      setSelectedNotebookBinderId(null);
      setSelectedId(null);
      return;
    }
    if (notebookSidebarLevel === "binders") {
      setNotebookSidebarLevel("scopes");
      setSelectedNotebookBinderId(null);
      setSelectedNotebookScopeId("all");
      setSourceFilter("all");
      setFolderFilter(null);
      setTagFilter(null);
      setSelectedId(null);
    }
  }, [notebookSidebarLevel]);

  const showAllNotes = useCallback(() => {
    setQuery("");
    setSourceFilter("all");
    setFolderFilter(null);
    setTagFilter(null);
    setSelectedId(null);
    setNotebookSidebarLevel("scopes");
    setSelectedNotebookScopeId("all");
    setSelectedNotebookBinderId(null);
  }, []);

  useEffect(() => {
    if (routeSelectedId || selectedId || filteredEntries.length === 0) {
      return;
    }
    setSelectedId(filteredEntries[0].id);
  }, [filteredEntries, routeSelectedId, selectedId]);

  useEffect(() => {
    if (!selectedEntry) {
      setDraftTitle("");
      setDraftContent(emptyDoc(""));
      setDraftTagsInput("");
      setDirty(false);
      setSaveState("saved");
      return;
    }

    setDraftTitle(selectedEntry.title);
    setDraftContent(selectedEntry.content);
    setDraftTagsInput(selectedEntry.tags.join(", "));
    setDirty(false);
    setSaveState("saved");
    setSaveError(null);
  }, [selectedEntry?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "\\") {
        event.preventDefault();
        setSidebarsHidden((current) => !current);
      }
      if (event.key === "Escape") {
        if (filtersOpen || newMenuOpen) {
          setFiltersOpen(false);
          setNewMenuOpen(false);
          return;
        }
        if (commandOpen) {
          setCommandOpen(false);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (focusMode || preferences.focusMode) {
          setFocusMode(false);
          updatePreferences({ focusMode: false });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandOpen, filtersOpen, focusMode, newMenuOpen, preferences.focusMode, settingsOpen, updatePreferences]);

  useEffect(() => {
    if (!filtersOpen && !newMenuOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        filtersOpen
        && !filterMenuRef.current?.contains(target)
        && !filterButtonRef.current?.contains(target)
      ) {
        setFiltersOpen(false);
      }

      if (
        newMenuOpen
        && !newMenuRef.current?.contains(target)
        && !newButtonRef.current?.contains(target)
      ) {
        setNewMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [filtersOpen, newMenuOpen]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const selectEntry = useCallback(
    (entry: PersonalNotesEntry) => {
      setSelectedId(entry.id);
      navigate(entry.quickOpenUrl);
    },
    [navigate],
  );

  const persistSelected = useCallback(async () => {
    if (!selectedEntry) {
      return;
    }

    setSaveState("saving");
    setSaveError(null);
    const tags = parseTags(draftTagsInput);

    try {
      if (selectedEntry.kind === "binder-note") {
        const learnerNote = selectedEntry.note as LearnerNote;
        await mutations.saveBinderLinkedNote.mutateAsync({
          id: selectedEntry.id,
          binderId: selectedEntry.sourceBinderId ?? learnerNote.binder_id,
          lessonId: selectedEntry.sourceDocumentId ?? learnerNote.lesson_id,
          folderId: learnerNote.folder_id,
          title: draftTitle,
          content: draftContent,
          mathBlocks: learnerNote.math_blocks,
        });
      } else if (selectedEntry.kind === "personal-document") {
        const document = selectedEntry.note as PersonalNotebookDocument;
        await mutations.savePersonalDocument.mutateAsync({
          id: selectedEntry.id,
          binderId: selectedEntry.personalBinderId ?? document.binder_id,
          title: draftTitle,
          content: draftContent,
          mathBlocks: document.math_blocks,
          tags,
          pinned: selectedEntry.pinned,
        });
      } else {
        const note = selectedEntry.note as PersonalNote;
        await mutations.savePersonalNote.mutateAsync({
          id: selectedEntry.id,
          title: draftTitle,
          content: draftContent,
          mathBlocks: note.math_blocks,
          folderId: note.folder_id,
          binderId: note.binder_id,
          documentId: note.document_id,
          tags,
          pinned: selectedEntry.pinned,
        });
      }
      setDirty(false);
      setSaveState("saved");
    } catch (saveErrorValue) {
      setSaveState("error");
      setSaveError(saveErrorValue instanceof Error ? saveErrorValue.message : "Could not save note.");
    }
  }, [draftContent, draftTagsInput, draftTitle, mutations, selectedEntry]);

  useEffect(() => {
    if (!dirty || !preferences.autosave || !selectedEntry) {
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void persistSelected();
    }, 850);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [dirty, draftContent, draftTagsInput, draftTitle, persistSelected, preferences.autosave, selectedEntry]);

  const markDraftChanged = useCallback(() => {
    setDirty(true);
    setSaveState("saved");
    setSaveError(null);
  }, []);

  const createLooseNote = useCallback(() => {
    if (!personalStorageReady) {
      return;
    }
    setCreateDialog("note");
  }, [personalStorageReady]);

  const createFolder = useCallback(() => {
    if (!personalStorageReady) {
      return;
    }
    setCreateDialog("folder");
  }, [personalStorageReady]);

  const createBinder = useCallback(() => {
    if (!personalStorageReady) {
      return;
    }
    setCreateDialog("binder");
  }, [personalStorageReady]);

  const createDocument = useCallback(() => {
    if (!personalStorageReady) {
      return;
    }
    setCreateDialog("document");
  }, [personalStorageReady]);

  const createCanvasNotebook = useCallback(() => {
    if (!personalStorageReady) {
      return;
    }
    setCreateDialog("canvas");
  }, [personalStorageReady]);

  const toggleSelectedPin = useCallback(async () => {
    if (!selectedEntry || selectedEntry.kind === "binder-note") {
      return;
    }

    await mutations.setPinned.mutateAsync({
      kind: selectedEntry.kind,
      id: selectedEntry.id,
      pinned: !selectedEntry.pinned,
    });
  }, [mutations.setPinned, selectedEntry]);

  const addTagToSelected = useCallback(async () => {
    if (!selectedEntry || selectedEntry.kind === "binder-note") {
      return;
    }
    setCreateDialog("tag");
  }, [selectedEntry]);

  const moveSelectedToFolder = useCallback(async () => {
    if (!selectedEntry || selectedEntry.kind !== "personal-note" || !data?.personalFolders.length) {
      return;
    }
    setCreateDialog("move-folder");
  }, [data?.personalFolders.length, selectedEntry]);

  const submitTagForSelected = useCallback((tag: string) => {
    if (!selectedEntry || selectedEntry.kind === "binder-note") {
      return;
    }
    const nextTags = [...new Set([...parseTags(draftTagsInput), tag.trim()])];
    setDraftTagsInput(nextTags.join(", "));
    setDirty(true);
    window.setTimeout(() => {
      void persistSelected();
    }, 0);
  }, [draftTagsInput, persistSelected, selectedEntry]);

  const submitMoveSelectedToFolder = useCallback(async (folderId: string | null) => {
    if (!selectedEntry || selectedEntry.kind !== "personal-note") {
      return;
    }

    const note = selectedEntry.note as PersonalNote;
    await mutations.savePersonalNote.mutateAsync({
      id: selectedEntry.id,
      title: draftTitle,
      content: draftContent,
      mathBlocks: note.math_blocks,
      folderId,
      binderId: note.binder_id,
      documentId: note.document_id,
      tags: parseTags(draftTagsInput),
      pinned: note.pinned,
    });
  }, [draftContent, draftTagsInput, draftTitle, mutations.savePersonalNote, selectedEntry]);

  useEffect(() => {
    if (searchParams.get("action") === "new-note" && !selectedEntry && !isLoading) {
      void createLooseNote();
    }
  }, [createLooseNote, isLoading, searchParams, selectedEntry]);

  const focusActive = focusMode || preferences.focusMode;
  const sidebarsAreHidden = sidebarsHidden || focusActive;
  const topChromeIsHidden = topChromeHidden || focusActive;

  const enterFullscreenFocus = useCallback(() => {
    setFocusMode(true);
    updatePreferences({ focusMode: true });
    const root = document.documentElement;
    if (preferences.fullscreenFocusEnabled && root.requestFullscreen && !document.fullscreenElement) {
      void root.requestFullscreen().catch(() => {
        // App-level focus mode is already active when browser fullscreen is unavailable.
      });
    }
  }, [preferences.fullscreenFocusEnabled, updatePreferences]);

  const editorPanel = (
    <PersonalNoteEditor
      dirty={dirty}
      draftContent={draftContent}
      draftTagsInput={draftTagsInput}
      draftTitle={draftTitle}
      entry={selectedEntry}
      entries={entries}
      editorWidth={preferences.editorWidth}
      focusMode={focusActive}
      annotatorMode={preferences.annotatorTools}
      compactMetadata={preferences.compactMetadata}
      noteLinkAutocomplete={preferences.noteLinkAutocomplete}
      showAnnotationColorFilter={preferences.showAnnotationColorFilter}
      onAddTag={addTagToSelected}
      onContentChange={(content) => {
        setDraftContent(content);
        markDraftChanged();
      }}
      onEditorWidthChange={(editorWidth) => updatePreferences({ editorWidth })}
      onFocusModeChange={(enabled) => {
        setFocusMode(enabled);
        updatePreferences({ focusMode: enabled });
      }}
      onInsertTemplate={(content) => {
        setDraftContent(content);
        markDraftChanged();
      }}
      onOpenBinder={() => {
        if (selectedEntry?.quickJumpToBinderUrl) {
          navigate(selectedEntry.quickJumpToBinderUrl);
        }
      }}
      onPin={toggleSelectedPin}
      onRetrySave={() => void persistSelected()}
      onSave={() => void persistSelected()}
      onTagsChange={(tags) => {
        setDraftTagsInput(tags);
        markDraftChanged();
      }}
      onTitleChange={(title) => {
        setDraftTitle(title);
        markDraftChanged();
      }}
      saveError={saveError}
      saveState={saveState}
    />
  );

  const shellTone =
    preferences.style === "studio"
      ? "bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--secondary)/0.46))]"
      : "bg-background";

  return (
    <main
      className={`min-h-[calc(100vh-3.25rem)] overflow-hidden ${shellTone}`}
      data-app-appearance={preferences.style}
      data-app-style={preferences.style}
      data-maximize-module-space={preferences.maximizeModuleSpace ? "true" : "false"}
    >
      <section
        className="relative flex h-[calc(100vh-3.25rem)] max-w-none flex-col overflow-hidden"
        data-app-appearance={preferences.style}
        data-notes-focus-mode={focusActive ? "true" : "false"}
        data-notes-sidebars-hidden={sidebarsAreHidden ? "true" : "false"}
        data-notes-top-chrome-hidden={topChromeIsHidden ? "true" : "false"}
        data-personal-notes-view={preferences.defaultView}
        data-personal-storage-ready={personalStorageReady ? "true" : "false"}
        data-testid="personal-notes-shell"
      >
        {topChromeIsHidden ? (
          <Button
            aria-label="Show Personal Notes toolbar"
            className="fixed bottom-4 right-4 z-50 shadow-2xl"
            data-testid="show-personal-notes-toolbar-button"
            onClick={() => {
              setTopChromeHidden(false);
              if (focusActive) {
                setFocusMode(false);
                updatePreferences({ focusMode: false });
              }
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <PanelLeft data-icon="inline-start" />
            Show toolbar
          </Button>
        ) : (
          <>
            <div className="z-20 shrink-0 border-b border-border/70 bg-background/95 px-2 py-2 shadow-sm backdrop-blur sm:px-3">
              <div className="flex min-h-11 min-w-0 items-center gap-2">
                <div className="flex min-w-0 shrink-0 items-center gap-2">
                  <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">Personal Notes</h1>
                  <Badge className="hidden sm:inline-flex" variant="secondary">{mainNotesCount} main</Badge>
                  <Badge className="hidden lg:inline-flex" variant="secondary">{binderLinkedCount} linked</Badge>
                  <Badge className="hidden xl:inline-flex" variant="secondary">{personalDocumentsCount} docs</Badge>
                  <Badge className="hidden sm:inline-flex" variant={dirty ? "destructive" : "outline"}>
                    {dirty ? "Unsaved" : saveState === "saving" ? "Saving" : "Synced"}
                  </Badge>
                </div>

                <label className="relative min-w-[160px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search Personal Notes"
                    className="h-9 border-border/70 bg-secondary/35 pl-9 text-sm"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search or type a command"
                    value={query}
                  />
                </label>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    aria-expanded={filtersOpen}
                    aria-haspopup="menu"
                    aria-controls="personal-notes-filter-menu"
                    aria-label="Open note filters"
                    onClick={() => {
                      setFiltersOpen((current) => !current);
                      setNewMenuOpen(false);
                    }}
                    ref={filterButtonRef}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <ListFilter />
                  </Button>
                  <Button
                    aria-pressed={preferences.showBinderNotes}
                    className="hidden md:inline-flex"
                    onClick={() => updatePreferences({ showBinderNotes: !preferences.showBinderNotes })}
                    size="sm"
                    type="button"
                    variant={preferences.showBinderNotes ? "secondary" : "outline"}
                  >
                    Binder {preferences.showBinderNotes ? "ON" : "OFF"}
                  </Button>
                  <Button
                    aria-expanded={newMenuOpen}
                    aria-haspopup="menu"
                    aria-controls="personal-notes-new-menu"
                    disabled={!personalStorageReady}
                    onClick={() => {
                      setNewMenuOpen((current) => !current);
                      setFiltersOpen(false);
                    }}
                    ref={newButtonRef}
                    size="sm"
                    type="button"
                  >
                    <Plus data-icon="inline-start" />
                    New
                  </Button>
                  <TabsList aria-label="Personal Notes view" className="hidden rounded-md p-0.5 shadow-none md:inline-flex">
                    <TabsTrigger
                      active={preferences.defaultView === "notes"}
                      aria-label="Notes view"
                      className="px-2 py-1.5 text-xs"
                      onClick={() => setView("notes")}
                      type="button"
                    >
                      <FileText data-icon="inline-start" />
                      Notes
                    </TabsTrigger>
                    <TabsTrigger
                      active={preferences.defaultView === "home"}
                      aria-label="Home view"
                      className="px-2 py-1.5 text-xs"
                      onClick={() => setView("home")}
                      type="button"
                    >
                      <NotebookTabs data-icon="inline-start" />
                      Home
                    </TabsTrigger>
                    <TabsTrigger
                      active={preferences.defaultView === "organize"}
                      aria-label="Organize view"
                      className="px-2 py-1.5 text-xs"
                      onClick={() => setView("organize")}
                      type="button"
                    >
                      <PanelLeft data-icon="inline-start" />
                      Organize
                    </TabsTrigger>
                  </TabsList>
                  <Button
                    aria-label={sidebarsAreHidden ? "Show sidebars" : "Hide sidebars"}
                    className="hidden sm:inline-flex"
                    onClick={() => setSidebarsHidden((current) => !current)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <PanelLeft />
                  </Button>
                  <Button
                    aria-label={preferences.showNotesListPane ? "Hide notes list pane" : "Show notes list pane"}
                    className="hidden sm:inline-flex"
                    onClick={() => updatePreferences({ showNotesListPane: !preferences.showNotesListPane })}
                    size="sm"
                    type="button"
                    variant={preferences.showNotesListPane ? "secondary" : "outline"}
                  >
                    <NotebookTabs />
                  </Button>
                  <Button
                    aria-label="Enter fullscreen focus"
                    disabled={!selectedEntry}
                    onClick={enterFullscreenFocus}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Maximize2 />
                  </Button>
                  <Button
                    aria-label="Open Personal Notes settings"
                    onClick={() => setSettingsOpen(true)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Settings2 />
                  </Button>
                  <Button className="hidden lg:inline-flex" onClick={() => setCommandOpen(true)} size="sm" type="button" variant="outline">
                    <Command data-icon="inline-start" />
                    Ctrl/Cmd+K
                  </Button>
                </div>
              </div>
            </div>

            {filtersOpen ? (
              <div className="z-20 shrink-0 border-b border-border/60 bg-background/96 px-2 pb-2 shadow-sm sm:px-3" data-testid="personal-notes-filter-dock">
                <div
                  aria-label="Saved note filters"
                  className="ml-auto grid w-full max-w-[420px] gap-2 rounded-lg border border-border bg-popover p-2 shadow-xl"
                  data-overlap-safe="true"
                  id="personal-notes-filter-menu"
                  ref={filterMenuRef}
                  role="menu"
                >
                  <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                    Source
                    <select
                      aria-label="Source filter"
                      className="appearance-select h-9 rounded-md border border-border/80 bg-background px-2.5 text-sm font-medium text-foreground"
                      onChange={(event) => {
                        setSourceFilter(event.target.value as PersonalNotesSourceFilter);
                        setFiltersOpen(false);
                      }}
                      value={sourceFilter}
                    >
                      {sourceFilterOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {savedSearchChips.map((chip, index) => (
                      <button
                        autoFocus={index === 0}
                        className="rounded-md px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        key={chip.label}
                        onClick={() => {
                          applySavedSearch(chip);
                          setFiltersOpen(false);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {newMenuOpen ? (
              <div className="z-20 shrink-0 border-b border-border/60 bg-background/96 px-2 pb-2 shadow-sm sm:px-3" data-testid="personal-notes-new-dock">
                <div
                  aria-label="New Personal Notes item"
                  className="ml-auto grid w-full max-w-[280px] gap-1 rounded-lg border border-border bg-popover p-2 shadow-xl"
                  id="personal-notes-new-menu"
                  ref={newMenuRef}
                  role="menu"
                >
                  {[
                    { label: "New note", icon: <FilePlus2 />, action: createLooseNote },
                    { label: "New binder", icon: <BookMarked />, action: createBinder },
                    { label: "New document", icon: <FileText />, action: createDocument },
                    { label: "New folder", icon: <FolderPlus />, action: createFolder },
                    { label: "New canvas notebook", icon: <LayoutGrid />, action: createCanvasNotebook },
                  ].map((item, index) => (
                    <button
                      autoFocus={index === 0}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4"
                      disabled={!personalStorageReady}
                      key={item.label}
                      onClick={() => {
                        item.action();
                        setNewMenuOpen(false);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-1.5 py-1.5 sm:px-2 lg:px-3">
          {error ? (
            <PersonalNotesLoadDiagnostics
              error={error}
              onRetry={() => void refetchPersonalNotes()}
            />
          ) : null}

          {isLoading ? (
            <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[260px_340px_minmax(0,1fr)]">
              <Skeleton className="h-full min-h-[520px]" />
              <Skeleton className="h-full min-h-[520px]" />
              <Skeleton className="h-full min-h-[520px]" />
            </div>
          ) : !error ? (
            <>
              {data?.loadIssues?.length ? (
                <div className="shrink-0 overflow-auto">
                  <PersonalNotesSchemaIssues issues={data.loadIssues} />
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-hidden">
                {entries.length === 0 ? (
                  <PersonalNotesEmptyState
                    onCreateBinder={createBinder}
                    onCreateFolder={createFolder}
                    onCreateNote={createLooseNote}
                    personalStorageReady={personalStorageReady}
                  />
                ) : preferences.defaultView === "home" ? (
                  <PersonalNotesHomeView
                    entries={notebookTreeEntries}
                    hierarchy={notebookHierarchy}
                    onCreateBinder={createBinder}
                    onCreateDocument={createDocument}
                    onCreateNote={createLooseNote}
                    onSelectEntry={selectEntry}
                    selectedEntry={selectedEntry}
                    showQuickAccess={preferences.showQuickAccess}
                  />
                ) : preferences.defaultView === "notes" ? (
                  <MinimalNotesView
                    allEntries={notebookTreeEntries}
                    categories={notebookCategories}
                    entries={notesViewEntries}
                    editor={editorPanel}
                    focusMode={focusActive}
                    hierarchy={notebookHierarchy}
                    notebookSidebarLevel={notebookSidebarLevel}
                    navigationMode={preferences.sidebarNavigationMode}
                    notesListTitle={notesListTitle}
                    onClearFilters={showAllNotes}
                    onSelectBinder={selectNotebookBinder}
                    onSelectCategory={selectNotebookCategory}
                    onSelectEntry={selectEntry}
                    onStepBack={stepBackNotebookSidebar}
                    onTagFilter={setTagFilter}
                    selectedBinder={selectedNotebookBinder}
                    selectedCategoryId={selectedCategoryId}
                    selectedScope={selectedNotebookScope}
                    selectedEntry={selectedEntry}
                    showNotebookPane={!sidebarsAreHidden && preferences.showNotebookPane}
                    showNotesListPane={!sidebarsAreHidden && preferences.showNotesListPane}
                    tagFilter={tagFilter}
                    tagSummaries={tagSummaries}
                  />
                ) : (
                  <NormalNotesView
                    hierarchy={notebookHierarchy}
                    editor={editorPanel}
                    entries={filteredEntries}
                    folderSummaries={folderSummaries}
                    onCreateBinder={createBinder}
                    onCreateDocument={createDocument}
                    onCreateFolder={createFolder}
                    onCreateNote={createLooseNote}
                    onSelectEntry={selectEntry}
                    selectedEntry={selectedEntry}
                    sidebarsHidden={sidebarsAreHidden}
                    tagSummaries={tagSummaries}
                    onUpdatePreferences={updatePreferences}
                    preferences={preferences}
                  />
                )}
              </div>
            </>
          ) : null}
        </div>
      </section>

      {createDialog ? (
        <PersonalNotesCreateDialog
          binders={data?.personalBinders ?? []}
          currentFolderId={folderFilter}
          draftTagsInput={draftTagsInput}
          folders={data?.personalFolders ?? []}
          kind={createDialog}
          mutations={mutations}
          onAddTag={submitTagForSelected}
          onClose={() => setCreateDialog(null)}
          onMoveFolder={submitMoveSelectedToFolder}
          onNavigate={navigate}
          onSetSourceFilter={setSourceFilter}
          onSetView={setView}
          onSwitchKind={setCreateDialog}
          onUpdatePreferences={updatePreferences}
          selectedEntry={selectedEntry}
        />
      ) : null}

      {commandOpen ? (
        <CommandPalette
          entries={entries}
          onAddTag={addTagToSelected}
          onClose={() => setCommandOpen(false)}
          onCreateBinder={createBinder}
          onCreateDocument={createDocument}
          onCreateCanvasNotebook={createCanvasNotebook}
          onCreateFolder={createFolder}
          onCreateNote={createLooseNote}
          onCopyLink={() => {
            if (selectedEntry && typeof navigator !== "undefined" && navigator.clipboard) {
              void navigator.clipboard.writeText(`${window.location.origin}${selectedEntry.quickOpenUrl}`);
            }
          }}
          onEditorWidthChange={(editorWidth) => updatePreferences({ editorWidth })}
          onEnterFullscreenFocus={enterFullscreenFocus}
          onFocusEditor={() => {
            setFocusMode(true);
            updatePreferences({ focusMode: true });
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onMoveToFolder={moveSelectedToFolder}
          onNotebookBack={stepBackNotebookSidebar}
          onOpenReviewQueue={() => updatePreferences({ showReviewQueue: true })}
          onOpenCategory={selectNotebookCategory}
          onShowAllNotes={showAllNotes}
          onToggleNotebookPane={() => updatePreferences({ showNotebookPane: !preferences.showNotebookPane })}
          onToggleNotesListPane={() => updatePreferences({ showNotesListPane: !preferences.showNotesListPane })}
          onToggleReviewSidebar={() => updatePreferences({ showReviewQueue: !preferences.showReviewQueue })}
          onUpdatePreferences={updatePreferences}
          categories={notebookCategories}
          onOpenRecent={() => {
            const entry = entries[0];
            if (entry) {
              selectEntry(entry);
            }
          }}
          onOpenSource={() => {
            if (selectedEntry?.quickJumpToBinderUrl) {
              navigate(selectedEntry.quickJumpToBinderUrl);
            }
          }}
          onOpenTemplates={() => setCreateDialog("note")}
          onPin={toggleSelectedPin}
          onSwitchView={setView}
          onToggleBinderNotes={() => updatePreferences({ showBinderNotes: !preferences.showBinderNotes })}
          onToggleFocusMode={() => {
            const next = !focusActive;
            setFocusMode(next);
            updatePreferences({ focusMode: next });
          }}
          onToggleSidebars={() => setSidebarsHidden((current) => !current)}
          onToggleStyle={() => updatePreferences({ style: preferences.style === "minimal" ? "studio" : "minimal" })}
          onToggleTopChrome={() => setTopChromeHidden((current) => !current)}
          focusMode={focusActive}
          personalStorageReady={personalStorageReady}
          selectedEntry={selectedEntry}
          sidebarsHidden={sidebarsAreHidden}
          topChromeHidden={topChromeIsHidden}
        />
      ) : null}

      {settingsOpen ? (
        <PersonalNotesSettingsDrawer
          focusMode={focusActive}
          onClose={() => setSettingsOpen(false)}
          onEnterFullscreenFocus={enterFullscreenFocus}
          onToggleFocusMode={(enabled) => {
            setFocusMode(enabled);
            updatePreferences({ focusMode: enabled });
          }}
          onToggleSidebars={setSidebarsHidden}
          onToggleTopChrome={setTopChromeHidden}
          onUpdate={updatePreferences}
          preferences={preferences}
          sidebarsHidden={sidebarsAreHidden}
          topChromeHidden={topChromeIsHidden}
        />
      ) : null}
    </main>
  );
}

function PersonalNotesLoadDiagnostics({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const details = getLoadErrorDetails(error);

  return (
    <section className="rounded-lg border border-destructive/30 bg-destructive/8 p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="destructive">Needs attention</Badge>
            {details.code ? <Badge variant="outline">{details.code}</Badge> : null}
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">Personal Notes could not load</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {details.reason}
          </p>
          {details.technicalReason ? (
            <p className="mt-3 rounded-md border border-border/70 bg-background/80 px-3 py-2 font-mono text-xs text-muted-foreground">
              {details.technicalReason}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Signed-in account required</Badge>
            <Badge variant="outline">Schema and RLS checked</Badge>
            <Badge variant="outline">No demo fallback</Badge>
          </div>
        </div>
        <Button onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </div>
    </section>
  );
}

function PersonalNotesSchemaIssues({ issues }: { issues: PersonalNotesLoadIssue[] }) {
  return (
    <section className="rounded-lg border border-amber-500/35 bg-amber-500/8 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Workspace diagnostic</Badge>
            <Badge variant="secondary">{issues.length} schema signal{issues.length === 1 ? "" : "s"}</Badge>
          </div>
          <h2 className="mt-3 text-lg font-semibold">Supabase workspace needs the Personal Notes tables</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Binder-linked private notes can still load from existing learner notes. New personal folders, binders,
            documents, and loose notes need the Personal Notes tables in this Supabase workspace.
          </p>
          <p className="mt-3 rounded-md border border-border/70 bg-background/78 px-3 py-2 font-mono text-xs text-muted-foreground">
            Apply supabase/migrations/0016_personal_notes_workspace.sql to this Supabase workspace, then retry.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {issues.map((issue) => (
          <div className="rounded-md border border-border/70 bg-background/78 p-3" key={`${issue.table}:${issue.code}`}>
            <p className="text-sm font-semibold">{issue.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{issue.message}</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{issue.technicalReason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PersonalNotesEmptyState({
  onCreateBinder,
  onCreateFolder,
  onCreateNote,
  personalStorageReady,
}: {
  onCreateBinder: () => void;
  onCreateFolder: () => void;
  onCreateNote: () => void;
  personalStorageReady: boolean;
}) {
  return (
    <section className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-border/80 bg-card/72 p-6 text-center shadow-sm backdrop-blur">
      <div className="max-w-2xl">
        <div className="mx-auto grid size-12 place-items-center rounded-lg bg-primary/12 text-primary">
          <NotebookTabs className="size-6" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Start your notebook</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Create a loose note, start a personal binder, or add a folder. Binder private notes appear here as soon as
          you write them in a study workspace.
        </p>
        {!personalStorageReady ? (
          <p className="mx-auto mt-4 max-w-xl rounded-md border border-amber-500/35 bg-amber-500/8 px-3 py-2 text-sm text-muted-foreground">
            Personal note creation unlocks after the Personal Notes schema migration is applied to this Supabase workspace.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button disabled={!personalStorageReady} onClick={onCreateNote} type="button">
            <FilePlus2 data-icon="inline-start" />
            New note
          </Button>
          <Button disabled={!personalStorageReady} onClick={onCreateBinder} type="button" variant="outline">
            <BookMarked data-icon="inline-start" />
            Create binder
          </Button>
          <Button disabled={!personalStorageReady} onClick={onCreateFolder} type="button" variant="outline">
            <FolderPlus data-icon="inline-start" />
            Create folder
          </Button>
          <Button disabled type="button" variant="ghost">
            Import later
          </Button>
        </div>
      </div>
    </section>
  );
}

function PersonalNotesCreateDialog({
  binders,
  currentFolderId,
  draftTagsInput,
  folders,
  kind,
  mutations,
  onAddTag,
  onClose,
  onMoveFolder,
  onNavigate,
  onSetSourceFilter,
  onSetView,
  onSwitchKind,
  onUpdatePreferences,
  selectedEntry,
}: {
  binders: Array<{ id: string; title: string; folder_id: string | null }>;
  currentFolderId: string | null;
  draftTagsInput: string;
  folders: PersonalNoteFolder[];
  kind: CreateDialogKind;
  mutations: PersonalNotesMutations;
  onAddTag: (tag: string) => void;
  onClose: () => void;
  onMoveFolder: (folderId: string | null) => Promise<void>;
  onNavigate: (path: string) => void;
  onSetSourceFilter: (filter: PersonalNotesSourceFilter) => void;
  onSetView: (view: PersonalNotesViewMode) => void;
  onSwitchKind: (kind: CreateDialogKind) => void;
  onUpdatePreferences: (value: Partial<PersonalNotesPreferences>) => void;
  selectedEntry: PersonalNotesEntry | null;
}) {
  const [title, setTitle] = useState(defaultTitleForDialog(kind));
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState(currentFolderId ?? "");
  const [binderId, setBinderId] = useState(selectedEntry?.personalBinderId ?? "");
  const [templateId, setTemplateId] = useState("blank");
  const [canvasLayout, setCanvasLayout] = useState("blank");
  const [createFirstDocument, setCreateFirstDocument] = useState(false);
  const [color, setColor] = useState("teal");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const template = personalNoteTemplates.find((candidate) => candidate.id === templateId) ?? personalNoteTemplates[0];
  const dialogTitle = titleForDialog(kind);
  const canSubmitDocument = kind !== "document" || Boolean(binderId);

  useEffect(() => {
    if (kind === "document" && !binderId && binders[0]?.id) {
      setBinderId(binders[0].id);
    }
  }, [binderId, binders, kind]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    try {
      setIsSubmitting(true);
      if (kind === "note") {
        const selectedBinder = binders.find((binder) => binder.id === binderId) ?? null;
        const note = await mutations.savePersonalNote.mutateAsync({
          title: title.trim() || "Untitled note",
          folderId: folderId || selectedBinder?.folder_id || null,
          binderId: binderId || null,
          content: template.content,
          tags: template.tags ?? [],
        });
        onSetSourceFilter("all");
        onUpdatePreferences({ defaultNewNoteLocation: binderId ? "last-binder" : "loose" });
        onNavigate(`/notes/n/${note.id}`);
      } else if (kind === "binder") {
        const result = await mutations.createBinder.mutateAsync({
          title: title.trim() || "Untitled binder",
          folderId: folderId || null,
          description: description.trim() || null,
          createFirstDocument,
        });
        if (result.document) {
          onNavigate(`/notes/binders/${result.binder.id}/documents/${result.document.id}`);
        } else {
          onNavigate(`/notes/binders/${result.binder.id}`);
        }
      } else if (kind === "document") {
        if (!binderId) {
          setLocalError("Create a binder before adding a document.");
          return;
        }
        const document = await mutations.createDocument.mutateAsync({
          binderId,
          title: title.trim() || "Untitled document",
          content: template.content,
          tags: template.tags ?? [],
        });
        onNavigate(`/notes/binders/${binderId}/documents/${document.id}`);
      } else if (kind === "folder") {
        await mutations.createFolder.mutateAsync({
          name: title.trim() || "New folder",
          color,
        });
      } else if (kind === "canvas") {
        const result = await mutations.createBinder.mutateAsync({
          title: title.trim() || "Canvas notebook",
          folderId: folderId || null,
          description: description.trim() || canvasDescription(canvasLayout),
          createFirstDocument: false,
        });
        onSetView("home");
        onNavigate(`/notes/binders/${result.binder.id}`);
      } else if (kind === "tag") {
        const tag = title.trim();
        if (!tag) {
          setLocalError("Tag name is required.");
          return;
        }
        onAddTag(tag);
      } else if (kind === "move-folder") {
        await onMoveFolder(folderId || null);
      }
      onClose();
    } catch (errorValue) {
      setLocalError(errorValue instanceof Error ? errorValue.message : "Personal Notes could not save this change.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/68 p-4 backdrop-blur" role="presentation">
      <form
        aria-label={dialogTitle}
        className="w-full max-w-xl rounded-lg border border-border bg-popover p-4 shadow-2xl"
        onSubmit={(event) => void submit(event)}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-3">
          <div>
            <Badge variant="outline">Personal Notes</Badge>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">{dialogTitle}</h2>
          </div>
          <Button aria-label="Close dialog" onClick={onClose} size="icon" type="button" variant="ghost">
            <X />
          </Button>
        </div>

        <div className="mt-4 grid gap-4">
          {kind === "document" && binders.length === 0 ? (
            <div className="rounded-lg border border-amber-500/35 bg-amber-500/8 p-3 text-sm">
              Create a binder first, then add documents to it.
              <Button className="mt-3" onClick={() => onSwitchKind("binder")} type="button" variant="outline">
                Create binder first
              </Button>
            </div>
          ) : null}

          {kind !== "move-folder" ? (
            <label className="grid gap-2 text-sm font-medium">
              {labelForTitle(kind)}
              <Input
                autoFocus
                aria-label={labelForTitle(kind)}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={placeholderForDialog(kind)}
                value={title}
              />
            </label>
          ) : null}

          {kind === "binder" || kind === "canvas" ? (
            <label className="grid gap-2 text-sm font-medium">
              Description
              <Input
                aria-label="Description"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional context"
                value={description}
              />
            </label>
          ) : null}

          {kind === "note" || kind === "binder" || kind === "folder" || kind === "canvas" || kind === "move-folder" ? (
            <label className="grid gap-2 text-sm font-medium">
              {kind === "move-folder" ? "Move to folder" : "Folder"}
              <select
                aria-label={kind === "move-folder" ? "Move to folder" : "Folder"}
                className="appearance-select h-10 rounded-md border border-border bg-background px-3 text-sm"
                onChange={(event) => setFolderId(event.target.value)}
                value={folderId}
              >
                <option value="">Unfiled</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {kind === "note" ? (
            <label className="grid gap-2 text-sm font-medium">
              Binder
              <select
                aria-label="Binder"
                className="appearance-select h-10 rounded-md border border-border bg-background px-3 text-sm"
                onChange={(event) => setBinderId(event.target.value)}
                value={binderId}
              >
                <option value="">Loose note / No binder</option>
                {binders.map((binder) => (
                  <option key={binder.id} value={binder.id}>
                    {binder.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {kind === "document" ? (
            <label className="grid gap-2 text-sm font-medium">
              Binder
              <select
                aria-label="Binder"
                className="appearance-select h-10 rounded-md border border-border bg-background px-3 text-sm"
                onChange={(event) => setBinderId(event.target.value)}
                value={binderId}
              >
                {binders.map((binder) => (
                  <option key={binder.id} value={binder.id}>
                    {binder.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {kind === "note" || kind === "document" ? (
            <label className="grid gap-2 text-sm font-medium">
              Template
              <select
                aria-label="Template"
                className="appearance-select h-10 rounded-md border border-border bg-background px-3 text-sm"
                onChange={(event) => setTemplateId(event.target.value)}
                value={templateId}
              >
                {personalNoteTemplates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {kind === "canvas" ? (
            <label className="grid gap-2 text-sm font-medium">
              Starting layout
              <select
                aria-label="Starting layout"
                className="appearance-select h-10 rounded-md border border-border bg-background px-3 text-sm"
                onChange={(event) => setCanvasLayout(event.target.value)}
                value={canvasLayout}
              >
                <option value="blank">Blank canvas</option>
                <option value="study">Study board</option>
                <option value="math">Math board</option>
                <option value="history">History evidence board</option>
                <option value="planning">Planning board</option>
              </select>
            </label>
          ) : null}

          {kind === "folder" ? (
            <label className="grid gap-2 text-sm font-medium">
              Color
              <select
                aria-label="Folder color"
                className="appearance-select h-10 rounded-md border border-border bg-background px-3 text-sm"
                onChange={(event) => setColor(event.target.value)}
                value={color}
              >
                <option value="teal">Teal</option>
                <option value="blue">Blue</option>
                <option value="emerald">Emerald</option>
                <option value="rose">Rose</option>
                <option value="violet">Violet</option>
                <option value="slate">Slate</option>
              </select>
            </label>
          ) : null}

          {kind === "binder" ? (
            <label className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background px-3 py-2 text-sm font-medium">
              Create first document
              <input
                checked={createFirstDocument}
                className="size-4 accent-primary"
                onChange={(event) => setCreateFirstDocument(event.target.checked)}
                type="checkbox"
              />
            </label>
          ) : null}

          {kind === "tag" && draftTagsInput.trim() ? (
            <p className="text-sm text-muted-foreground">Current tags: {draftTagsInput}</p>
          ) : null}

          {localError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {localError}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isSubmitting || !canSubmitDocument} type="submit">
            {isSubmitting ? "Saving..." : primaryActionForDialog(kind)}
          </Button>
        </div>
      </form>
    </div>
  );
}

function getLoadErrorDetails(error: unknown) {
  const value = error as { code?: string; details?: string; hint?: string; message?: string };
  const technicalReason = [value?.code ? `${value.code}:` : "", value?.message, value?.details, value?.hint]
    .filter(Boolean)
    .join(" ");
  const normalized = technicalReason.toLowerCase();
  const reason =
    normalized.includes("does not exist") || normalized.includes("could not find the table") || value?.code === "42P01"
      ? "A Personal Notes storage table is not available in Supabase."
      : normalized.includes("row-level security") || value?.code === "42501"
        ? "Supabase RLS blocked the signed-in account from reading Personal Notes."
        : "BinderNotes could not read the signed-in account workspace.";

  return {
    code: value?.code,
    reason,
    technicalReason: technicalReason || (error instanceof Error ? error.message : ""),
  };
}

function titleForDialog(kind: CreateDialogKind) {
  switch (kind) {
    case "note":
      return "New note";
    case "binder":
      return "New binder";
    case "document":
      return "New document";
    case "folder":
      return "New folder";
    case "canvas":
      return "New canvas notebook";
    case "tag":
      return "Add tag";
    case "move-folder":
      return "Move to folder";
  }
}

function labelForTitle(kind: CreateDialogKind) {
  switch (kind) {
    case "binder":
      return "Binder title";
    case "document":
      return "Document title";
    case "folder":
      return "Folder name";
    case "canvas":
      return "Canvas notebook title";
    case "tag":
      return "Tag name";
    case "note":
    case "move-folder":
      return "Note title";
  }
}

function defaultTitleForDialog(kind: CreateDialogKind) {
  switch (kind) {
    case "binder":
      return "New binder";
    case "document":
      return "New document";
    case "folder":
      return "New folder";
    case "canvas":
      return "Canvas notebook";
    case "tag":
      return "";
    case "note":
    case "move-folder":
      return "Untitled note";
  }
}

function placeholderForDialog(kind: CreateDialogKind) {
  switch (kind) {
    case "binder":
      return "Personal binder";
    case "document":
      return "Class reading notes";
    case "folder":
      return "Math";
    case "canvas":
      return "Spring study board";
    case "tag":
      return "review-later";
    case "note":
    case "move-folder":
      return "Untitled note";
  }
}

function primaryActionForDialog(kind: CreateDialogKind) {
  switch (kind) {
    case "move-folder":
      return "Move";
    case "tag":
      return "Add tag";
    case "folder":
      return "Create folder";
    case "binder":
      return "Create binder";
    case "document":
      return "Create document";
    case "canvas":
      return "Create canvas";
    case "note":
      return "Create note";
  }
}

function canvasDescription(layout: string) {
  switch (layout) {
    case "study":
      return "Personal canvas notebook / study board";
    case "math":
      return "Personal canvas notebook / math board";
    case "history":
      return "Personal canvas notebook / history evidence board";
    case "planning":
      return "Personal canvas notebook / planning board";
    case "blank":
    default:
      return "Personal canvas notebook / blank canvas";
  }
}

function NormalNotesView({
  editor,
  entries,
  folderSummaries,
  hierarchy,
  onCreateBinder,
  onCreateDocument,
  onCreateFolder,
  onCreateNote,
  onSelectEntry,
  onUpdatePreferences,
  preferences,
  selectedEntry,
  sidebarsHidden,
  tagSummaries,
}: {
  editor: ReactNode;
  entries: PersonalNotesEntry[];
  folderSummaries: Array<{ name: string; count: number; color: string }>;
  hierarchy: NotebookHierarchy;
  onCreateBinder: () => void;
  onCreateDocument: () => void;
  onCreateFolder: () => void;
  onCreateNote: () => void;
  onSelectEntry: (entry: PersonalNotesEntry) => void;
  onUpdatePreferences: (value: Partial<PersonalNotesPreferences>) => void;
  preferences: PersonalNotesPreferences;
  selectedEntry: PersonalNotesEntry | null;
  sidebarsHidden: boolean;
  tagSummaries: Array<{ name: string; count: number }>;
}) {
  const cards = useMemo(
    () => buildOrganizeCards({
      entries,
      folderSummaries,
      hierarchy,
      showQuickAccess: preferences.showQuickAccess,
      tagSummaries,
    }),
    [entries, folderSummaries, hierarchy, preferences.showQuickAccess, tagSummaries],
  );
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const availableCardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const availableCardKey = availableCardIds.join("|");
  const preferenceCardOrderKey = preferences.organizeCardOrder.join("|");
  const [cardOrder, setCardOrder] = useState(() =>
    mergeOrganizeCardOrder(availableCardIds, preferences.organizeCardOrder),
  );
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [toast, setToast] = useState<OrganizeToast | null>(null);
  const draggingCardIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setCardOrder(mergeOrganizeCardOrder(availableCardIds, preferences.organizeCardOrder));
  }, [availableCardKey, preferenceCardOrderKey]);

  useEffect(() => {
    if (!draggingCardId) {
      return;
    }

    const clearDrag = () => {
      draggingCardIdRef.current = null;
      setDraggingCardId(null);
    };

    window.addEventListener("pointerup", clearDrag);
    window.addEventListener("pointercancel", clearDrag);
    return () => {
      window.removeEventListener("pointerup", clearDrag);
      window.removeEventListener("pointercancel", clearDrag);
    };
  }, [draggingCardId]);

  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    },
    [],
  );

  const orderedCards = cardOrder
    .map((cardId) => cardMap.get(cardId))
    .filter((card): card is OrganizeCard => Boolean(card));

  const moveCard = useCallback((activeId: string, overId: string) => {
    if (activeId === overId) {
      return;
    }
    setCardOrder((current) => moveCardInOrder(current, activeId, overId));
  }, []);

  const moveCardByOffset = useCallback((cardId: string, offset: -1 | 1) => {
    setCardOrder((current) => {
      const index = current.indexOf(cardId);
      const targetIndex = index + offset;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [card] = next.splice(index, 1);
      next.splice(targetIndex, 0, card);
      return next;
    });
  }, []);

  const startDrag = useCallback((event: ReactPointerEvent<HTMLElement>, cardId: string) => {
    if (isOrganizeCardDragBlocked(event.target)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    draggingCardIdRef.current = cardId;
    setDraggingCardId(cardId);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const showToast = useCallback((nextToast: OrganizeToast) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(nextToast);
    if (nextToast.type === "success") {
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 3000);
    }
  }, []);

  const saveOrder = useCallback(() => {
    try {
      onUpdatePreferences({ organizeCardOrder: cardOrder });
      showToast({ message: "Order saved", type: "success" });
    } catch {
      showToast({ message: "Order could not be saved. Try again.", type: "error" });
    }
  }, [cardOrder, onUpdatePreferences, showToast]);

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
      data-testid="personal-notes-organize-view"
    >
      <div className="flex shrink-0 flex-col gap-3 border-b border-border/60 px-3 py-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">Organize Personal Notes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag from a corner handle, use move controls on touch screens, then save the order.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toast ? (
            <div
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                toast.type === "error"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-primary/35 bg-primary/10 text-foreground"
              }`}
              role="status"
            >
              {toast.message}
            </div>
          ) : null}
          <Button onClick={saveOrder} size="sm" type="button">
            <Save data-icon="inline-start" />
            Save order
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        {!sidebarsHidden ? (
          <section className="min-h-0 overflow-auto border-r border-border/55 p-3">
            <div
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
              data-testid="personal-notes-organize-card-list"
            >
              {orderedCards.map((card, index) => (
                <OrganizeCardView
                  card={card}
                  isDragging={draggingCardId === card.id}
                  isFirst={index === 0}
                  isLast={index === orderedCards.length - 1}
                  key={card.id}
                  onMoveDown={() => moveCardByOffset(card.id, 1)}
                  onMoveUp={() => moveCardByOffset(card.id, -1)}
                  onPointerEnter={() => {
                    const activeId = draggingCardIdRef.current;
                    if (activeId) {
                      moveCard(activeId, card.id);
                    }
                  }}
                  onSelect={() => {
                    const entry = entries.find((candidate) => candidate.folderName === card.title.replace(/ folder$/, ""));
                    if (entry) {
                      onSelectEntry(entry);
                    }
                  }}
                  onStartDrag={(event) => startDrag(event, card.id)}
                >
                  {card.id === "quick-access" ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button onClick={onCreateNote} size="sm" type="button">
                        <FilePlus2 data-icon="inline-start" />
                        Note
                      </Button>
                      <Button onClick={onCreateBinder} size="sm" type="button" variant="outline">
                        <BookMarked data-icon="inline-start" />
                        Binder
                      </Button>
                      <Button onClick={onCreateDocument} size="sm" type="button" variant="outline">
                        <FileText data-icon="inline-start" />
                        Document
                      </Button>
                      <Button onClick={onCreateFolder} size="sm" type="button" variant="outline">
                        <FolderPlus data-icon="inline-start" />
                        Folder
                      </Button>
                    </div>
                  ) : null}
                </OrganizeCardView>
              ))}
            </div>
            {orderedCards.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
                Nothing to organize yet. Create a note or binder to start.
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="min-h-0 overflow-hidden bg-background">
          {sidebarsHidden ? (
            editor
          ) : (
            <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]">
              <div className="min-h-0 overflow-hidden">{editor}</div>
              <div className="hidden border-t border-border/55 p-3 xl:block">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current notes</h3>
                  <Badge variant="outline">{entries.length}</Badge>
                </div>
                <div className="mt-2 max-h-40 overflow-auto">
                  <NoteList compact entries={entries.slice(0, 8)} onSelectEntry={onSelectEntry} selectedEntry={selectedEntry} />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function OrganizeCardView({
  card,
  children,
  isDragging,
  isFirst,
  isLast,
  onMoveDown,
  onMoveUp,
  onPointerEnter,
  onSelect,
  onStartDrag,
}: {
  card: OrganizeCard;
  children?: ReactNode;
  isDragging: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onPointerEnter: () => void;
  onSelect: () => void;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const canOpen = card.kind === "folder" || card.kind === "binder" || card.kind === "document";

  return (
    <section
      className={`relative min-w-0 cursor-grab select-none rounded-xl border bg-card p-3 pr-12 shadow-sm transition-transform duration-150 active:cursor-grabbing ${
        isDragging
          ? "border-primary/60 bg-primary/10 shadow-lg ring-2 ring-primary/20"
          : "border-border/75 hover:border-primary/35"
      }`}
      data-dragging={isDragging ? "true" : "false"}
      data-organize-card-id={card.id}
      data-testid={`organize-card-${card.id}`}
      onPointerEnter={onPointerEnter}
      onPointerDown={onStartDrag}
    >
      <button
        aria-grabbed={isDragging}
        aria-label={`Drag ${card.title} to reorder`}
        className="admin-mini-drag-handle absolute right-3 top-3 touch-none"
        data-card-drag-handle="true"
        onPointerDown={onStartDrag}
        type="button"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: card.tone }} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{card.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{card.subtitle}</p>
          <Badge className="mt-2" variant="outline">
            {card.count} {card.count === 1 ? "item" : "items"}
          </Badge>
        </div>
      </div>

      {children}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <Button
            aria-label={`Move ${card.title} up`}
            disabled={isFirst}
            onClick={onMoveUp}
            size="sm"
            type="button"
            variant="outline"
          >
            <ArrowUp />
          </Button>
          <Button
            aria-label={`Move ${card.title} down`}
            disabled={isLast}
            onClick={onMoveDown}
            size="sm"
            type="button"
            variant="outline"
          >
            <ArrowDown />
          </Button>
        </div>
        {canOpen ? (
          <Button onClick={onSelect} size="sm" type="button" variant="ghost">
            Open
            <ChevronRight data-icon="inline-end" />
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function isOrganizeCardDragBlocked(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest("[data-card-drag-handle='true']")) {
    return false;
  }
  return Boolean(
    target.closest(
      "button,a,input,textarea,select,label,[role='button'],[role='menuitem'],[contenteditable='true'],[data-no-card-drag='true']",
    ),
  );
}

function buildOrganizeCards({
  entries,
  folderSummaries,
  hierarchy,
  showQuickAccess,
  tagSummaries,
}: {
  entries: PersonalNotesEntry[];
  folderSummaries: Array<{ name: string; count: number; color: string }>;
  hierarchy: NotebookHierarchy;
  showQuickAccess: boolean;
  tagSummaries: Array<{ name: string; count: number }>;
}): OrganizeCard[] {
  const cards: OrganizeCard[] = [];
  if (showQuickAccess) {
    cards.push({
      id: "quick-access",
      title: "Quick Access",
      subtitle: "Fast creation for notes, binders, documents, and folders.",
      count: 4,
      kind: "quick-access",
      tone: "#3b82f6",
    });
  }

  for (const folder of folderSummaries) {
    cards.push({
      id: `folder:${folder.name}`,
      title: `${folder.name} folder`,
      subtitle: "Folder scope for personal and binder-linked notes.",
      count: folder.count,
      kind: "folder",
      tone: folder.color,
    });
  }

  const binderByGroup = new Map<string, NotebookBinderNode>();
  for (const binder of hierarchy.bindersById.values()) {
    const existing = binderByGroup.get(binder.groupId);
    if (!existing || existing.scopeId === "all" || existing.scopeId === "binder-linked") {
      binderByGroup.set(binder.groupId, binder);
    }
  }

  const binders = Array.from(binderByGroup.values());
  for (const binder of binders) {
    cards.push({
      id: `binder:${binder.groupId}`,
      title: `${binder.title} binder`,
      subtitle: `${binder.scopeLabel} / ${binder.kind === "source-binder" ? "source binder" : "personal binder"}`,
      count: binder.count,
      kind: "binder",
      tone: binder.kind === "source-binder" ? "#60a5fa" : "#22c55e",
    });
  }

  for (const entry of entries) {
    if (entry.kind !== "personal-document") {
      continue;
    }
    cards.push({
      id: `document:${entry.id}`,
      title: `${entry.title} document`,
      subtitle: entry.personalBinderTitle ?? "Personal document",
      count: 1,
      kind: "document",
      tone: "#a78bfa",
    });
  }

  if (entries.some((entry) => entry.kind === "personal-note" && !entry.personalBinderId)) {
    cards.push({
      id: "loose-notes",
      title: "Loose notes",
      subtitle: "Standalone notes waiting for a folder or binder.",
      count: entries.filter((entry) => entry.kind === "personal-note" && !entry.personalBinderId).length,
      kind: "loose",
      tone: "#f59e0b",
    });
  }

  if (tagSummaries.length > 0) {
    cards.push({
      id: "tags",
      title: "Tags",
      subtitle: tagSummaries.slice(0, 4).map((tag) => tag.name).join(", "),
      count: tagSummaries.length,
      kind: "linked",
      tone: "#14b8a6",
    });
  }

  return cards;
}

function mergeOrganizeCardOrder(availableCardIds: string[], savedOrder: string[]) {
  const available = new Set(availableCardIds);
  return [
    ...savedOrder.filter((cardId) => available.has(cardId)),
    ...availableCardIds.filter((cardId) => !savedOrder.includes(cardId)),
  ];
}

function moveCardInOrder(order: string[], activeId: string, overId: string) {
  const from = order.indexOf(activeId);
  const to = order.indexOf(overId);
  if (from < 0 || to < 0 || from === to) {
    return order;
  }
  const next = [...order];
  const [card] = next.splice(from, 1);
  next.splice(to, 0, card);
  return next;
}

function PersonalNotesHomeView({
  entries,
  hierarchy,
  onCreateBinder,
  onCreateDocument,
  onCreateNote,
  onSelectEntry,
  selectedEntry,
  showQuickAccess,
}: {
  entries: PersonalNotesEntry[];
  hierarchy: NotebookHierarchy;
  onCreateBinder: () => void;
  onCreateDocument: () => void;
  onCreateNote: () => void;
  onSelectEntry: (entry: PersonalNotesEntry) => void;
  selectedEntry: PersonalNotesEntry | null;
  showQuickAccess: boolean;
}) {
  const notebookScopes = ["math", "history", "chemistry", "other", "unfiled"]
    .map((scopeId) => ({
      scopeId,
      label: notebookScopeLabel(scopeId),
      binders: hierarchy.bindersByScope[scopeId] ?? [],
    }))
    .filter((scope) => scope.binders.length > 0);
  const binderLinkedBinders = hierarchy.bindersByScope["binder-linked"] ?? [];
  const looseEntries = entries.filter((entry) => entry.kind === "personal-note" && !entry.personalBinderId);

  return (
    <div className="h-full min-h-0 overflow-auto p-3">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Personal Notes home</h2>
            <p className="mt-1 text-sm text-muted-foreground">Review what matters, then jump back into writing.</p>
          </div>
          {showQuickAccess ? (
            <div className="flex flex-wrap gap-2" data-testid="personal-notes-home-quick-access">
              <Button onClick={onCreateNote} size="sm" type="button">
                <FilePlus2 data-icon="inline-start" />
                New note
              </Button>
              <Button onClick={onCreateBinder} size="sm" type="button" variant="outline">
                <BookMarked data-icon="inline-start" />
                Binder
              </Button>
              <Button onClick={onCreateDocument} size="sm" type="button" variant="outline">
                <FileText data-icon="inline-start" />
                Document
              </Button>
            </div>
          ) : null}
        </div>
        <div className="mt-5 grid gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent notes</h3>
          <NoteList compact entries={entries.slice(0, 6)} onSelectEntry={onSelectEntry} selectedEntry={selectedEntry} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="rounded-lg border border-border/70 bg-background/45 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Notebooks by folder</h3>
            <div className="mt-3 grid gap-3">
              {notebookScopes.length ? (
                notebookScopes.map((scope) => (
                  <div key={scope.scopeId}>
                    <p className="text-sm font-semibold">{scope.label}</p>
                    <div className="mt-2 grid gap-1">
                      {scope.binders.slice(0, 5).map((binder) => (
                        <div className="rounded-md border border-border/60 bg-card px-3 py-2" key={binder.id}>
                          <div className="truncate text-sm font-medium">{binder.title}</div>
                          <p className="text-xs text-muted-foreground">{binder.count} notes</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Create a binder or write a binder private note to build your notebook map.</p>
              )}
            </div>
          </section>
          <section className="rounded-lg border border-border/70 bg-background/45 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Binder-linked notes</h3>
            <div className="mt-3 grid gap-2">
              {binderLinkedBinders.length ? (
                binderLinkedBinders.slice(0, 6).map((binder) => (
                  <div className="rounded-md border border-border/60 bg-card px-3 py-2" key={binder.id}>
                    <div className="truncate text-sm font-medium">{binder.title}</div>
                    <p className="text-xs text-muted-foreground">{binder.scopeLabel} / {binder.count} notes</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Binder private notes will group here by source binder.</p>
              )}
            </div>
          </section>
          <section className="rounded-lg border border-border/70 bg-background/45 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Loose notes</h3>
            <div className="mt-3 grid gap-2">
              {looseEntries.length ? (
                looseEntries.slice(0, 6).map((entry) => (
                  <button
                    className="rounded-md border border-border/60 bg-card px-3 py-2 text-left hover:bg-secondary/65"
                    key={entry.id}
                    onClick={() => onSelectEntry(entry)}
                    type="button"
                  >
                    <span className="block truncate text-sm font-medium">{entry.title}</span>
                    <span className="text-xs text-muted-foreground">Loose note</span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Loose notes can stay unfiled until you are ready to organize.</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function MinimalNotesView({
  allEntries,
  categories,
  editor,
  entries,
  focusMode,
  hierarchy,
  notebookSidebarLevel,
  navigationMode,
  notesListTitle,
  onClearFilters,
  onSelectBinder,
  onSelectCategory,
  onSelectEntry,
  onStepBack,
  onTagFilter,
  selectedBinder,
  selectedCategoryId,
  selectedScope,
  selectedEntry,
  showNotebookPane,
  showNotesListPane,
  tagFilter,
  tagSummaries,
}: {
  allEntries: PersonalNotesEntry[];
  categories: NotebookCategory[];
  editor: ReactNode;
  entries: PersonalNotesEntry[];
  focusMode: boolean;
  hierarchy: NotebookHierarchy;
  notebookSidebarLevel: NotebookSidebarLevel;
  navigationMode: PersonalNotesSidebarNavigationMode;
  notesListTitle: string;
  onClearFilters: () => void;
  onSelectBinder: (binder: NotebookBinderNode) => void;
  onSelectCategory: (category: NotebookCategory) => void;
  onSelectEntry: (entry: PersonalNotesEntry) => void;
  onStepBack: () => void;
  onTagFilter: (tag: string | null) => void;
  selectedBinder: NotebookBinderNode | null;
  selectedCategoryId: string;
  selectedScope: NotebookCategory;
  selectedEntry: PersonalNotesEntry | null;
  showNotebookPane: boolean;
  showNotesListPane: boolean;
  tagFilter: string | null;
  tagSummaries: Array<{ name: string; count: number }>;
}) {
  const binderRows = hierarchy.bindersByScope[selectedScope?.id ?? "all"] ?? [];
  const shouldChooseBinder =
    notebookSidebarLevel !== "binder" && selectedScope?.id !== "loose" && selectedScope?.id !== "binder-linked";

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background md:flex-row"
      data-testid="personal-notes-notes-view"
    >
      {showNotebookPane ? (
        <aside
          aria-label="Notebook hierarchy"
          className="hidden min-h-0 w-[248px] shrink-0 overflow-auto border-r border-border/55 bg-background p-2 transition-[width,opacity] duration-200 lg:block 2xl:w-[280px]"
        >
          {navigationMode === "structured" ? (
            <StructuredNotebookTree
              allEntries={allEntries}
              categories={categories}
              hierarchy={hierarchy}
              onClearFilters={onClearFilters}
              onSelectBinder={onSelectBinder}
              onSelectCategory={onSelectCategory}
              onSelectEntry={onSelectEntry}
              onTagFilter={onTagFilter}
              selectedEntry={selectedEntry}
              tagFilter={tagFilter}
              tagSummaries={tagSummaries}
            />
          ) : (
            <>
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            {notebookSidebarLevel === "scopes" ? (
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Notebook</h2>
            ) : (
              <Button
                aria-label={notebookSidebarLevel === "binder" ? `Back to ${selectedScope.label} binders` : "Back to notebook scopes"}
                onClick={onStepBack}
                size="sm"
                type="button"
                variant="ghost"
              >
                <ChevronLeft data-icon="inline-start" />
                Back
              </Button>
            )}
            <Button onClick={onClearFilters} size="sm" type="button" variant="ghost">
              Clear
            </Button>
          </div>
          <div className="mt-2 grid gap-1">
            {notebookSidebarLevel === "scopes"
              ? categories.map((category) => (
                  <button
                    aria-label={`${category.label} ${category.count}`}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition ${
                      selectedCategoryId === category.id
                        ? "bg-primary/12 text-foreground"
                        : "text-muted-foreground hover:bg-secondary/65 hover:text-foreground"
                    }`}
                    key={category.id}
                    onClick={() => onSelectCategory(category)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ChevronRight className="size-3.5 shrink-0" />
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                      <span className="truncate">{category.label}</span>
                    </span>
                    <span className="text-xs">{category.count}</span>
                  </button>
                ))
              : null}
            {notebookSidebarLevel === "binders" ? (
              <div className="grid gap-2">
                <div className="px-1 py-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Scope</p>
                  <p className="mt-1 truncate text-base font-semibold">{selectedScope.label}</p>
                </div>
                {selectedScope.id === "loose" ? (
                  <p className="rounded-md border border-border/65 bg-card p-3 text-sm text-muted-foreground">
                    Loose notes appear in the notes pane.
                  </p>
                ) : binderRows.length ? (
                  binderRows.map((binder) => (
                    <button
                      aria-label={`${binder.title} ${binder.count}`}
                      className="min-w-0 rounded-md border border-border/65 bg-card px-3 py-2 text-left transition hover:bg-secondary/65"
                      key={binder.id}
                      onClick={() => onSelectBinder(binder)}
                      type="button"
                    >
                      <span className="block truncate text-sm font-semibold">{binder.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{binder.count} notes</span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-md border border-border/65 bg-card p-3 text-sm text-muted-foreground">
                    No binders in {selectedScope.label} yet.
                  </p>
                )}
              </div>
            ) : null}
            {notebookSidebarLevel === "binder" && selectedBinder ? (
              <div className="grid gap-3">
                <div className="px-1 py-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{selectedScope.label}</p>
                  <h3 className="mt-1 text-base font-semibold leading-tight">{selectedBinder.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedBinder.count} notes</p>
                </div>
                {selectedBinder.sourceUrl ? (
                  <Link
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/80 bg-background px-3 py-2 text-sm font-medium hover:bg-secondary/70"
                    to={selectedBinder.sourceUrl}
                  >
                    <ArrowUpRight className="size-4" />
                    Open binder workspace
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          {tagSummaries.length ? (
            <div className="mt-5">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tags</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tagSummaries.slice(0, 12).map((tag) => (
                  <button
                    className={`rounded-md border px-2 py-1 text-xs ${
                      tagFilter === tag.name
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border/70 text-muted-foreground hover:bg-secondary/70"
                    }`}
                    key={tag.name}
                    onClick={() => onTagFilter(tagFilter === tag.name ? null : tag.name)}
                    type="button"
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
            </>
          )}
        </aside>
      ) : null}

      {showNotesListPane ? (
        <aside
          className="min-h-0 w-full shrink-0 overflow-hidden border-r border-border/55 bg-background/94 p-2 transition-[width,opacity] duration-200 md:w-[312px] 2xl:w-[352px]"
          data-testid="notes-list-pane"
        >
          <div className="flex items-center justify-between gap-3 px-1 py-1">
            <h2 className="text-sm font-semibold">{notesListTitle}</h2>
            <Badge variant="outline">{entries.length}</Badge>
          </div>
          <div className="h-[calc(100%-2.25rem)] overflow-auto pr-1">
            {entries.length ? (
              <NoteList compact entries={entries} onSelectEntry={onSelectEntry} selectedEntry={selectedEntry} />
            ) : (
              <div className="rounded-lg border border-border/65 bg-card p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {shouldChooseBinder ? "Choose a binder" : `No ${selectedScope.label} notes yet.`}
                </p>
                <p className="mt-1">
                  {shouldChooseBinder
                    ? "Select a binder from the notebook sidebar to see its notes here."
                    : "This scope is empty or hidden by the current search and filters."}
                </p>
              </div>
            )}
          </div>
        </aside>
      ) : null}

      <section
        className="min-w-0 flex-1 bg-background"
        data-testid="personal-notes-editor-stage"
      >
        {editor}
      </section>
    </div>
  );
}

function StructuredNotebookTree({
  allEntries,
  categories,
  hierarchy,
  onClearFilters,
  onSelectBinder,
  onSelectCategory,
  onSelectEntry,
  onTagFilter,
  selectedEntry,
  tagFilter,
  tagSummaries,
}: {
  allEntries: PersonalNotesEntry[];
  categories: NotebookCategory[];
  hierarchy: NotebookHierarchy;
  onClearFilters: () => void;
  onSelectBinder: (binder: NotebookBinderNode) => void;
  onSelectCategory: (category: NotebookCategory) => void;
  onSelectEntry: (entry: PersonalNotesEntry) => void;
  onTagFilter: (tag: string | null) => void;
  selectedEntry: PersonalNotesEntry | null;
  tagFilter: string | null;
  tagSummaries: Array<{ name: string; count: number }>;
}) {
  const selectedEntryKey = selectedEntry ? `${selectedEntry.kind}:${selectedEntry.id}` : null;
  const defaultExpandedScopes = useMemo(() => {
    if (selectedEntry) {
      return new Set([structuredScopeIdForEntry(selectedEntry)]);
    }
    const firstNonEmptyScope = categories.find((category) => category.id !== "all" && category.count > 0);
    return new Set(firstNonEmptyScope ? [firstNonEmptyScope.id] : []);
  }, [categories, selectedEntry]);
  const defaultExpandedBinders = useMemo(() => {
    const expanded = new Set<string>();
    for (const binder of hierarchy.bindersById.values()) {
      if (
        binder.entries.some((entry) => selectedEntryKey === `${entry.kind}:${entry.id}`) ||
        defaultExpandedScopes.has(binder.scopeId)
      ) {
        expanded.add(binder.id);
      }
    }
    return expanded;
  }, [defaultExpandedScopes, hierarchy.bindersById, selectedEntryKey]);
  const [expandedScopes, setExpandedScopes] = useState(defaultExpandedScopes);
  const [expandedBinders, setExpandedBinders] = useState(defaultExpandedBinders);

  useEffect(() => {
    setExpandedScopes(defaultExpandedScopes);
    setExpandedBinders(defaultExpandedBinders);
  }, [defaultExpandedBinders, defaultExpandedScopes]);

  const toggleScope = (category: NotebookCategory) => {
    onSelectCategory(category);
    setExpandedScopes((current) => {
      const next = new Set(current);
      if (next.has(category.id)) {
        next.delete(category.id);
      } else {
        next.add(category.id);
      }
      return next;
    });
  };

  const toggleBinder = (binder: NotebookBinderNode) => {
    onSelectBinder(binder);
    setExpandedBinders((current) => {
      const next = new Set(current);
      if (next.has(binder.id)) {
        next.delete(binder.id);
      } else {
        next.add(binder.id);
      }
      return next;
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-1 py-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Notebook</h2>
        <Button onClick={onClearFilters} size="sm" type="button" variant="ghost">
          Clear
        </Button>
      </div>
      <div className="mt-2 grid gap-1">
        {categories.map((category) => {
          const binders = hierarchy.bindersByScope[category.id] ?? [];
          const looseEntries =
            category.id === "loose"
              ? allEntries.filter((entry) => entry.kind === "personal-note" && !entry.personalBinderId)
              : [];
          const isExpanded = expandedScopes.has(category.id);
          return (
            <div className="min-w-0" key={category.id}>
              <button
                aria-expanded={isExpanded}
                aria-label={`${category.label} folder ${category.count}`}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition text-muted-foreground hover:bg-secondary/65 hover:text-foreground"
                onClick={() => toggleScope(category)}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ChevronRight className={`size-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="truncate">{category.label}</span>
                </span>
                <span className="text-xs">{category.count}</span>
              </button>
              {isExpanded ? (
                <div className="ml-5 mt-1 grid gap-1 border-l border-border/55 pl-2">
                  {category.id === "loose" ? (
                    looseEntries.length ? (
                      looseEntries.map((entry) => (
                        <StructuredNotebookEntryButton
                          entry={entry}
                          isSelected={selectedEntryKey === `${entry.kind}:${entry.id}`}
                          key={`${entry.kind}:${entry.id}`}
                          onSelectEntry={onSelectEntry}
                        />
                      ))
                    ) : (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">No loose notes yet.</p>
                    )
                  ) : binders.length ? (
                    binders.map((binder) => {
                      const binderExpanded = expandedBinders.has(binder.id);
                      return (
                        <div className="min-w-0" key={binder.id}>
                          <button
                            aria-expanded={binderExpanded}
                            aria-label={`${binder.title} binder ${binder.count}`}
                            className="flex w-full min-w-0 items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-secondary/65"
                            onClick={() => toggleBinder(binder)}
                            type="button"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <ChevronRight className={`size-3.5 shrink-0 transition-transform ${binderExpanded ? "rotate-90" : ""}`} />
                              <span className="truncate font-medium">{binder.title}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">{binder.count}</span>
                          </button>
                          {binderExpanded ? (
                            <div className="ml-5 mt-1 grid gap-1 border-l border-border/45 pl-2">
                              {binder.entries.map((entry) => (
                                <StructuredNotebookEntryButton
                                  entry={entry}
                                  isSelected={selectedEntryKey === `${entry.kind}:${entry.id}`}
                                  key={`${entry.kind}:${entry.id}`}
                                  onSelectEntry={onSelectEntry}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">No binders in {category.label} yet.</p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {tagSummaries.length ? (
        <div className="mt-5">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tags</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tagSummaries.slice(0, 12).map((tag) => (
              <button
                className={`rounded-md border px-2 py-1 text-xs ${
                  tagFilter === tag.name
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/70 text-muted-foreground hover:bg-secondary/70"
                }`}
                key={tag.name}
                onClick={() => onTagFilter(tagFilter === tag.name ? null : tag.name)}
                type="button"
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function StructuredNotebookEntryButton({
  entry,
  isSelected,
  onSelectEntry,
}: {
  entry: PersonalNotesEntry;
  isSelected: boolean;
  onSelectEntry: (entry: PersonalNotesEntry) => void;
}) {
  const noteTypeLabel =
    entry.kind === "binder-note" ? "private note" : entry.kind === "personal-document" ? "document" : "note";
  return (
    <button
      aria-label={`${entry.title} ${noteTypeLabel}`}
      className={`min-w-0 rounded-md px-2 py-1.5 text-left transition ${
        isSelected ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary/65 hover:text-foreground"
      }`}
      onClick={() => onSelectEntry(entry)}
      type="button"
    >
      <span className="block truncate text-xs font-medium">{entry.title}</span>
      <span className="block truncate text-[11px]">{entry.kind === "binder-note" ? "Binder private note" : noteTypeLabel}</span>
    </button>
  );
}

function CanvasNotesView({
  children,
  entries,
  onCreateDocument,
  onCreateNote,
  onSelectEntry,
  preferences,
  profileId,
  reviewQueue,
  selectedEntry,
}: {
  children: ReactNode;
  entries: PersonalNotesEntry[];
  onCreateDocument: () => void;
  onCreateNote: () => void;
  onSelectEntry: (entry: PersonalNotesEntry) => void;
  preferences: {
    canvasSafeEdgePadding: boolean;
    canvasSnapMode: "off" | "edges" | "modules";
    mobileCanvasBehavior: "module-switcher" | "simplified";
  };
  profileId?: string;
  reviewQueue: PersonalNotesEntry[];
  selectedEntry: PersonalNotesEntry | null;
}) {
  const [frames, setFrames] = useState(() => loadCanvasFrames(profileId));
  const [canvasHeight, setCanvasHeight] = useState(940);
  const topZ = Math.max(...canvasModuleIds.map((moduleId) => frames[moduleId]?.z ?? 1), 1);

  useEffect(() => {
    setFrames(loadCanvasFrames(profileId));
  }, [profileId]);

  const updateFrame = (moduleId: WorkspaceModuleId, frame: WorkspaceWindowFrame) => {
    setFrames((current) => {
      const next = { ...current, [moduleId]: frame };
      saveCanvasFrames(profileId, next);
      return next;
    });
  };

  const mobileModules = [
    { title: "Note", body: children },
    {
      title: "List",
      body: <NoteList compact entries={entries} onSelectEntry={onSelectEntry} selectedEntry={selectedEntry} />,
    },
    {
      title: "Review Queue",
      body: <ReviewQueue entries={reviewQueue} onSelectEntry={onSelectEntry} />,
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-border/70 bg-card/82 p-4 shadow-sm backdrop-blur md:hidden">
        <h2 className="text-base font-semibold">Canvas modules</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Full canvas editing works best on tablet or desktop. Phone view uses readable module cards.
        </p>
        <div className="mt-4 grid gap-3">
          {mobileModules.map((module) => (
            <section className="rounded-lg border border-border/70 bg-background p-3" key={module.title}>
              <h3 className="mb-3 text-sm font-semibold">{module.title}</h3>
              {module.body}
            </section>
          ))}
        </div>
      </div>

      <div className="workspace-canvas-shell hidden overflow-auto rounded-lg border border-border/70 bg-background/72 shadow-sm md:block">
        <div
          className="workspace-canvas relative"
          style={{ height: canvasHeight, minWidth: 1360 }}
        >
          {canvasModuleIds.map((moduleId) => {
            const frame = frames[moduleId];
            if (!frame || frame.w <= 0 || frame.h <= 0) {
              return null;
            }

            return (
              <WorkspaceWindow
                boundsHeight={canvasHeight}
                boundsWidth={1360}
                canvasHeight={canvasHeight}
                canvasWidth={1360}
                frame={frame}
                key={moduleId}
                locked={false}
                moduleId={moduleId}
                onCanvasHeightRequest={(nextFrame) => {
                  setCanvasHeight((height) => Math.max(height, nextFrame.y + nextFrame.h + 96));
                }}
                onCommit={updateFrame}
                onToggleCollapsed={(collapsedModuleId) => {
                  updateFrame(collapsedModuleId, {
                    ...(frames[collapsedModuleId] ?? defaultCanvasFrames[collapsedModuleId]),
                    h: 92,
                  });
                }}
                peerFrames={canvasModuleIds
                  .filter((candidate) => candidate !== moduleId)
                  .map((candidate) => frames[candidate])
                  .filter(Boolean)}
                safeEdgePadding={preferences.canvasSafeEdgePadding}
                snapBehavior={preferences.canvasSnapMode}
                snapEnabled={preferences.canvasSnapMode !== "off"}
                topZ={topZ}
                workspaceStyle="full-studio"
              >
                <CanvasModuleShell title={canvasTitleForModule(moduleId)}>
                  {renderCanvasModule({
                    moduleId,
                    entries,
                    selectedEntry,
                    reviewQueue,
                    children,
                    onCreateDocument,
                    onCreateNote,
                    onSelectEntry,
                  })}
                </CanvasModuleShell>
              </WorkspaceWindow>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PersonalNoteEditor({
  annotatorMode,
  compactMetadata,
  dirty,
  draftContent,
  draftTagsInput,
  draftTitle,
  editorWidth,
  entry,
  entries,
  focusMode,
  noteLinkAutocomplete,
  onAddTag,
  onContentChange,
  onEditorWidthChange,
  onFocusModeChange,
  onInsertTemplate,
  onOpenBinder,
  onPin,
  onRetrySave,
  onSave,
  onTagsChange,
  onTitleChange,
  saveError,
  saveState,
  showAnnotationColorFilter,
}: {
  annotatorMode: PersonalNotesAnnotatorMode;
  compactMetadata: boolean;
  dirty: boolean;
  draftContent: JSONContent;
  draftTagsInput: string;
  draftTitle: string;
  editorWidth: PersonalNotesEditorWidth;
  entry: PersonalNotesEntry | null;
  entries: PersonalNotesEntry[];
  focusMode: boolean;
  noteLinkAutocomplete: boolean;
  onAddTag: () => void;
  onContentChange: (content: JSONContent) => void;
  onEditorWidthChange: (width: PersonalNotesEditorWidth) => void;
  onFocusModeChange: (enabled: boolean) => void;
  onInsertTemplate: (content: JSONContent) => void;
  onOpenBinder: () => void;
  onPin: () => void;
  onRetrySave: () => void;
  onSave: () => void;
  onTagsChange: (tags: string) => void;
  onTitleChange: (title: string) => void;
  saveError: string | null;
  saveState: SaveState;
  showAnnotationColorFilter: boolean;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("blank");
  const [toolsOpen, setToolsOpen] = useState<"templates" | "tags" | "links" | "annotations" | null>(null);
  const [annotationPopover, setAnnotationPopover] = useState<"comment" | "link" | "tag" | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState("");
  const [floatingAnnotatorVisible, setFloatingAnnotatorVisible] = useState(false);
  const [highlightMenuOpen, setHighlightMenuOpen] = useState<"floating" | "top" | null>(null);
  const [highlightColorFilter, setHighlightColorFilter] = useState<AnnotationHighlightFilter>("all");
  const [annotationActions, setAnnotationActions] = useState<AnnotationRecord[]>([]);
  const editorRef = useRef<Editor | null>(null);

  const selectedTemplate = personalNoteTemplates.find((template) => template.id === selectedTemplateId) ?? personalNoteTemplates[0];
  const contentIsEmpty = extractPlainText(draftContent).trim().length === 0;
  const health = entry ? getPersonalNoteHealth(entry, { unsaved: dirty }) : [];
  const noteLinks = entry && noteLinkAutocomplete ? buildNoteLinkInsights(entry, entries, draftContent) : { linked: [], backlinks: [] };
  const topAnnotatorEnabled = annotatorMode === "top" || annotatorMode === "both";
  const floatingAnnotatorEnabled = annotatorMode === "floating" || annotatorMode === "both";
  const annotationRecords = useMemo(
    () => dedupeAnnotationRecords([...extractAnnotationRecords(draftContent), ...annotationActions]),
    [annotationActions, draftContent],
  );
  const visibleAnnotationRecords = useMemo(
    () =>
      highlightColorFilter === "all"
        ? annotationRecords
        : annotationRecords.filter((record) => record.color === highlightColorFilter),
    [annotationRecords, highlightColorFilter],
  );

  const showFloatingAnnotator = useCallback(() => {
    if (!floatingAnnotatorEnabled || typeof window === "undefined") {
      return;
    }
    setFloatingAnnotatorVisible(Boolean(window.getSelection()?.toString().trim()));
  }, [floatingAnnotatorEnabled]);

  const rememberAnnotation = useCallback((record: Omit<AnnotationRecord, "id">) => {
    setAnnotationActions((current) => [
      {
        ...record,
        id: `${record.type}:${record.color}:${Date.now()}:${current.length}`,
      },
      ...current,
    ]);
  }, []);

  const applyHighlight = useCallback((color = "#fde68a") => {
    const colorMeta = annotationHighlightColors.find((item) => item.color === color) ?? annotationHighlightColors[0];
    editorRef.current?.chain().focus().toggleHighlight({ color }).run();
    rememberAnnotation({
      type: "highlight",
      label: `${colorMeta.label} highlight`,
      color: colorMeta.value,
      text: getCurrentSelectionText() || draftTitle,
    });
    setHighlightMenuOpen(null);
  }, [draftTitle, rememberAnnotation]);

  const removeHighlight = useCallback(() => {
    editorRef.current?.chain().focus().unsetHighlight().run();
    rememberAnnotation({
      type: "highlight",
      label: "Removed highlight",
      color: "all",
      text: getCurrentSelectionText() || draftTitle,
    });
    setHighlightMenuOpen(null);
  }, [draftTitle, rememberAnnotation]);

  const runEditorMark = useCallback((command: "bold" | "italic" | "underline") => {
    const chain = editorRef.current?.chain().focus();
    if (command === "bold") {
      chain?.toggleBold().run();
    } else if (command === "italic") {
      chain?.toggleItalic().run();
    } else {
      chain?.toggleUnderline().run();
      rememberAnnotation({
        type: "highlight",
        label: "Underline",
        color: "all",
        text: getCurrentSelectionText() || draftTitle,
      });
    }
  }, []);

  const saveAnnotationPopover = useCallback(() => {
    const text = annotationDraft.trim();
    if (!text) {
      return;
    }
    const commandId = `annotation-${Date.now()}`;
    const chain = editorRef.current?.chain().focus() as
      | {
          setLink?: (attrs: { href: string }) => { run: () => boolean };
          setMark?: (name: string, attrs: Record<string, unknown>) => { run: () => boolean };
        }
      | undefined;
    if (annotationPopover === "link") {
      chain?.setLink?.({ href: text }).run();
    } else if (annotationPopover === "comment") {
      chain?.setMark?.("commentAnnotation", { body: text, id: commandId }).run();
    } else if (annotationPopover === "tag") {
      chain?.setMark?.("selectionTagAnnotation", { id: commandId, tag: text }).run();
    }
    rememberAnnotation({
      type: annotationPopover === "link" ? "link" : annotationPopover === "tag" ? "tag" : "comment",
      label: annotationPopover === "link" ? "Link" : annotationPopover === "tag" ? `Tag: ${text}` : "Comment",
      color: "all",
      text,
    });
    setAnnotationDraft("");
    setAnnotationPopover(null);
  }, [annotationDraft, annotationPopover, rememberAnnotation]);

  const addSourceMarker = useCallback(() => {
    if (!entry || entry.kind !== "binder-note") {
      return;
    }
    const selectedText = getCurrentSelectionText() || draftTitle || "Source-linked passage";
    const commandId = `source-${Date.now()}`;
    const chain = editorRef.current?.chain().focus() as
      | { setMark?: (name: string, attrs: Record<string, unknown>) => { run: () => boolean } }
      | undefined;
    chain?.setMark?.("sourceMarker", {
      binderId: entry.sourceBinderId,
      binderTitle: entry.sourceBinderTitle,
      id: commandId,
      lessonId: entry.sourceDocumentId,
      lessonTitle: entry.sourceDocumentTitle,
    }).run();
    rememberAnnotation({
      type: "source-marker",
      label: "Source marker",
      color: "all",
      text: `${entry.sourceBinderTitle ?? "Source binder"} / ${entry.sourceDocumentTitle ?? selectedText}`,
    });
    setToolsOpen("annotations");
  }, [draftTitle, entry, rememberAnnotation]);

  useEffect(() => {
    const handleAnnotationCommand = (event: Event) => {
      const command = (event as CustomEvent<{ command?: string }>).detail?.command;
      if (command === "highlight") {
        applyHighlight();
      } else if (command === "highlight-yellow") {
        applyHighlight(annotationHighlightColors[0].color);
      } else if (command === "highlight-blue") {
        applyHighlight(annotationHighlightColors[1].color);
      } else if (command === "highlight-green") {
        applyHighlight(annotationHighlightColors[2].color);
      } else if (command === "highlight-pink") {
        applyHighlight(annotationHighlightColors[3].color);
      } else if (command === "remove-highlight") {
        removeHighlight();
      } else if (command === "comment") {
        setAnnotationPopover("comment");
      } else if (command === "link") {
        setAnnotationPopover("link");
      } else if (command === "tag") {
        setAnnotationPopover("tag");
      } else if (command === "source-marker") {
        addSourceMarker();
      } else if (command === "filter-all") {
        setHighlightColorFilter("all");
      } else if (command === "filter-yellow") {
        setHighlightColorFilter("yellow");
      } else if (command === "filter-blue") {
        setHighlightColorFilter("blue");
      } else if (command === "filter-green") {
        setHighlightColorFilter("green");
      } else if (command === "filter-pink") {
        setHighlightColorFilter("pink");
      } else if (command === "open-drawer") {
        setToolsOpen("annotations");
      }
    };
    window.addEventListener("personal-notes:annotation-command", handleAnnotationCommand);
    return () => window.removeEventListener("personal-notes:annotation-command", handleAnnotationCommand);
  }, [addSourceMarker, applyHighlight, removeHighlight]);

  if (!entry) {
    return (
      <div className="grid min-h-[540px] place-items-center p-6" data-testid="personal-note-empty-editor">
        <EmptyState
          description="Create a note, binder, document, or open a binder-linked private note."
          title="Choose a note"
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background" data-testid="personal-note-editor">
      {entry.kind === "binder-note" ? (
        <div
          className="flex shrink-0 flex-col gap-2 border-b border-border/55 bg-secondary/18 px-4 py-2 text-xs xl:flex-row xl:items-center xl:justify-between"
          data-testid="binder-source-action-row"
        >
          <div className="min-w-0 flex-1 truncate" title={`Linked to ${entry.sourceBinderTitle} / ${entry.sourceDocumentTitle}`}>
            <span className="font-semibold">Linked to {entry.sourceBinderTitle}</span>
            <span className="text-muted-foreground"> / {entry.sourceDocumentTitle}</span>
          </div>
          <Button
            className="max-w-full justify-start overflow-hidden whitespace-nowrap sm:w-fit xl:shrink-0"
            data-testid="open-binder-workspace-button"
            onClick={onOpenBinder}
            size="sm"
            type="button"
            variant="outline"
          >
            <ArrowUpRight className="shrink-0" data-icon="inline-start" />
            <span className="truncate">Open binder workspace</span>
          </Button>
        </div>
      ) : null}

      <header className="shrink-0 border-b border-border/45 px-4 py-2">
        <div className={`grid gap-1.5 ${editorWidthClass(editorWidth)}`} data-editor-width={editorWidth}>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Note title</span>
              <input
                className="w-full border-0 bg-transparent text-2xl font-semibold leading-tight tracking-tight outline-none placeholder:text-muted-foreground md:text-3xl"
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="Untitled note"
                value={draftTitle}
              />
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Editor width"
                className="appearance-select h-8 rounded-md border border-border/80 bg-background px-2 text-xs font-semibold"
                onChange={(event) => onEditorWidthChange(event.target.value as PersonalNotesEditorWidth)}
                value={editorWidth}
              >
                {editorWidthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {entry.kind !== "binder-note" ? (
                <Button aria-label={entry.pinned ? "Unpin note" : "Pin note"} className="px-2" onClick={onPin} size="sm" type="button" variant="ghost">
                  <Pin />
                </Button>
              ) : null}
              <Button aria-label="Templates" className="px-2" onClick={() => setToolsOpen("templates")} size="sm" type="button" variant="ghost">
                <FileText />
              </Button>
              {entry.kind !== "binder-note" ? (
                <Button aria-label="Tags" className="px-2" onClick={() => setToolsOpen("tags")} size="sm" type="button" variant="ghost">
                  <Tags />
                </Button>
              ) : null}
              {noteLinkAutocomplete ? (
                <Button aria-label="Links" className="px-2" onClick={() => setToolsOpen("links")} size="sm" type="button" variant="ghost">
                  <NotebookTabs />
                </Button>
              ) : null}
              <Button aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"} className="px-2" onClick={() => onFocusModeChange(!focusMode)} size="sm" type="button" variant="outline">
                <Focus />
              </Button>
              <Button disabled={!dirty || saveState === "saving"} onClick={onSave} size="sm" type="button">
                <Save data-icon="inline-start" />
                {saveState === "saving" ? "Saving" : "Save"}
              </Button>
            </div>
          </div>

          {topAnnotatorEnabled ? (
            <AnnotatorToolbar
              colorFilter={highlightColorFilter}
              entry={entry}
              onComment={() => setAnnotationPopover("comment")}
              onHighlight={applyHighlight}
              onHighlightFilterChange={setHighlightColorFilter}
              onLink={() => setAnnotationPopover("link")}
              onOpenAnnotations={() => setToolsOpen("annotations")}
              onRemoveHighlight={removeHighlight}
              onSourceMarker={addSourceMarker}
              onTag={() => setAnnotationPopover("tag")}
              onToggleHighlightMenu={() => setHighlightMenuOpen((current) => current === "top" ? null : "top")}
              onUnderline={() => runEditorMark("underline")}
              showColorFilter={showAnnotationColorFilter}
              showHighlightMenu={highlightMenuOpen === "top"}
            />
          ) : null}

          <div className={`${compactMetadata ? "mt-0" : "mt-1"} flex flex-wrap items-center gap-1.5`}>
            <Badge variant={saveState === "error" ? "destructive" : dirty ? "outline" : "secondary"}>
              {saveState === "error" ? "Save failed" : dirty ? "Unsaved" : "Saved"}
            </Badge>
            {health.slice(0, compactMetadata ? 4 : 8).map((signal) => (
              <Badge
                key={signal.id}
                variant={signal.tone === "warning" ? "outline" : signal.tone === "good" ? "secondary" : "outline"}
              >
                {signal.label}
              </Badge>
            ))}
          </div>
          {saveError ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm">
              <span>{saveError}</span>
              <Button onClick={onRetrySave} size="sm" type="button" variant="outline">
                Retry
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto" onKeyUp={showFloatingAnnotator} onMouseUp={showFloatingAnnotator}>
        {floatingAnnotatorVisible ? (
          <div
            aria-label="Floating annotation toolkit"
            className="sticky top-2 z-20 mx-auto mb-2 flex w-fit max-w-[min(94vw,760px)] flex-wrap items-center gap-1 rounded-xl border border-border bg-popover px-2 py-1 shadow-xl"
            role="toolbar"
          >
            <Button aria-label="Bold selection" className="px-2" onClick={() => runEditorMark("bold")} size="sm" type="button" variant="ghost">
              B
            </Button>
            <Button aria-label="Italic selection" className="px-2 italic" onClick={() => runEditorMark("italic")} size="sm" type="button" variant="ghost">
              I
            </Button>
            <Button aria-label="Underline selection" className="px-2" onClick={() => runEditorMark("underline")} size="sm" type="button" variant="ghost">
              <Underline />
            </Button>
            <div className="relative">
              <Button aria-label="Highlight selection" className="px-2" onClick={() => setHighlightMenuOpen((current) => current === "floating" ? null : "floating")} size="sm" type="button" variant="ghost">
                <Highlighter />
              </Button>
              {highlightMenuOpen === "floating" ? (
                <HighlightColorMenu onHighlight={applyHighlight} onRemoveHighlight={removeHighlight} />
              ) : null}
            </div>
            {showAnnotationColorFilter ? (
              <HighlightColorFilterSelect onChange={setHighlightColorFilter} value={highlightColorFilter} />
            ) : null}
            <Button aria-label="Comment selection" className="px-2" onClick={() => setAnnotationPopover("comment")} size="sm" type="button" variant="ghost">
              <MessageSquare />
            </Button>
            <Button aria-label="Link selection" className="px-2" onClick={() => setAnnotationPopover("link")} size="sm" type="button" variant="ghost">
              <Link2 />
            </Button>
            <Button aria-label="Tag selection" className="px-2" onClick={() => setAnnotationPopover("tag")} size="sm" type="button" variant="ghost">
              <Tags />
            </Button>
            {entry.kind === "binder-note" ? (
              <Button aria-label="Source citation marker" className="px-2" onClick={addSourceMarker} size="sm" type="button" variant="ghost">
                <ArrowUpRight />
              </Button>
            ) : null}
            <Button aria-label="More annotation actions" className="px-2" onClick={() => setToolsOpen("annotations")} size="sm" type="button" variant="ghost">
              <ListFilter />
            </Button>
          </div>
        ) : null}
        <div
          className={`grid gap-2 px-4 pb-8 pt-3 ${editorWidthClass(editorWidth)}`}
          data-highlight-filter={highlightColorFilter}
          data-testid="personal-note-writing-surface"
        >
          <RichTextEditor
            className={`personal-notes-editor-page ${focusMode ? "min-h-[calc(100vh-9rem)]" : "min-h-[calc(100vh-13rem)]"}`}
            onChange={onContentChange}
            onEditorReady={(editor) => {
              editorRef.current = editor;
            }}
            placeholder="Write in BinderNotes..."
            value={draftContent}
          />
        </div>
      </div>

      {annotationPopover ? (
        <div
          aria-label={annotationPopover === "comment" ? "Annotation comment popover" : annotationPopover === "tag" ? "Annotation tag popover" : "Annotation link popover"}
          className="absolute right-4 top-32 z-40 w-full max-w-sm rounded-lg border border-border bg-popover p-3 shadow-2xl"
          role="dialog"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{annotationPopover === "comment" ? "Comment" : annotationPopover === "tag" ? "Tag selection" : "Link"}</h2>
            <Button aria-label="Close annotation popover" onClick={() => setAnnotationPopover(null)} size="icon" type="button" variant="ghost">
              <X />
            </Button>
          </div>
          <Input
            aria-label={annotationPopover === "comment" ? "Comment text" : annotationPopover === "tag" ? "Selection tag" : "Link URL"}
            className="mt-3"
            onChange={(event) => setAnnotationDraft(event.target.value)}
            placeholder={annotationPopover === "comment" ? "Add a margin note" : annotationPopover === "tag" ? "Tag this selection" : "Paste a link"}
            value={annotationDraft}
          />
          <Button className="mt-3" disabled={!annotationDraft.trim()} onClick={saveAnnotationPopover} size="sm" type="button">
            Save annotation
          </Button>
        </div>
      ) : null}

      {toolsOpen ? (
        <aside
          aria-label={
            toolsOpen === "templates"
              ? "Templates drawer"
              : toolsOpen === "tags"
                ? "Tags drawer"
                : toolsOpen === "links"
                  ? "Note links and backlinks drawer"
                  : "Annotations drawer"
          }
          className="absolute inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-popover shadow-2xl"
          role="dialog"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <h2 className="text-sm font-semibold">
              {toolsOpen === "templates"
                ? "Templates"
                : toolsOpen === "tags"
                  ? "Tags"
                  : toolsOpen === "links"
                    ? "Links and backlinks"
                    : "Annotations"}
            </h2>
            <Button aria-label="Close drawer" onClick={() => setToolsOpen(null)} size="icon" type="button" variant="ghost">
              <X />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {toolsOpen === "templates" ? (
              <div className="grid gap-3">
                <label className="grid gap-2 text-sm font-semibold">
                  Insert template
                  <select
                    aria-label="Insert template"
                    className="appearance-select h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    value={selectedTemplateId}
                  >
                    {personalNoteTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-sm leading-6 text-muted-foreground">{selectedTemplate.description}</p>
                <Button
                  disabled={!contentIsEmpty}
                  onClick={() => {
                    onInsertTemplate(selectedTemplate.content);
                    setToolsOpen(null);
                  }}
                  type="button"
                >
                  Insert template
                </Button>
                {!contentIsEmpty ? (
                  <p className="text-xs text-muted-foreground">Templates insert into empty notes only.</p>
                ) : null}
              </div>
            ) : null}
            {toolsOpen === "tags" ? (
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Tags</span>
                <Input
                  aria-label="Tags"
                  onChange={(event) => onTagsChange(event.target.value)}
                  placeholder="review-later, math, research"
                  value={draftTagsInput}
                />
                <Button onClick={onAddTag} type="button" variant="outline">
                  Add tag
                </Button>
              </label>
            ) : null}
            {toolsOpen === "links" ? (
              <div className="grid gap-5">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Linked notes</h3>
                  <LinkedEntryList emptyLabel="No note links yet." entries={noteLinks.linked} />
                </section>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Backlinks</h3>
                  <LinkedEntryList emptyLabel="No backlinks yet." entries={noteLinks.backlinks} />
                </section>
              </div>
            ) : null}
            {toolsOpen === "annotations" ? (
              <div className="grid gap-3 text-sm">
                <p className="text-muted-foreground">Highlights, comments, links, and annotation markers for this note collect here.</p>
                <HighlightColorFilterSelect
                  label="Annotation color filter"
                  onChange={setHighlightColorFilter}
                  value={highlightColorFilter}
                />
                {entry.kind === "binder-note" ? (
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="font-semibold">Source context</p>
                    <p className="mt-1 text-muted-foreground">{entry.sourceBinderTitle} / {entry.sourceDocumentTitle}</p>
                  </div>
                ) : null}
                {visibleAnnotationRecords.length > 0 ? (
                  <div className="grid gap-2" data-testid="annotation-record-list">
                    {visibleAnnotationRecords.map((record) => (
                      <div className="rounded-lg border border-border bg-background p-3" key={record.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{record.label}</p>
                          <Badge variant="outline">{record.type}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-3 text-muted-foreground">{record.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    {highlightColorFilter === "all"
                      ? "No saved annotations yet."
                      : `No ${highlightColorFilter} annotations yet.`}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function editorWidthClass(width: PersonalNotesEditorWidth) {
  switch (width) {
    case "focused":
      return "mx-auto w-full max-w-3xl";
    case "comfortable":
      return "mx-auto w-full max-w-5xl";
    case "full":
      return "w-full max-w-none";
    case "wide":
    default:
      return "mx-auto w-full max-w-[1500px]";
  }
}

function AnnotatorToolbar({
  colorFilter,
  entry,
  onComment,
  onHighlight,
  onHighlightFilterChange,
  onLink,
  onOpenAnnotations,
  onRemoveHighlight,
  onSourceMarker,
  onTag,
  onToggleHighlightMenu,
  onUnderline,
  showColorFilter,
  showHighlightMenu,
}: {
  colorFilter: AnnotationHighlightFilter;
  entry: PersonalNotesEntry;
  onComment: () => void;
  onHighlight: (color?: string) => void;
  onHighlightFilterChange: (color: AnnotationHighlightFilter) => void;
  onLink: () => void;
  onOpenAnnotations: () => void;
  onRemoveHighlight: () => void;
  onSourceMarker: () => void;
  onTag: () => void;
  onToggleHighlightMenu: () => void;
  onUnderline: () => void;
  showColorFilter: boolean;
  showHighlightMenu: boolean;
}) {
  return (
    <div aria-label="Top annotator toolbar" className="flex flex-wrap items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1" role="toolbar">
      <div className="relative">
        <Button aria-label="Highlight" className="px-2" onClick={onToggleHighlightMenu} size="sm" type="button" variant="ghost">
          <Highlighter />
        </Button>
        {showHighlightMenu ? (
          <HighlightColorMenu onHighlight={onHighlight} onRemoveHighlight={onRemoveHighlight} />
        ) : null}
      </div>
      {showColorFilter ? (
        <HighlightColorFilterSelect onChange={onHighlightFilterChange} value={colorFilter} />
      ) : null}
      <Button aria-label="Comment" className="px-2" onClick={onComment} size="sm" type="button" variant="ghost">
        <MessageSquare />
      </Button>
      <Button aria-label="Underline" className="px-2" onClick={onUnderline} size="sm" type="button" variant="ghost">
        <Underline />
      </Button>
      <Button aria-label="Link" className="px-2" onClick={onLink} size="sm" type="button" variant="ghost">
        <Link2 />
      </Button>
      <Button aria-label="Tag selection" className="px-2" onClick={onTag} size="sm" type="button" variant="ghost">
        <Tags />
      </Button>
      <Button aria-label="Remove annotation" className="px-2" onClick={onRemoveHighlight} size="sm" type="button" variant="ghost">
        <X />
      </Button>
      {entry.kind === "binder-note" ? (
        <Button aria-label="Source note citation" className="px-2" onClick={onSourceMarker} size="sm" type="button" variant="ghost">
          <ArrowUpRight />
        </Button>
      ) : null}
      <Button aria-label="Open annotations drawer" className="px-2" onClick={onOpenAnnotations} size="sm" type="button" variant="ghost">
        <NotebookTabs />
      </Button>
    </div>
  );
}

function HighlightColorMenu({
  onHighlight,
  onRemoveHighlight,
}: {
  onHighlight: (color?: string) => void;
  onRemoveHighlight: () => void;
}) {
  return (
    <div
      aria-label="Highlight colors"
      className="absolute left-0 top-[calc(100%+0.35rem)] z-50 grid min-w-44 gap-1 rounded-lg border border-border bg-popover p-1 shadow-2xl"
      role="menu"
    >
      {annotationHighlightColors.map((color) => (
        <button
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold hover:bg-secondary"
          key={color.value}
          onClick={() => onHighlight(color.color)}
          role="menuitem"
          type="button"
        >
          <span className={`size-2.5 rounded-full ${color.swatch}`} />
          {color.label} highlight
        </button>
      ))}
      <button
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        onClick={onRemoveHighlight}
        role="menuitem"
        type="button"
      >
        <X className="size-3.5" />
        Remove highlight
      </button>
    </div>
  );
}

function HighlightColorFilterSelect({
  label = "Highlight color filter",
  onChange,
  value,
}: {
  label?: string;
  onChange: (value: AnnotationHighlightFilter) => void;
  value: AnnotationHighlightFilter;
}) {
  return (
    <label className="flex items-center gap-1 rounded-md border border-border/70 bg-background px-1.5 py-1 text-[11px] font-semibold text-muted-foreground">
      <Search className="size-3.5" />
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="appearance-select bg-transparent text-xs text-foreground outline-none"
        onChange={(event) => onChange(event.target.value as AnnotationHighlightFilter)}
        value={value}
      >
        <option value="all">All colors</option>
        {annotationHighlightColors.map((color) => (
          <option key={color.value} value={color.value}>
            {color.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildNoteLinkInsights(
  entry: PersonalNotesEntry,
  entries: PersonalNotesEntry[],
  draftContent: JSONContent,
) {
  const linkedTitles = new Set(extractBracketLinks(extractPlainText(draftContent)).map(normalizeLooseText));
  const linked = entries.filter((candidate) =>
    candidate.id !== entry.id && linkedTitles.has(normalizeLooseText(candidate.title)),
  );
  const backlinks = entries.filter((candidate) => {
    if (candidate.id === entry.id) {
      return false;
    }
    const candidateLinks = extractBracketLinks(extractPlainText(candidate.content)).map(normalizeLooseText);
    return candidateLinks.includes(normalizeLooseText(entry.title));
  });

  return { linked, backlinks };
}

function LinkedEntryList({
  emptyLabel,
  entries,
}: {
  emptyLabel: string;
  entries: PersonalNotesEntry[];
}) {
  if (entries.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {entries.slice(0, 8).map((entry) => (
        <Badge key={`${entry.kind}:link:${entry.id}`} variant="outline">
          {entry.title}
        </Badge>
      ))}
    </div>
  );
}

function extractBracketLinks(text: string) {
  return Array.from(text.matchAll(/\[\[([^\]]+)\]\]/g)).map((match) => match[1].trim()).filter(Boolean);
}

function normalizeLooseText(value: string) {
  return value.trim().toLowerCase();
}

function getCurrentSelectionText() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.getSelection()?.toString().trim() ?? "";
}

function extractAnnotationRecords(content: JSONContent): AnnotationRecord[] {
  const records: AnnotationRecord[] = [];
  const visit = (node: JSONContent) => {
    const nodeText = typeof node.text === "string" ? node.text : "";
    for (const mark of node.marks ?? []) {
      if (mark.type === "highlight") {
        const color = highlightColorFromValue(mark.attrs?.color);
        records.push({
          id: `highlight:${records.length}:${nodeText}`,
          type: "highlight",
          label: `${labelForHighlightFilter(color)} highlight`,
          color,
          text: nodeText || "Highlighted passage",
        });
      }
      if (mark.type === "link" || mark.type === "annotationLink") {
        records.push({
          id: `link:${records.length}:${nodeText}`,
          type: "link",
          label: "Link",
          color: "all",
          text: nodeText || String(mark.attrs?.href ?? "Linked text"),
        });
      }
      if (mark.type === "commentAnnotation") {
        records.push({
          id: `comment:${records.length}:${nodeText}`,
          type: "comment",
          label: "Comment",
          color: highlightColorFromValue(mark.attrs?.color),
          text: String(mark.attrs?.body ?? nodeText ?? "Comment"),
        });
      }
      if (mark.type === "selectionTagAnnotation") {
        const tag = String(mark.attrs?.tag ?? "Selection tag");
        records.push({
          id: `tag:${records.length}:${nodeText}:${tag}`,
          type: "tag",
          label: `Tag: ${tag}`,
          color: "all",
          text: nodeText || tag,
        });
      }
      if (mark.type === "sourceMarker") {
        records.push({
          id: `source:${records.length}:${nodeText}`,
          type: "source-marker",
          label: "Source marker",
          color: "all",
          text: nodeText || String(mark.attrs?.lessonTitle ?? "Source-linked passage"),
        });
      }
    }
    for (const child of node.content ?? []) {
      visit(child);
    }
  };
  visit(content);
  return records;
}

function dedupeAnnotationRecords(records: AnnotationRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.type}:${record.label}:${record.color}:${record.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function highlightColorFromValue(value: unknown): AnnotationHighlightFilter {
  const color = typeof value === "string" ? value.toLowerCase() : "";
  if (color.includes("93c5fd") || color.includes("blue")) {
    return "blue";
  }
  if (color.includes("86efac") || color.includes("green")) {
    return "green";
  }
  if (color.includes("d8b4fe") || color.includes("pink") || color.includes("purple") || color.includes("violet")) {
    return "pink";
  }
  if (color.includes("fde68a") || color.includes("yellow") || color.includes("amber")) {
    return "yellow";
  }
  return "all";
}

function labelForHighlightFilter(color: AnnotationHighlightFilter) {
  if (color === "all") {
    return "Uncolored";
  }
  return annotationHighlightColors.find((item) => item.value === color)?.label ?? color;
}

function NoteList({
  compact = false,
  entries,
  onSelectEntry,
  selectedEntry,
}: {
  compact?: boolean;
  entries: PersonalNotesEntry[];
  onSelectEntry: (entry: PersonalNotesEntry) => void;
  selectedEntry: PersonalNotesEntry | null;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        description="Try a different search or create a new note."
        title="No notes match"
      />
    );
  }

  return (
    <div className={compact ? "mt-2 divide-y divide-border/55" : "mt-3 grid gap-1.5"}>
      {entries.map((entry) => (
        <button
          className={`w-full max-w-full overflow-hidden text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            compact
              ? `rounded-md px-2.5 py-2 ${
                  selectedEntry?.id === entry.id
                    ? "bg-primary/12 text-foreground"
                    : "hover:bg-secondary/60"
                }`
              : `rounded-md border px-2.5 py-2.5 ${
                  selectedEntry?.id === entry.id
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/70 bg-background/78 hover:bg-secondary/70"
                }`
          }`}
          data-testid="personal-note-list-row"
          key={`${entry.kind}:${entry.id}`}
          onClick={() => onSelectEntry(entry)}
          type="button"
        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-words text-sm font-semibold leading-5">{entry.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {entry.folderName} / {entry.sourceType}
              </p>
            </div>
            {entry.pinned ? (
              <Pin className="mt-0.5 size-3.5 shrink-0 text-primary" />
            ) : (
              <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            )}
          </div>
          {!compact ? (
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{entry.excerpt}</p>
          ) : null}
          <div className="mt-2 flex max-w-full flex-wrap gap-1.5 overflow-hidden">
            {entry.kind === "binder-note" ? <Badge variant="secondary">Linked</Badge> : null}
            {!compact
              ? entry.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))
              : null}
          </div>
        </button>
      ))}
    </div>
  );
}

function ReviewQueue({
  compact = false,
  entries,
  onSelectEntry,
}: {
  compact?: boolean;
  entries: PersonalNotesEntry[];
  onSelectEntry: (entry: PersonalNotesEntry) => void;
}) {
  return (
    <div className="grid gap-2">
      {entries.slice(0, 6).map((entry) => (
        <button
          className={`rounded-lg border border-border/70 bg-background/78 text-left transition hover:bg-secondary/70 ${
            compact ? "p-2" : "p-3"
          }`}
          key={`${entry.kind}:review:${entry.id}`}
          onClick={() => onSelectEntry(entry)}
          type="button"
        >
          <p className="text-sm font-semibold">{entry.title}</p>
          {!compact ? (
            <p className="mt-1 text-xs text-muted-foreground">{entry.sourceType} / {formatDate(entry.updated_at)}</p>
          ) : null}
        </button>
      ))}
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pinned, recent, math, and review-later notes collect here.</p>
      ) : null}
    </div>
  );
}

type AnnotationCommand =
  | "highlight"
  | "highlight-yellow"
  | "highlight-blue"
  | "highlight-green"
  | "highlight-pink"
  | "remove-highlight"
  | "comment"
  | "link"
  | "tag"
  | "source-marker"
  | "filter-all"
  | "filter-yellow"
  | "filter-blue"
  | "filter-green"
  | "filter-pink"
  | "open-drawer";

function dispatchAnnotationCommand(command: AnnotationCommand) {
  window.dispatchEvent(new CustomEvent("personal-notes:annotation-command", { detail: { command } }));
}

function CommandPalette({
  categories,
  entries,
  onAddTag,
  onClose,
  onCreateBinder,
  onCreateCanvasNotebook,
  onCreateDocument,
  onCreateFolder,
  onCreateNote,
  onCopyLink,
  onEditorWidthChange,
  onEnterFullscreenFocus,
  onFocusEditor,
  onMoveToFolder,
  onNotebookBack,
  onOpenSettings,
  onOpenReviewQueue,
  onOpenCategory,
  onOpenRecent,
  onOpenSource,
  onOpenTemplates,
  onShowAllNotes,
  onPin,
  onSwitchView,
  onToggleBinderNotes,
  onToggleFocusMode,
  onToggleNotebookPane,
  onToggleNotesListPane,
  onToggleReviewSidebar,
  onToggleSidebars,
  onToggleStyle,
  onToggleTopChrome,
  onUpdatePreferences,
  focusMode,
  personalStorageReady,
  selectedEntry,
  sidebarsHidden,
  topChromeHidden,
}: {
  categories: NotebookCategory[];
  entries: PersonalNotesEntry[];
  onAddTag: () => void;
  onClose: () => void;
  onCreateBinder: () => void;
  onCreateCanvasNotebook: () => void;
  onCreateDocument: () => void;
  onCreateFolder: () => void;
  onCreateNote: () => void;
  onCopyLink: () => void;
  onEditorWidthChange: (width: PersonalNotesEditorWidth) => void;
  onEnterFullscreenFocus: () => void;
  onFocusEditor: () => void;
  onMoveToFolder: () => void;
  onNotebookBack: () => void;
  onOpenSettings: () => void;
  onOpenReviewQueue: () => void;
  onOpenCategory: (category: NotebookCategory) => void;
  onOpenRecent: () => void;
  onOpenSource: () => void;
  onOpenTemplates: () => void;
  onShowAllNotes: () => void;
  onPin: () => void;
  onSwitchView: (view: PersonalNotesViewMode) => void;
  onToggleBinderNotes: () => void;
  onToggleFocusMode: () => void;
  onToggleNotebookPane: () => void;
  onToggleNotesListPane: () => void;
  onToggleReviewSidebar: () => void;
  onToggleSidebars: () => void;
  onToggleStyle: () => void;
  onToggleTopChrome: () => void;
  onUpdatePreferences: (value: Partial<PersonalNotesPreferences>) => void;
  focusMode: boolean;
  personalStorageReady: boolean;
  selectedEntry: PersonalNotesEntry | null;
  sidebarsHidden: boolean;
  topChromeHidden: boolean;
}) {
  const [commandQuery, setCommandQuery] = useState("");
  const commands = [
    { label: "New note", action: onCreateNote, icon: <FilePlus2 />, disabled: !personalStorageReady },
    { label: "New binder", action: onCreateBinder, icon: <BookMarked />, disabled: !personalStorageReady },
    { label: "New document", action: onCreateDocument, icon: <FileText />, disabled: !personalStorageReady },
    { label: "New folder", action: onCreateFolder, icon: <FolderPlus />, disabled: !personalStorageReady },
    { label: "New canvas notebook", action: onCreateCanvasNotebook, icon: <Plus />, disabled: !personalStorageReady },
    { label: "Search notes", action: () => undefined, icon: <Search /> },
    { label: "Search binders", action: () => undefined, icon: <BookMarked /> },
    { label: "Open binder", action: () => undefined, icon: <BookMarked /> },
    { label: "Show all notes", action: onShowAllNotes, icon: <NotebookTabs /> },
    ...categories
      .filter((category) => ["all", "history", "math", "chemistry", "loose", "binder-linked"].includes(category.id))
      .map((category) => ({
        label: `Open ${category.label}`,
        action: () => onOpenCategory(category),
        icon: <NotebookTabs />,
      })),
    { label: "Go back in notebook sidebar", action: onNotebookBack, icon: <ChevronLeft /> },
    { label: "Reset notebook sidebar", action: onShowAllNotes, icon: <NotebookTabs /> },
    { label: "Clear selected binder", action: onNotebookBack, icon: <BookMarked /> },
    { label: "Toggle binder-linked notes", action: onToggleBinderNotes, icon: <ListFilter /> },
    { label: "Toggle App Appearance Minimal/Studio", action: onToggleStyle, icon: <Sparkles /> },
    { label: "Use Structured Workspace", action: () => onUpdatePreferences({ sidebarNavigationMode: "structured" }), icon: <NotebookTabs /> },
    { label: "Use Loose Notes", action: () => onUpdatePreferences({ sidebarNavigationMode: "loose" }), icon: <NotebookTabs /> },
    { label: sidebarsHidden ? "Show sidebars" : "Hide sidebars", action: onToggleSidebars, icon: <PanelLeft /> },
    { label: "Toggle Notebook pane", action: onToggleNotebookPane, icon: <PanelLeft /> },
    { label: "Toggle Notes list pane", action: onToggleNotesListPane, icon: <PanelLeft /> },
    { label: "Toggle Review Queue sidebar", action: onToggleReviewSidebar, icon: <CheckSquare /> },
    { label: topChromeHidden ? "Show top chrome" : "Hide top chrome", action: onToggleTopChrome, icon: <PanelLeft /> },
    { label: focusMode ? "Exit focus mode" : "Enter focus mode", action: onToggleFocusMode, icon: <Maximize2 />, disabled: !selectedEntry },
    { label: "Enter fullscreen focus", action: onEnterFullscreenFocus, icon: <Maximize2 />, disabled: !selectedEntry },
    { label: "Open settings", action: onOpenSettings, icon: <Settings2 /> },
    { label: "Switch to Home view", action: () => onSwitchView("home"), icon: <NotebookTabs /> },
    { label: "Switch to Organize view", action: () => onSwitchView("organize"), icon: <PanelLeft /> },
    { label: "Switch to Notes view", action: () => onSwitchView("notes"), icon: <NotebookTabs /> },
    ...editorWidthOptions.map((option) => ({
      label: `Change editor width to ${option.label}`,
      action: () => onEditorWidthChange(option.value),
      icon: <Maximize2 />,
    })),
    { label: "Open Review Queue", action: onOpenReviewQueue, icon: <CheckSquare /> },
    { label: "Toggle annotator tools", action: () => onUpdatePreferences({ annotatorTools: "both" }), icon: <Highlighter /> },
    { label: "Enable floating annotator", action: () => onUpdatePreferences({ annotatorTools: "floating" }), icon: <Highlighter /> },
    { label: "Enable top toolbar annotator", action: () => onUpdatePreferences({ annotatorTools: "top" }), icon: <Highlighter /> },
    { label: "Enable both annotator toolbars", action: () => onUpdatePreferences({ annotatorTools: "both" }), icon: <Highlighter /> },
    { label: "Disable annotator tools", action: () => onUpdatePreferences({ annotatorTools: "off" }), icon: <X /> },
    { label: "Add highlight", action: () => dispatchAnnotationCommand("highlight"), icon: <Highlighter />, disabled: !selectedEntry },
    { label: "Highlight selected text yellow", action: () => dispatchAnnotationCommand("highlight-yellow"), icon: <Highlighter />, disabled: !selectedEntry },
    { label: "Highlight selected text blue", action: () => dispatchAnnotationCommand("highlight-blue"), icon: <Highlighter />, disabled: !selectedEntry },
    { label: "Highlight selected text green", action: () => dispatchAnnotationCommand("highlight-green"), icon: <Highlighter />, disabled: !selectedEntry },
    { label: "Highlight selected text pink/purple", action: () => dispatchAnnotationCommand("highlight-pink"), icon: <Highlighter />, disabled: !selectedEntry },
    { label: "Add comment", action: () => dispatchAnnotationCommand("comment"), icon: <MessageSquare />, disabled: !selectedEntry },
    { label: "Add link", action: () => dispatchAnnotationCommand("link"), icon: <Link2 />, disabled: !selectedEntry },
    { label: "Add tag to selection", action: () => dispatchAnnotationCommand("tag"), icon: <Tags />, disabled: !selectedEntry },
    { label: "Add source marker", action: () => dispatchAnnotationCommand("source-marker"), icon: <ArrowUpRight />, disabled: selectedEntry?.kind !== "binder-note" },
    { label: "Remove annotation", action: () => dispatchAnnotationCommand("remove-highlight"), icon: <X />, disabled: !selectedEntry },
    { label: "Open annotations drawer", action: () => dispatchAnnotationCommand("open-drawer"), icon: <NotebookTabs />, disabled: !selectedEntry },
    { label: "Filter highlights: All colors", action: () => dispatchAnnotationCommand("filter-all"), icon: <ListFilter />, disabled: !selectedEntry },
    { label: "Filter highlights: Yellow", action: () => dispatchAnnotationCommand("filter-yellow"), icon: <ListFilter />, disabled: !selectedEntry },
    { label: "Filter highlights: Blue", action: () => dispatchAnnotationCommand("filter-blue"), icon: <ListFilter />, disabled: !selectedEntry },
    { label: "Filter highlights: Green", action: () => dispatchAnnotationCommand("filter-green"), icon: <ListFilter />, disabled: !selectedEntry },
    { label: "Filter highlights: Pink/Purple", action: () => dispatchAnnotationCommand("filter-pink"), icon: <ListFilter />, disabled: !selectedEntry },
    { label: "Open Templates", action: onOpenTemplates, icon: <FileText />, disabled: !personalStorageReady },
    { label: "Focus editor", action: onFocusEditor, icon: <Maximize2 />, disabled: !selectedEntry },
    { label: "Open recent note", action: onOpenRecent, icon: <ChevronRight />, disabled: entries.length === 0 },
    {
      label: "Open source binder workspace",
      action: onOpenSource,
      icon: <ArrowUpRight />,
      disabled: !selectedEntry?.quickJumpToBinderUrl,
    },
    {
      label: "Move to folder",
      action: onMoveToFolder,
      icon: <FolderPlus />,
      disabled: selectedEntry?.kind !== "personal-note",
    },
    {
      label: selectedEntry?.pinned ? "Unpin" : "Pin",
      action: onPin,
      icon: <Pin />,
      disabled: !selectedEntry || selectedEntry.kind === "binder-note",
    },
    {
      label: "Add tag",
      action: onAddTag,
      icon: <Tags />,
      disabled: !selectedEntry || selectedEntry.kind === "binder-note",
    },
    {
      label: "Copy note link",
      action: onCopyLink,
      icon: <ArrowUpRight />,
      disabled: !selectedEntry,
    },
  ];
  const visibleCommands = commands.filter((command) =>
    command.label.toLowerCase().includes(commandQuery.trim().toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/62 p-4 backdrop-blur" role="presentation">
      <div
        aria-label="Personal Notes command palette"
        className="mx-auto mt-16 max-w-2xl rounded-lg border border-border bg-popover p-3 shadow-2xl"
        role="dialog"
      >
        <div className="flex items-center gap-2 border-b border-border/70 pb-3">
          <Command className="size-4 text-muted-foreground" />
          <Input
            autoFocus
            aria-label="Command search"
            onChange={(event) => setCommandQuery(event.target.value)}
            placeholder="Search commands"
            value={commandQuery}
          />
          <Button aria-label="Close command palette" onClick={onClose} size="icon" type="button" variant="ghost">
            <X />
          </Button>
        </div>
        <div className="mt-3 grid gap-1">
          {visibleCommands.map((command) => (
            <button
              className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45"
              disabled={command.disabled}
              key={command.label}
              onClick={() => {
                command.action();
                onClose();
              }}
              type="button"
            >
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground [&_svg]:size-4">{command.icon}</span>
                {command.label}
              </span>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PersonalNotesSettingsDrawer({
  focusMode,
  onClose,
  onEnterFullscreenFocus,
  onToggleFocusMode,
  onToggleSidebars,
  onToggleTopChrome,
  onUpdate,
  preferences,
  sidebarsHidden,
  topChromeHidden,
}: {
  focusMode: boolean;
  onClose: () => void;
  onEnterFullscreenFocus: () => void;
  onToggleFocusMode: (enabled: boolean) => void;
  onToggleSidebars: (enabled: boolean) => void;
  onToggleTopChrome: (enabled: boolean) => void;
  onUpdate: (value: Partial<PersonalNotesPreferences>) => void;
  preferences: PersonalNotesPreferences;
  sidebarsHidden: boolean;
  topChromeHidden: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const sections = [
    {
      id: "appearance",
      label: "Appearance",
      terms: "appearance app style minimal studio editor width focused comfortable wide full",
    },
    {
      id: "layout",
      label: "Notebook",
      terms:
        "notebook layout hide panes sidebar notebook notes list folder folders binder binders hierarchy drill structured project tree file tree explorer codex vscode all notes linked loose quick notes unfiled back up history math chemistry quick access shortcuts recent home dashboard organize",
    },
    {
      id: "focus",
      label: "Editor state",
      terms: "focus fullscreen full screen hide ui hide menu chrome side panes default behavior",
    },
    {
      id: "editor",
      label: "Editor",
      terms:
        "editor autosave metadata annotate annotator annotation comment margin note highlight highlighter color color filter filter highlights underline source note citation floating toolbar selection toolbar link",
    },
    {
      id: "organization",
      label: "Organization",
      terms: "organization binder private notes tags backlinks review queue default new note location source workspace",
    },
    {
      id: "canvas",
      label: "Canvas notebooks",
      terms: "canvas notebook safe edge padding snap lazy tools mobile module switcher simplified",
    },
    {
      id: "keyboard",
      label: "Keyboard",
      terms: "keyboard command palette shortcut ctrl cmd k settings search",
    },
  ].filter((section) => `${section.label} ${section.terms}`.toLowerCase().includes(normalizedQuery));

  return (
    <div className="fixed inset-0 z-50 bg-background/80" role="presentation">
      <aside
        aria-label="Personal Notes settings"
        className="ml-auto flex h-full w-full max-w-[560px] flex-col border-l border-border bg-[#111722] shadow-2xl"
        role="dialog"
      >
        <div className="border-b border-border/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 rounded-xl bg-secondary/45 p-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-background font-bold">PN</div>
              <div className="min-w-0">
                <span className="page-kicker">Settings</span>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">Personal Notes settings</h2>
              </div>
            </div>
            <Button aria-label="Close Personal Notes settings" onClick={onClose} size="icon" type="button" variant="ghost">
              <X />
            </Button>
          </div>
          <label className="relative mt-4 block">
            <Settings2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search Personal Notes settings"
              className="h-10 bg-background pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search focus, fullscreen, annotate, sidebar"
              value={query}
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
          {sections.map((section) => (
            <section className="rounded-xl border border-border bg-card p-4" key={section.id}>
              <h3 className="text-base font-semibold">{section.label}</h3>

              {section.id === "appearance" ? (
                <div className="mt-3 grid gap-3">
                  <SettingSelect
                    label="App Appearance"
                    onChange={(value) => onUpdate({ style: value as "studio" | "minimal" })}
                    value={preferences.style}
                  >
                    <option value="minimal">Minimal</option>
                    <option value="studio">Studio</option>
                  </SettingSelect>
                  <SettingSelect
                    label="Editor width"
                    onChange={(value) => onUpdate({ editorWidth: value as PersonalNotesEditorWidth })}
                    value={preferences.editorWidth}
                  >
                    {editorWidthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SettingSelect>
                </div>
              ) : null}

              {section.id === "layout" ? (
                <div className="mt-3 grid gap-3">
                  <SettingSelect
                    label="Personal Notes organization"
                    onChange={(value) => onUpdate({ sidebarNavigationMode: value as PersonalNotesSidebarNavigationMode })}
                    value={preferences.sidebarNavigationMode}
                  >
                    <option value="structured">Structured Workspace</option>
                    <option value="loose">Loose Notes</option>
                  </SettingSelect>
                  <ToggleSetting
                    checked={preferences.showNotebookPane}
                    label="Show Notebook pane"
                    onChange={(checked) => onUpdate({ showNotebookPane: checked })}
                  />
                  <ToggleSetting
                    checked={preferences.showNotesListPane}
                    label="Show Notes list pane"
                    onChange={(checked) => onUpdate({ showNotesListPane: checked })}
                  />
                  <ToggleSetting
                    checked={preferences.showQuickAccess}
                    label="Show Quick Access"
                    onChange={(checked) => onUpdate({ showQuickAccess: checked })}
                  />
                  <ToggleSetting
                    checked={preferences.rememberNotebookContext}
                    label="Remember last selected scope and binder"
                    onChange={(checked) => onUpdate({ rememberNotebookContext: checked })}
                  />
                  <ToggleSetting
                    checked={preferences.showRecentNotesInScope}
                    label="Show recent notes in unselected scope"
                    onChange={(checked) => onUpdate({ showRecentNotesInScope: checked })}
                  />
                  <SettingSelect
                    label="Default Personal Notes view"
                    onChange={(value) => onUpdate({ defaultView: value as PersonalNotesViewMode })}
                    value={preferences.defaultView}
                  >
                    <option value="notes">Notes</option>
                    <option value="home">Home</option>
                    <option value="organize">Organize</option>
                  </SettingSelect>
                </div>
              ) : null}

              {section.id === "focus" ? (
                <div className="mt-3 grid gap-3">
                  <ToggleSetting checked={sidebarsHidden} label="Hide side panes" onChange={onToggleSidebars} />
                  <ToggleSetting checked={topChromeHidden} label="Hide top chrome" onChange={onToggleTopChrome} />
                  <ToggleSetting checked={focusMode} label="Focus mode" onChange={onToggleFocusMode} />
                  <ToggleSetting
                    checked={preferences.fullscreenFocusEnabled}
                    label="Enable fullscreen focus"
                    onChange={(checked) => onUpdate({ fullscreenFocusEnabled: checked })}
                  />
                  <SettingSelect
                    label="Default focus behavior"
                    onChange={(value) => onUpdate({ defaultFocusBehavior: value as "focus" | "fullscreen" })}
                    value={preferences.defaultFocusBehavior}
                  >
                    <option value="focus">Focus mode</option>
                    <option value="fullscreen">Fullscreen focus</option>
                  </SettingSelect>
                  <Button onClick={onEnterFullscreenFocus} size="sm" type="button" variant="outline">
                    <Maximize2 data-icon="inline-start" />
                    Fullscreen focus
                  </Button>
                </div>
              ) : null}

              {section.id === "editor" ? (
                <div className="mt-3 grid gap-3">
                  <ToggleSetting checked={preferences.autosave} label="Autosave" onChange={(checked) => onUpdate({ autosave: checked })} />
                  <ToggleSetting
                    checked={preferences.compactMetadata}
                    label="Compact metadata"
                    onChange={(checked) => onUpdate({ compactMetadata: checked })}
                  />
                  <ToggleSetting
                    checked={preferences.noteLinkAutocomplete}
                    label="Enable note link autocomplete"
                    onChange={(checked) => onUpdate({ noteLinkAutocomplete: checked })}
                  />
                  <AnnotatorModeControl
                    onChange={(value) => onUpdate({ annotatorTools: value })}
                    value={preferences.annotatorTools}
                  />
                  <ToggleSetting
                    checked={preferences.showAnnotationColorFilter}
                    label="Show highlight color filter"
                    onChange={(checked) => onUpdate({ showAnnotationColorFilter: checked })}
                  />
                </div>
              ) : null}

              {section.id === "organization" ? (
                <div className="mt-3 grid gap-3">
                  <ToggleSetting
                    checked={preferences.showBinderNotes}
                    label="Show binder private notes"
                    onChange={(checked) => onUpdate({ showBinderNotes: checked })}
                  />
                  <SettingSelect
                    label="Default new note location"
                    onChange={(value) => onUpdate({ defaultNewNoteLocation: value as typeof preferences.defaultNewNoteLocation })}
                    value={preferences.defaultNewNoteLocation}
                  >
                    <option value="loose">Loose</option>
                    <option value="last-binder">Last binder</option>
                    <option value="ask">Ask every time</option>
                  </SettingSelect>
                  <div className="rounded-xl border border-border/70 bg-background/45 p-3 text-sm leading-6 text-muted-foreground">
                    Tags, backlinks, templates, and Review Queue stay hidden until opened from the command palette or editor actions.
                  </div>
                </div>
              ) : null}

              {section.id === "canvas" ? (
                <div className="mt-3 grid gap-3">
                  <ToggleSetting
                    checked={preferences.canvasSafeEdgePadding}
                    label="Safe edge padding"
                    onChange={(checked) => onUpdate({ canvasSafeEdgePadding: checked })}
                  />
                  <ToggleSetting
                    checked={preferences.canvasToolsLazyLoad}
                    label="Lazy-load canvas tools"
                    onChange={(checked) => onUpdate({ canvasToolsLazyLoad: checked })}
                  />
                  <SettingSelect
                    label="Canvas snap mode"
                    onChange={(value) => onUpdate({ canvasSnapMode: value as typeof preferences.canvasSnapMode })}
                    value={preferences.canvasSnapMode}
                  >
                    <option value="edges">Edges</option>
                    <option value="modules">Modules</option>
                    <option value="off">Off</option>
                  </SettingSelect>
                  <SettingSelect
                    label="Mobile canvas behavior"
                    onChange={(value) => onUpdate({ mobileCanvasBehavior: value as typeof preferences.mobileCanvasBehavior })}
                    value={preferences.mobileCanvasBehavior}
                  >
                    <option value="module-switcher">Module switcher</option>
                    <option value="simplified">Simplified</option>
                  </SettingSelect>
                </div>
              ) : null}

              {section.id === "keyboard" ? (
                <div className="mt-3 rounded-xl border border-border/70 bg-background/45 p-3 text-sm leading-6 text-muted-foreground">
                  Ctrl/Cmd+K opens the command palette for search, notes, panes, focus, annotator tools, and settings.
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

function SettingSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <select
        aria-label={label}
        className="appearance-select h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

const annotatorModeOptions: Array<{ label: string; shortLabel: string; value: PersonalNotesAnnotatorMode }> = [
  { label: "Off", shortLabel: "Off", value: "off" },
  { label: "Floating selection only", shortLabel: "Floating", value: "floating" },
  { label: "Top toolbar only", shortLabel: "Top", value: "top" },
  { label: "Both", shortLabel: "Both", value: "both" },
];

function AnnotatorModeControl({
  onChange,
  value,
}: {
  onChange: (value: PersonalNotesAnnotatorMode) => void;
  value: PersonalNotesAnnotatorMode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-muted-foreground">Annotator tools</span>
        <Badge variant="outline">{annotatorModeOptions.find((option) => option.value === value)?.shortLabel ?? "Floating"}</Badge>
      </div>
      <div
        aria-label="Annotator tools"
        className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/55 p-1 sm:grid-cols-4"
        role="radiogroup"
      >
        {annotatorModeOptions.map((option) => (
          <button
            aria-checked={value === option.value}
            aria-label={option.label}
            className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
              value === option.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
            }`}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            type="button"
          >
            {option.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleSetting({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/55 px-3 py-3 text-sm font-semibold">
      <span>{label}</span>
      <input
        checked={checked}
        className="size-4 shrink-0 accent-primary"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function CanvasModuleShell({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[var(--workspace-radius,18px)] border border-border/75 bg-card/94 shadow-sm backdrop-blur">
      <div className="border-b border-border/70 px-4 pb-3 pt-10">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </section>
  );
}

function renderCanvasModule(input: {
  children: ReactNode;
  entries: PersonalNotesEntry[];
  moduleId: WorkspaceModuleId;
  onCreateDocument: () => void;
  onCreateNote: () => void;
  onSelectEntry: (entry: PersonalNotesEntry) => void;
  reviewQueue: PersonalNotesEntry[];
  selectedEntry: PersonalNotesEntry | null;
}) {
  switch (input.moduleId) {
    case "private-notes":
      return input.children;
    case "binder-notebook":
      return (
        <NoteList
          compact
          entries={input.entries}
          onSelectEntry={input.onSelectEntry}
          selectedEntry={input.selectedEntry}
        />
      );
    case "tasks":
      return <ReviewQueue entries={input.reviewQueue} onSelectEntry={input.onSelectEntry} />;
    case "search":
      return (
        <div className="grid gap-3">
          <Button onClick={input.onCreateNote} type="button">
            <FilePlus2 data-icon="inline-start" />
            New note
          </Button>
          <Button onClick={input.onCreateDocument} type="button" variant="outline">
            <FileText data-icon="inline-start" />
            New document
          </Button>
          <p className="text-sm leading-6 text-muted-foreground">
            Search and filters above apply to every Personal Notes view.
          </p>
        </div>
      );
    case "formula-sheet":
      return (
        <div className="grid gap-2">
          {personalNoteTemplates.slice(0, 6).map((template) => (
            <div className="rounded-lg border border-border/70 bg-background/78 p-3" key={template.id}>
              <p className="text-sm font-semibold">{template.name}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{template.description}</p>
            </div>
          ))}
        </div>
      );
    case "whiteboard":
      return (
        <div className="grid h-full place-items-center rounded-lg border border-dashed border-border/80 bg-background/78 p-4 text-center">
          <div>
            <Layers3 className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">Canvas tool space</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Add writing panels, quick cards, checklists, math blocks, and source links without needing premade study content.
            </p>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function canvasTitleForModule(moduleId: WorkspaceModuleId) {
  switch (moduleId) {
    case "private-notes":
      return "Writing panel";
    case "binder-notebook":
      return "Notebook modules";
    case "tasks":
      return "Review Queue";
    case "search":
      return "Quick actions";
    case "formula-sheet":
      return "Templates and math";
    case "whiteboard":
      return "Canvas tools";
    default:
      return "Module";
  }
}

function buildFolderSummaries(entries: PersonalNotesEntry[]) {
  const map = new Map<string, { name: string; count: number; color: string }>();
  entries.forEach((entry) => {
    const existing = map.get(entry.folderName);
    map.set(entry.folderName, {
      name: entry.folderName,
      count: (existing?.count ?? 0) + 1,
      color: folderColor(entry.folderColor),
    });
  });
  return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function buildNotebookCategories(entries: PersonalNotesEntry[], showBinderNotes: boolean): NotebookCategory[] {
  const visible = showBinderNotes ? entries : entries.filter((entry) => entry.kind !== "binder-note");
  const folderCount = (label: string) => visible.filter((entry) => entry.folderName === label).length;
  const looseCount = visible.filter((entry) => entry.kind === "personal-note").length;
  const linkedCount = visible.filter((entry) => entry.kind === "binder-note").length;

  const categories: NotebookCategory[] = [
    { id: "all", label: "All notes", count: visible.length, color: "hsl(var(--primary))", sourceFilter: "all", folderName: null },
    { id: "history", label: "History", count: folderCount("History"), color: "#14b8a6", sourceFilter: "all", folderName: "History" },
    { id: "math", label: "Math", count: folderCount("Math"), color: "#3b82f6", sourceFilter: "all", folderName: "Math" },
    { id: "chemistry", label: "Chemistry", count: folderCount("Chemistry"), color: "#22c55e", sourceFilter: "all", folderName: "Chemistry" },
    { id: "other", label: "Other", count: folderCount("Other"), color: "#a855f7", sourceFilter: "all", folderName: "Other" },
    { id: "unfiled", label: "Unfiled", count: folderCount("Unfiled"), color: "#94a3b8", sourceFilter: "all", folderName: "Unfiled" },
    { id: "loose", label: "Loose notes", count: looseCount, color: "#f59e0b", sourceFilter: "loose", folderName: null },
  ];

  if (showBinderNotes) {
    categories.push({
      id: "binder-linked",
      label: "Binder-linked",
      count: linkedCount,
      color: "#60a5fa",
      sourceFilter: "binder-linked",
      folderName: null,
    });
  }

  return categories;
}

function resolveSelectedCategoryId(
  categories: NotebookCategory[],
  sourceFilter: PersonalNotesSourceFilter,
  folderFilter: string | null,
) {
  return (
    categories.find((category) =>
      category.sourceFilter === sourceFilter && (category.folderName ?? null) === (folderFilter ?? null),
    )?.id ?? "all"
  );
}

function entriesForNotebookCategory(entries: PersonalNotesEntry[], category: NotebookCategory) {
  if (category.id === "all") {
    return entries;
  }
  if (category.sourceFilter === "binder-linked") {
    return entries.filter((entry) => entry.kind === "binder-note");
  }
  if (category.sourceFilter === "loose") {
    return entries.filter((entry) => entry.kind === "personal-note");
  }
  if (category.folderName) {
    return entries.filter((entry) => entry.folderName === category.folderName);
  }
  return [];
}

function buildNotebookHierarchy(entries: PersonalNotesEntry[], categories: NotebookCategory[]): NotebookHierarchy {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const bindersByScope = new Map<string, Map<string, NotebookBinderNode>>();

  const addBinderEntry = (
    scopeId: string,
    groupId: string,
    entry: PersonalNotesEntry,
    title: string,
    kind: NotebookBinderNode["kind"],
  ) => {
    const scope = categoriesById.get(scopeId) ?? categoriesById.get("all");
    const scopedId = `${scopeId}:${groupId}`;
    const scopeBinders = bindersByScope.get(scopeId) ?? new Map<string, NotebookBinderNode>();
    const existing = scopeBinders.get(scopedId);
    if (existing) {
      if (!existing.entries.some((candidate) => candidate.kind === entry.kind && candidate.id === entry.id)) {
        existing.entries.push(entry);
        existing.count = existing.entries.length;
      }
      return;
    }

    scopeBinders.set(scopedId, {
      id: scopedId,
      groupId,
      title,
      count: 1,
      entries: [entry],
      scopeId,
      scopeLabel: scope?.label ?? notebookScopeLabel(scopeId),
      sourceUrl: entry.quickJumpToBinderUrl,
      kind,
    });
    bindersByScope.set(scopeId, scopeBinders);
  };

  entries.forEach((entry) => {
    const binderGroup = notebookBinderGroupForEntry(entry);
    if (!binderGroup) {
      return;
    }
    const scopeId = notebookScopeIdForEntry(entry);
    addBinderEntry("all", binderGroup.id, entry, binderGroup.title, binderGroup.kind);
    addBinderEntry(scopeId, binderGroup.id, entry, binderGroup.title, binderGroup.kind);
    if (entry.kind === "binder-note") {
      addBinderEntry("binder-linked", binderGroup.id, entry, binderGroup.title, binderGroup.kind);
    }
  });

  const normalizedByScope: Record<string, NotebookBinderNode[]> = {};
  const bindersById = new Map<string, NotebookBinderNode>();
  categories.forEach((category) => {
    const sorted = Array.from(bindersByScope.get(category.id)?.values() ?? []).sort((left, right) =>
      left.title.localeCompare(right.title),
    );
    normalizedByScope[category.id] = sorted;
    sorted.forEach((binder) => bindersById.set(binder.id, binder));
  });

  return { bindersById, bindersByScope: normalizedByScope };
}

function notebookBinderGroupForEntry(entry: PersonalNotesEntry):
  | { id: string; title: string; kind: NotebookBinderNode["kind"] }
  | null {
  if (entry.kind === "binder-note") {
    const id = entry.sourceBinderId ?? entry.sourceBinderTitle ?? "unknown-source-binder";
    return {
      id: `source:${id}`,
      title: entry.sourceBinderTitle ?? "Source binder",
      kind: "source-binder",
    };
  }
  if (entry.kind === "personal-document" || entry.personalBinderId) {
    const id = entry.personalBinderId ?? entry.sourceBinderId ?? entry.id;
    return {
      id: `personal:${id}`,
      title: entry.personalBinderTitle ?? entry.sourceBinderTitle ?? "Personal binder",
      kind: "personal-binder",
    };
  }
  return null;
}

function notebookScopeIdForEntry(entry: PersonalNotesEntry) {
  const folderName = entry.folderName.trim().toLowerCase();
  if (folderName === "math") {
    return "math";
  }
  if (folderName === "history") {
    return "history";
  }
  if (folderName === "chemistry") {
    return "chemistry";
  }
  if (folderName === "unfiled" || !folderName) {
    return "unfiled";
  }
  return "other";
}

function structuredScopeIdForEntry(entry: PersonalNotesEntry) {
  if (entry.kind === "personal-note" && !entry.personalBinderId) {
    return "loose";
  }
  return notebookScopeIdForEntry(entry);
}

function notebookScopeLabel(scopeId: string) {
  switch (scopeId) {
    case "all":
      return "All notes";
    case "history":
      return "History";
    case "math":
      return "Math";
    case "chemistry":
      return "Chemistry";
    case "other":
      return "Other";
    case "unfiled":
      return "Unfiled";
    case "loose":
      return "Loose notes";
    case "binder-linked":
      return "Binder-linked";
    default:
      return "Notebook";
  }
}

function buildTagSummaries(entries: PersonalNotesEntry[]) {
  const map = new Map<string, number>();
  entries.forEach((entry) => {
    entry.tags.forEach((tag) => map.set(tag, (map.get(tag) ?? 0) + 1));
  });
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function parseTags(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function folderColor(color: string) {
  switch (color) {
    case "violet":
      return "rgb(124 58 237)";
    case "rose":
      return "rgb(225 29 72)";
    case "blue":
      return "rgb(37 99 235)";
    case "emerald":
      return "rgb(5 150 105)";
    case "slate":
      return "rgb(100 116 139)";
    default:
      return "rgb(13 148 136)";
  }
}

function canvasFramesStorageKey(profileId: string | undefined) {
  return `binder-notes:personal-notes:${profileId ?? "anonymous"}:canvas:v1`;
}

function loadCanvasFrames(profileId: string | undefined) {
  if (typeof window === "undefined") {
    return defaultCanvasFrames;
  }

  try {
    const raw = window.localStorage.getItem(canvasFramesStorageKey(profileId));
    if (!raw) {
      return defaultCanvasFrames;
    }
    return {
      ...defaultCanvasFrames,
      ...(JSON.parse(raw) as Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>),
    };
  } catch {
    return defaultCanvasFrames;
  }
}

function saveCanvasFrames(
  profileId: string | undefined,
  frames: Record<WorkspaceModuleId, WorkspaceWindowFrame>,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(canvasFramesStorageKey(profileId), JSON.stringify(frames));
}
