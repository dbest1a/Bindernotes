import type {
  Binder,
  BinderLesson,
  Folder,
  LearnerNote,
  PersonalNote,
  PersonalNoteFolder,
  PersonalNotebookBinder,
  PersonalNotebookDocument,
  PersonalNotesAnnotatorMode,
  PersonalNotesDefaultLocation,
  PersonalNotesEditorWidth,
  PersonalNotesEntry,
  PersonalNotesPreferences,
  PersonalNotesSourceFilter,
  PersonalNotesViewMode,
  PersonalNotesVisualStyle,
} from "@/types";
import { deriveBinderTitle, deriveLessonTitle, extractPlainText, getWorkspaceContainerFolder, getWorkspaceFolderIdForBinder } from "@/lib/workspace-records";
import { emptyDoc } from "@/lib/utils";

const UNFILED_FOLDER = {
  id: null,
  name: "Unfiled",
  color: "slate",
};

export type PersonalNoteTemplate = {
  id: string;
  name: string;
  description: string;
  content: ReturnType<typeof emptyDoc>;
  tags?: string[];
};

export type PersonalNoteHealthSignal = {
  id: string;
  label: string;
  tone: "neutral" | "good" | "warning";
};

export type PersonalNotesFilterOptions = {
  query: string;
  sourceFilter: PersonalNotesSourceFilter;
  showBinderNotes: boolean;
  folderName?: string | null;
  tag?: string | null;
};

export const personalNoteTemplates: PersonalNoteTemplate[] = [
  template("blank", "Blank note", "A clean page for quick thinking.", ""),
  template("class-notes", "Class notes", "Topic, examples, questions, and next steps.", "Topic\n\nKey ideas\n\nExamples\n\nQuestions"),
  template("math-notes", "Math notes", "Definitions, worked steps, and checks.", "Definition\n\nWorked example\n\nCommon mistake\n\nCheck"),
  template("formula-sheet", "Formula sheet", "Formula, variables, when to use it, and a sample.", "Formula\n\nVariables\n\nUse when\n\nExample", ["math"]),
  template("proof-outline", "Proof outline", "Claim, givens, strategy, and proof steps.", "Claim\n\nGiven\n\nStrategy\n\nSteps"),
  template("problem-solving-log", "Problem-solving log", "Problem, setup, attempts, and reflection.", "Problem\n\nSetup\n\nAttempts\n\nReflection"),
  template("history-evidence", "History evidence note", "Claim, evidence, source context, and reliability.", "Claim\n\nEvidence\n\nSource context\n\nReliability", ["history"]),
  template("essay-argument", "Essay argument plan", "Thesis, reasons, evidence, and counterpoint.", "Thesis\n\nReason 1\n\nReason 2\n\nCounterpoint"),
  template("reading-summary", "Reading summary", "Main idea, supporting points, and questions.", "Main idea\n\nSupporting points\n\nQuestions"),
  template("research-note", "Research note", "Question, source, useful details, and follow-up.", "Question\n\nSource\n\nUseful details\n\nFollow-up", ["research"]),
  template("review-checklist", "Review checklist", "Items to revisit before a quiz, paper, or study session.", "Review later\n\n- Key idea\n- Example\n- Question", ["review-later"]),
  template("class-recap", "Meeting/class recap", "People, decisions, questions, and next actions.", "Context\n\nWhat changed\n\nQuestions\n\nNext actions"),
  template("flashcard-seed", "Flashcard seed note", "Seed facts, terms, and prompts for later review.", "Terms\n\nPrompts\n\nAnswers\n\nReview later", ["review-later"]),
];

export const defaultPersonalNotesPreferences: PersonalNotesPreferences = {
  defaultView: "notes",
  style: "minimal",
  showBinderNotes: true,
  defaultNewNoteLocation: "loose",
  editorWidth: "wide",
  autosave: true,
  compactModuleHeaders: false,
  compactMetadata: true,
  maximizeModuleSpace: false,
  showReviewQueue: false,
  showQuickAccess: true,
  showNotebookPane: true,
  showNotesListPane: true,
  organizeCardOrder: [],
  sidebarNavigationMode: "structured",
  rememberNotebookContext: true,
  showRecentNotesInScope: true,
  fullscreenFocusEnabled: true,
  defaultFocusBehavior: "focus",
  annotatorTools: "floating",
  showAnnotationColorFilter: true,
  noteLinkAutocomplete: true,
  canvasToolsLazyLoad: true,
  canvasSafeEdgePadding: true,
  canvasSnapMode: "edges",
  mobileCanvasBehavior: "module-switcher",
  focusMode: false,
};

