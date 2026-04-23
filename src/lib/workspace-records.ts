import type { JSONContent } from "@tiptap/react";
import type {
  Binder,
  BinderLesson,
  Folder,
  FolderBinderLink,
  Highlight,
  LearnerNote,
  WorkspaceDiagnostic,
} from "@/types";

const PLACEHOLDER_TITLES = new Set([
  "untitled",
  "untitled binder",
  "untitled lesson",
  "untitled document",
  "new binder",
  "new lesson",
  "new document",
]);

const PLACEHOLDER_BINDER_DESCRIPTIONS = new Set([
  "",
  "write a clear promise for this binder.",
]);

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function isPlaceholderTitle(value: string | null | undefined) {
  const normalized = normalizeText(value).toLowerCase();
  return (
    !normalized ||
    PLACEHOLDER_TITLES.has(normalized) ||
    (normalized.startsWith("untitled ") &&
      ["binder", "lesson", "document", "folder", "workspace"].some((token) => normalized.includes(token))) ||
    (normalized.startsWith("new ") &&
      ["binder", "lesson", "document", "folder", "workspace"].some((token) => normalized.includes(token))) ||
    normalized.startsWith("binder draft") ||
    normalized.startsWith("lesson draft")
  );
}

export function extractPlainText(content: JSONContent | JSONContent[] | null | undefined): string {
  if (!content) {
    return "";
  }

  if (Array.isArray(content)) {
    return content.map((node) => extractPlainText(node)).join(" ").replace(/\s+/g, " ").trim();
  }

  const direct = typeof content.text === "string" ? content.text : "";
  const nested = Array.isArray(content.content) ? extractPlainText(content.content) : "";
  return `${direct} ${nested}`.replace(/\s+/g, " ").trim();
}

export function deriveLessonTitle(lesson: Pick<BinderLesson, "title" | "content" | "math_blocks" | "order_index">) {
  const normalizedTitle = normalizeText(lesson.title);
  if (!isPlaceholderTitle(normalizedTitle)) {
    return normalizedTitle;
  }

  const text = extractPlainText(lesson.content);
  const firstSentence = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .find(Boolean);

  if (firstSentence) {
    return firstSentence.slice(0, 60).trim();
  }

  if (lesson.math_blocks.length > 0) {
    const firstLabel = lesson.math_blocks.find((block) => normalizeText(block.label))?.label?.trim();
    if (firstLabel) {
      return firstLabel;
    }
    return `Math block ${lesson.order_index}`;
  }

  return `Lesson ${lesson.order_index}`;
}

export function deriveBinderTitle(
  binder: Pick<Binder, "title">,
  lessons: Array<Pick<BinderLesson, "title" | "content" | "math_blocks" | "order_index">>,
) {
  const normalizedTitle = normalizeText(binder.title);
  if (!isPlaceholderTitle(normalizedTitle)) {
    return normalizedTitle;
  }

  const firstNamedLesson = lessons.find((lesson) => !isPlaceholderTitle(lesson.title));
  if (firstNamedLesson) {
    return normalizeText(firstNamedLesson.title);
  }

  const firstLesson = lessons[0];
  if (firstLesson) {
    return deriveLessonTitle(firstLesson);
  }

  return "Recovered Binder";
}

export function getDisplayTitle(value: string | null | undefined, fallback: string) {
  return isPlaceholderTitle(value) ? fallback : normalizeText(value);
}

export function lessonHasMeaningfulContent(lesson: Pick<BinderLesson, "content" | "math_blocks">) {
  return extractPlainText(lesson.content).length > 0 || lesson.math_blocks.length > 0;
}

export function noteHasMeaningfulContent(note: Pick<LearnerNote, "content" | "math_blocks">) {
  return extractPlainText(note.content).length > 0 || note.math_blocks.length > 0;
}

export function isPlaceholderDocument(input: {
  lesson: BinderLesson;
  notes?: LearnerNote[];
  highlights?: Highlight[];
}) {
  const notes = input.notes ?? [];
  const highlights = input.highlights ?? [];
  return (
    isPlaceholderTitle(input.lesson.title) &&
    !lessonHasMeaningfulContent(input.lesson) &&
    notes.every((note) => !noteHasMeaningfulContent(note)) &&
    highlights.length === 0
  );
}

export function isPlaceholderBinder(input: {
  binder: Binder;
  lessons?: BinderLesson[];
  notes?: LearnerNote[];
  highlights?: Highlight[];
}) {
  const lessons = input.lessons ?? [];
  const notes = input.notes ?? [];
  const highlights = input.highlights ?? [];
  const normalizedDescription = normalizeText(input.binder.description).toLowerCase();
  const hasMeaningfulLessons = lessons.some((lesson) => !isPlaceholderDocument({ lesson }));
  const hasMeaningfulNotes = notes.some((note) => noteHasMeaningfulContent(note));
  const hasUserActivity = highlights.length > 0 || hasMeaningfulNotes;

  if (input.binder.status === "published" || input.binder.pinned || input.binder.suite_template_id) {
    return false;
  }

  return (
    isPlaceholderTitle(input.binder.title) &&
    PLACEHOLDER_BINDER_DESCRIPTIONS.has(normalizedDescription) &&
    !hasMeaningfulLessons &&
    !hasUserActivity
  );
}

