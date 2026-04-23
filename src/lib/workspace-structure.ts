import type {
  Binder,
  BinderLesson,
  DashboardData,
  Folder,
  FolderBinderLink,
  LearnerNote,
} from "@/types";

export type FolderSummary = {
  folder: Folder;
  binders: Binder[];
  notes: LearnerNote[];
  lessons: BinderLesson[];
};

export type BinderDocumentSummary = {
  lesson: BinderLesson;
  note: LearnerNote | undefined;
  hasPrivateNote: boolean;
  updatedAt: string;
};

export function getFolderSummaries(data: DashboardData): FolderSummary[] {
  return data.folders.map((folder) =>
    createFolderSummary(folder, data.binders, data.folderBinders, data.notes, data.lessons),
  );
}

export function createFolderSummary(
  folder: Folder,
  binders: Binder[],
  folderBinders: FolderBinderLink[],
  notes: LearnerNote[],
  lessons: BinderLesson[],
): FolderSummary {
  const links = folderBinders.filter((link) => link.folder_id === folder.id);
  const binderIds = new Set(links.map((link) => link.binder_id));
  const folderBindersList = binders.filter((binder) => binderIds.has(binder.id));
  const folderNotes = notes.filter((note) => note.folder_id === folder.id);
  const folderLessons = lessons.filter((lesson) => binderIds.has(lesson.binder_id));

  return {
    folder,
    binders: folderBindersList,
    notes: folderNotes,
    lessons: folderLessons,
  };
}

export function getUnfiledBinders(
  binders: Binder[],
  folderBinders: FolderBinderLink[],
): Binder[] {
  const filedIds = new Set(folderBinders.map((link) => link.binder_id));
  return binders.filter((binder) => !filedIds.has(binder.id));
}

export function getBinderDocumentSummaries(
  lessons: BinderLesson[],
  notes: LearnerNote[],
): BinderDocumentSummary[] {
  const noteMap = new Map(notes.map((note) => [note.lesson_id, note]));

  return [...lessons]
    .sort((left, right) => left.order_index - right.order_index)
    .map((lesson) => {
      const note = noteMap.get(lesson.id);
      return {
        lesson,
        note,
        hasPrivateNote: Boolean(note),
        updatedAt: note?.updated_at ?? lesson.updated_at,
      };
    });
}

export function getPrimaryFolder(
  binders: Binder[],
  folders: Folder[],
  folderLinks: FolderBinderLink[],
  binderId: string,
) {
  const binder = binders.find((item) => item.id === binderId);
  if (!binder) {
    return undefined;
  }

  const link = folderLinks.find((item) => item.binder_id === binder.id);
  return folders.find((folder) => folder.id === link?.folder_id);
}