export const personalNotesPreferencesUpdatedEvent = "bindernotes:personal-notes-preferences-updated";

export function buildPersonalNotesEntries(input: {
  learnerNotes: LearnerNote[];
  personalNotes: PersonalNote[];
  personalDocuments: PersonalNotebookDocument[];
  personalBinders: PersonalNotebookBinder[];
  binders: Binder[];
  lessons: BinderLesson[];
  folders: Array<Folder | PersonalNoteFolder>;
}): PersonalNotesEntry[] {
  const bindersById = new Map(input.binders.map((binder) => [binder.id, binder]));
  const lessonsById = new Map(input.lessons.map((lesson) => [lesson.id, lesson]));
  const personalBindersById = new Map(input.personalBinders.map((binder) => [binder.id, binder]));
  const foldersById = new Map(input.folders.map((folder) => [folder.id, folder]));
  const lessonsByBinderId = input.lessons.reduce<Record<string, BinderLesson[]>>((entries, lesson) => {
    entries[lesson.binder_id] = [...(entries[lesson.binder_id] ?? []), lesson];
    return entries;
  }, {});

  const binderLinked = input.learnerNotes.map((note): PersonalNotesEntry => {
    const binder = bindersById.get(note.binder_id) ?? null;
    const lesson = lessonsById.get(note.lesson_id) ?? null;
    const explicitFolder = note.folder_id ? foldersById.get(note.folder_id) ?? null : null;
    const derivedFolder = binder ? getWorkspaceContainerFolder(getWorkspaceFolderIdForBinder(binder), note.owner_id) : null;
    const folder = explicitFolder ?? derivedFolder ?? UNFILED_FOLDER;
    const binderTitle = binder
      ? deriveBinderTitle(binder, lessonsByBinderId[binder.id] ?? [])
      : "Source binder";
    const documentTitle = lesson ? deriveLessonTitle(lesson) : "Source document";
    const excerpt = buildExcerpt(note.content);
    const tags = note.math_blocks.length > 0 ? ["math"] : [];

    return {
      kind: "binder-note",
      id: note.id,
      title: note.title || documentTitle,
      content: note.content,
      excerpt,
      searchText: buildSearchText([
        note.title,
        excerpt,
        binderTitle,
        documentTitle,
        folder.name,
        tags.join(" "),
        "binder private linked",
      ]),
      updated_at: note.updated_at,
      pinned: note.pinned,
      folderId: folder.id,
      folderName: folder.name,
      folderColor: folder.color,
      tags,
      math_blocks: note.math_blocks,
      sourceType: "Binder private note",
      sourceBinderId: note.binder_id,
      sourceBinderTitle: binderTitle,
      sourceDocumentId: note.lesson_id,
      sourceDocumentTitle: documentTitle,
      personalBinderId: null,
      personalBinderTitle: null,
      quickOpenUrl: `/notes/n/${note.id}`,
      quickJumpToBinderUrl: `/binders/${note.binder_id}/documents/${note.lesson_id}`,
      note,
      reviewLater: false,
    };
  });

  const looseNotes = input.personalNotes
    .filter((note) => !note.archived_at)
    .map((note): PersonalNotesEntry => {
      const notebookBinder = note.binder_id ? personalBindersById.get(note.binder_id) ?? null : null;
      const folder = resolvePersonalFolder(note.folder_id, notebookBinder, foldersById);
      const excerpt = buildExcerpt(note.content);

      return {
        kind: "personal-note",
        id: note.id,
        title: note.title || "Untitled note",
        content: note.content,
        excerpt,
        searchText: buildSearchText([
          note.title,
          excerpt,
          folder.name,
          notebookBinder?.title,
          note.tags.join(" "),
          note.pinned ? "pinned" : "",
          "loose note main personal",
        ]),
        updated_at: note.updated_at,
        pinned: note.pinned,
        folderId: folder.id,
        folderName: folder.name,
        folderColor: folder.color,
        tags: note.tags,
        math_blocks: note.math_blocks,
        sourceType: "Loose note",
        sourceBinderId: null,
        sourceBinderTitle: null,
        sourceDocumentId: null,
        sourceDocumentTitle: null,
        personalBinderId: notebookBinder?.id ?? null,
        personalBinderTitle: notebookBinder?.title ?? null,
        quickOpenUrl: `/notes/n/${note.id}`,
        quickJumpToBinderUrl: null,
        note,
        reviewLater: note.tags.some(isReviewLaterTag),
      };
    });

  const notebookDocuments = input.personalDocuments
    .filter((document) => !document.archived_at)
    .map((document): PersonalNotesEntry => {
      const notebookBinder = personalBindersById.get(document.binder_id) ?? null;
      const folder = resolvePersonalFolder(null, notebookBinder, foldersById);
      const excerpt = buildExcerpt(document.content);

      return {
        kind: "personal-document",
        id: document.id,
        title: document.title || "Untitled document",
        content: document.content,
        excerpt,
        searchText: buildSearchText([
          document.title,
          excerpt,
          folder.name,
          notebookBinder?.title,
          document.tags.join(" "),
          document.pinned ? "pinned" : "",
          "notebook document personal binder",
        ]),
        updated_at: document.updated_at,
        pinned: document.pinned,
        folderId: folder.id,
        folderName: folder.name,
        folderColor: folder.color,
        tags: document.tags,
        math_blocks: document.math_blocks,
        sourceType: "Notebook document",
        sourceBinderId: null,
        sourceBinderTitle: null,
        sourceDocumentId: null,
        sourceDocumentTitle: null,
        personalBinderId: document.binder_id,
        personalBinderTitle: notebookBinder?.title ?? "Personal binder",
        quickOpenUrl: `/notes/binders/${document.binder_id}/documents/${document.id}`,
        quickJumpToBinderUrl: null,
        note: document,
        reviewLater: document.tags.some(isReviewLaterTag),
      };
    });

  return [...binderLinked, ...looseNotes, ...notebookDocuments].sort(sortPersonalEntries);
}