export function isPlaceholderFolder(input: {
  folder: Folder;
  binders?: Binder[];
  notes?: LearnerNote[];
}) {
  const binders = input.binders ?? [];
  const notes = input.notes ?? [];

  if (input.folder.source === "system") {
    return binders.length === 0;
  }

  return isPlaceholderTitle(input.folder.name) && binders.length === 0 && notes.length === 0;
}

export function sortBindersForWorkspace(
  binders: Binder[],
  lessonsByBinderId: Record<string, BinderLesson[]>,
  notesByBinderId: Record<string, LearnerNote[]>,
) {
  return [...binders].sort((left, right) => {
    const leftPlaceholder = isPlaceholderBinder({
      binder: left,
      lessons: lessonsByBinderId[left.id] ?? [],
      notes: notesByBinderId[left.id] ?? [],
    });
    const rightPlaceholder = isPlaceholderBinder({
      binder: right,
      lessons: lessonsByBinderId[right.id] ?? [],
      notes: notesByBinderId[right.id] ?? [],
    });

    if (leftPlaceholder !== rightPlaceholder) {
      return Number(leftPlaceholder) - Number(rightPlaceholder);
    }

    if (left.pinned !== right.pinned) {
      return Number(right.pinned) - Number(left.pinned);
    }

    if (left.status !== right.status) {
      return left.status === "published" ? -1 : right.status === "published" ? 1 : 0;
    }

    const leftLessonCount = lessonsByBinderId[left.id]?.length ?? 0;
    const rightLessonCount = lessonsByBinderId[right.id]?.length ?? 0;
    if (leftLessonCount !== rightLessonCount) {
      return rightLessonCount - leftLessonCount;
    }

    return Date.parse(right.updated_at) - Date.parse(left.updated_at);
  });
}

export function filterActionableDiagnostics(diagnostics: WorkspaceDiagnostic[]) {
  return diagnostics.filter((diagnostic) => diagnostic.severity === "warning" || diagnostic.severity === "error");
}

export function selectPrimaryWorkspaceDiagnostic(diagnostics: WorkspaceDiagnostic[]) {
  return filterActionableDiagnostics(diagnostics)
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "error" ? -1 : 1;
      }
      return left.scope.localeCompare(right.scope);
    })[0] ?? null;
}

export function filterVisibleWorkspaceData(input: {
  binders: Binder[];
  folders: Folder[];
  folderBinders: FolderBinderLink[];
  lessons: BinderLesson[];
  notes: LearnerNote[];
  highlights?: Highlight[];
}) {
  const lessonsByBinderId = groupByBinderId(input.lessons);
  const notesByBinderId = groupByBinderId(input.notes);
  const highlightsByBinderId = groupByBinderId(input.highlights ?? []);

  const binders = sortBindersForWorkspace(input.binders, lessonsByBinderId, notesByBinderId).filter(
    (binder) =>
      !isPlaceholderBinder({
        binder,
        lessons: lessonsByBinderId[binder.id] ?? [],
        notes: notesByBinderId[binder.id] ?? [],
        highlights: highlightsByBinderId[binder.id] ?? [],
      }),
  );

  const visibleBinderIds = new Set(binders.map((binder) => binder.id));
  const folderBinders = input.folderBinders.filter((link) => visibleBinderIds.has(link.binder_id));
  const binderIdsByFolderId = folderBinders.reduce<Record<string, string[]>>((entries, link) => {
    entries[link.folder_id] = [...(entries[link.folder_id] ?? []), link.binder_id];
    return entries;
  }, {});

  const folders = input.folders.filter((folder) => {
    const folderBindersList = binders.filter((binder) =>
      (binderIdsByFolderId[folder.id] ?? []).includes(binder.id),
    );
    const folderNotes = input.notes.filter((note) => note.folder_id === folder.id);
    return !isPlaceholderFolder({ folder, binders: folderBindersList, notes: folderNotes });
  });

  const visibleFolderIds = new Set(folders.map((folder) => folder.id));
  const visibleFolderBinders = folderBinders.filter((link) => visibleFolderIds.has(link.folder_id));
  const lessons = input.lessons.filter(
    (lesson) =>
      visibleBinderIds.has(lesson.binder_id) &&
      !isPlaceholderDocument({
        lesson,
        notes: input.notes.filter((note) => note.lesson_id === lesson.id),
        highlights: (input.highlights ?? []).filter((highlight) => highlight.lesson_id === lesson.id),
      }),
  );

  return {
    binders,
    folders,
    folderBinders: visibleFolderBinders,
    lessons,
  };
}

function groupByBinderId<T extends { binder_id: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((entries, item) => {
    entries[item.binder_id] = [...(entries[item.binder_id] ?? []), item];
    return entries;
  }, {});
}