export function filterPersonalNotesEntries(
  entries: PersonalNotesEntry[],
  options: PersonalNotesFilterOptions,
) {
  const query = normalize(options.query);
  const folderName = normalize(options.folderName ?? "");
  const tag = normalize(options.tag ?? "");

  return entries.filter((entry) => {
    if (!options.showBinderNotes && entry.kind === "binder-note") {
      return false;
    }

    if (!matchesSourceFilter(entry, options.sourceFilter)) {
      return false;
    }

    if (folderName && normalize(entry.folderName) !== folderName) {
      return false;
    }

    if (tag && !entry.tags.some((candidate) => normalize(candidate) === tag)) {
      return false;
    }

    if (!query) {
      return true;
    }

    return entry.searchText.includes(query);
  });
}

export function getPersonalNoteHealth(
  entry: PersonalNotesEntry,
  options: { unsaved?: boolean } = {},
): PersonalNoteHealthSignal[] {
  const signals: PersonalNoteHealthSignal[] = [];
  const hasContent = extractPlainText(entry.content).length > 0 || entry.math_blocks.length > 0;

  if (!entry.title.trim() || entry.title.toLowerCase().startsWith("untitled")) {
    signals.push({ id: "needs-title", label: "Needs title", tone: "warning" });
  }

  if (!hasContent) {
    signals.push({ id: "empty-note", label: "Empty note", tone: "warning" });
  }

  if (entry.pinned) {
    signals.push({ id: "pinned", label: "Pinned", tone: "good" });
  }

  if (entry.math_blocks.length > 0) {
    signals.push({ id: "math", label: "Has math blocks", tone: "good" });
  }

  if (entry.kind === "binder-note") {
    signals.push({ id: "linked-binder", label: "Linked binder", tone: "good" });
  }

  if (entry.folderName === UNFILED_FOLDER.name) {
    signals.push({ id: "unfiled", label: entry.kind === "personal-note" ? "Orphaned loose note" : "No folder/binder", tone: "neutral" });
  }

  if (entry.reviewLater) {
    signals.push({ id: "review-later", label: "Review later", tone: "neutral" });
  }

  if (options.unsaved) {
    signals.push({ id: "unsaved", label: "Unsaved changes", tone: "warning" });
  }

  signals.push({ id: "saved-at", label: `Last saved ${formatRelativeDate(entry.updated_at)}`, tone: "neutral" });
  return signals;
}

export function getPersonalNoteReviewQueue(entries: PersonalNotesEntry[]) {
  return entries
    .filter((entry) => {
      return (
        entry.pinned ||
        entry.reviewLater ||
        entry.math_blocks.length > 0 ||
        (entry.kind === "binder-note" && Date.now() - Date.parse(entry.updated_at) < 1000 * 60 * 60 * 24 * 7)
      );
    })
    .sort(sortPersonalEntries)
    .slice(0, 12);
}

export function loadPersonalNotesPreferences(userId: string | undefined | null): PersonalNotesPreferences {
  if (typeof window === "undefined" || !userId) {
    return defaultPersonalNotesPreferences;
  }

  try {
    const raw = window.localStorage.getItem(preferencesStorageKey(userId));
    if (!raw) {
      return defaultPersonalNotesPreferences;
    }
    return normalizePersonalNotesPreferences(JSON.parse(raw) as Partial<PersonalNotesPreferences>);
  } catch {
    return defaultPersonalNotesPreferences;
  }
}

export function savePersonalNotesPreferences(
  userId: string | undefined | null,
  preferences: PersonalNotesPreferences,
) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  const normalized = normalizePersonalNotesPreferences(preferences);
  window.localStorage.setItem(
    preferencesStorageKey(userId),
    JSON.stringify(normalized),
  );
  window.queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(personalNotesPreferencesUpdatedEvent, {
      detail: {
        preferences: normalized,
        userId,
      },
    }));
  });
}

export function normalizePersonalNotesPreferences(
  value: Partial<PersonalNotesPreferences> | null | undefined,
): PersonalNotesPreferences {
  return {
    defaultView: normalizeViewMode(value?.defaultView),
    style: normalizeVisualStyle(value?.style),
    showBinderNotes:
      typeof value?.showBinderNotes === "boolean"
        ? value.showBinderNotes
        : defaultPersonalNotesPreferences.showBinderNotes,
    defaultNewNoteLocation: normalizeDefaultLocation(value?.defaultNewNoteLocation),
    editorWidth: normalizeEditorWidth(value?.editorWidth),
    autosave: typeof value?.autosave === "boolean" ? value.autosave : true,
    compactModuleHeaders: Boolean(value?.compactModuleHeaders),
    compactMetadata:
      typeof value?.compactMetadata === "boolean"
        ? value.compactMetadata
        : defaultPersonalNotesPreferences.compactMetadata,
    maximizeModuleSpace: Boolean(value?.maximizeModuleSpace),
    showReviewQueue:
      typeof value?.showReviewQueue === "boolean"
        ? value.showReviewQueue
        : defaultPersonalNotesPreferences.showReviewQueue,
    showQuickAccess:
      typeof value?.showQuickAccess === "boolean"
        ? value.showQuickAccess
        : defaultPersonalNotesPreferences.showQuickAccess,
    showNotebookPane:
      typeof value?.showNotebookPane === "boolean"
        ? value.showNotebookPane
        : defaultPersonalNotesPreferences.showNotebookPane,
    showNotesListPane:
      typeof value?.showNotesListPane === "boolean"
        ? value.showNotesListPane
        : defaultPersonalNotesPreferences.showNotesListPane,
    organizeCardOrder:
      Array.isArray(value?.organizeCardOrder)
        ? value.organizeCardOrder.filter((id): id is string => typeof id === "string")
        : defaultPersonalNotesPreferences.organizeCardOrder,
    sidebarNavigationMode: normalizeSidebarNavigationMode(value?.sidebarNavigationMode),
    rememberNotebookContext:
      typeof value?.rememberNotebookContext === "boolean"
        ? value.rememberNotebookContext
        : defaultPersonalNotesPreferences.rememberNotebookContext,
    showRecentNotesInScope:
      typeof value?.showRecentNotesInScope === "boolean"
        ? value.showRecentNotesInScope
        : defaultPersonalNotesPreferences.showRecentNotesInScope,
    fullscreenFocusEnabled:
      typeof value?.fullscreenFocusEnabled === "boolean"
        ? value.fullscreenFocusEnabled
        : defaultPersonalNotesPreferences.fullscreenFocusEnabled,
    defaultFocusBehavior:
      value?.defaultFocusBehavior === "fullscreen" ? "fullscreen" : "focus",
    annotatorTools: normalizeAnnotatorTools(value?.annotatorTools),
    showAnnotationColorFilter:
      typeof value?.showAnnotationColorFilter === "boolean"
        ? value.showAnnotationColorFilter
        : defaultPersonalNotesPreferences.showAnnotationColorFilter,
    noteLinkAutocomplete:
      typeof value?.noteLinkAutocomplete === "boolean"
        ? value.noteLinkAutocomplete
        : defaultPersonalNotesPreferences.noteLinkAutocomplete,
    canvasToolsLazyLoad:
      typeof value?.canvasToolsLazyLoad === "boolean"
        ? value.canvasToolsLazyLoad
        : defaultPersonalNotesPreferences.canvasToolsLazyLoad,
    canvasSafeEdgePadding:
      typeof value?.canvasSafeEdgePadding === "boolean" ? value.canvasSafeEdgePadding : true,
    canvasSnapMode:
      value?.canvasSnapMode === "off" || value?.canvasSnapMode === "modules"
        ? value.canvasSnapMode
        : "edges",
    mobileCanvasBehavior:
      value?.mobileCanvasBehavior === "simplified" ? "simplified" : "module-switcher",
    focusMode: Boolean(value?.focusMode),
  };
}

function normalizeSidebarNavigationMode(value: unknown): PersonalNotesPreferences["sidebarNavigationMode"] {
  if (value === "loose" || value === "drill-in") {
    return "loose";
  }
  if (value === "structured" || value === "expanded") {
    return "structured";
  }
  return defaultPersonalNotesPreferences.sidebarNavigationMode;
}

export function buildEmptyPersonalNote(title = "") {
  return emptyDoc(title);
}

function matchesSourceFilter(entry: PersonalNotesEntry, sourceFilter: PersonalNotesSourceFilter) {
  switch (sourceFilter) {
    case "main":
      return entry.kind !== "binder-note";
    case "binder-linked":
      return entry.kind === "binder-note";
    case "personal-binders":
      return entry.kind === "personal-document";
    case "loose":
      return entry.kind === "personal-note";
    case "all":
    default:
      return true;
  }
}

function resolvePersonalFolder(
  explicitFolderId: string | null,
  notebookBinder: PersonalNotebookBinder | null,
  foldersById: Map<string, Folder | PersonalNoteFolder>,
) {
  const folder = explicitFolderId
    ? foldersById.get(explicitFolderId)
    : notebookBinder?.folder_id
      ? foldersById.get(notebookBinder.folder_id)
      : null;
  return folder ?? UNFILED_FOLDER;
}

function sortPersonalEntries(left: PersonalNotesEntry, right: PersonalNotesEntry) {
  if (left.pinned !== right.pinned) {
    return Number(right.pinned) - Number(left.pinned);
  }

  const dateDelta = Date.parse(right.updated_at) - Date.parse(left.updated_at);
  if (dateDelta !== 0) {
    return dateDelta;
  }

  return kindSortWeight(left.kind) - kindSortWeight(right.kind);
}

function kindSortWeight(kind: PersonalNotesEntry["kind"]) {
  switch (kind) {
    case "personal-document":
      return 0;
    case "personal-note":
      return 1;
    case "binder-note":
      return 2;
  }
}

function buildExcerpt(content: unknown) {
  const text = extractPlainText(content as Parameters<typeof extractPlainText>[0]);
  return text ? text.slice(0, 220) : "No note text yet.";
}

function buildSearchText(parts: Array<string | undefined | null>) {
  return normalize(parts.filter(Boolean).join(" "));
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isReviewLaterTag(tag: string) {
  return normalize(tag) === "review-later" || normalize(tag) === "review later";
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function template(
  id: string,
  name: string,
  description: string,
  body: string,
  tags: string[] = [],
): PersonalNoteTemplate {
  return {
    id,
    name,
    description,
    content: emptyDoc(body),
    tags,
  };
}

function normalizeViewMode(value: unknown): PersonalNotesViewMode {
  if (value === "home" || value === "organize" || value === "notes") {
    return value;
  }
  if (value === "normal") {
    return "organize";
  }
  if (value === "canvas" || value === "minimal") {
    return "notes";
  }
  return "notes";
}

function normalizeVisualStyle(value: unknown): PersonalNotesVisualStyle {
  return value === "studio" ? "studio" : "minimal";
}

function normalizeDefaultLocation(value: unknown): PersonalNotesDefaultLocation {
  return value === "last-binder" || value === "ask" ? value : "loose";
}

function normalizeEditorWidth(value: unknown): PersonalNotesEditorWidth {
  return value === "focused" || value === "comfortable" || value === "full" ? value : "wide";
}

function normalizeAnnotatorTools(value: unknown): PersonalNotesAnnotatorMode {
  return value === "off" || value === "top" || value === "both" ? value : "floating";
}

function preferencesStorageKey(userId: string) {
  return `binder-notes:personal-notes:${userId}:preferences:v1`;
}
