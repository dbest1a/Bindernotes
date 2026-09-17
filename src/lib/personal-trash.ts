import type { PersonalNote, PersonalNoteBinder, PersonalNoteDocument, PersonalNoteFolder } from "@/types";
/** Hiding a trashed tree never rewrites child relationships or archive flags. */
export function activePersonalTree(input: {
  personalNotes: PersonalNote[];
  personalFolders: PersonalNoteFolder[];
  personalBinders: PersonalNoteBinder[];
  personalDocuments: PersonalNoteDocument[];
}) {
  const personalFolders = input.personalFolders.filter((item) => !item.archived_at);
  const folderIds = new Set(personalFolders.map((item) => item.id));
  const personalBinders = input.personalBinders.filter(
    (item) => !item.archived_at && (!item.folder_id || folderIds.has(item.folder_id)),
  );
  const binderIds = new Set(personalBinders.map((item) => item.id));
  const personalDocuments = input.personalDocuments.filter(
    (item) => !item.archived_at && binderIds.has(item.binder_id),
  );
  const documentIds = new Set(personalDocuments.map((item) => item.id));
  const personalNotes = input.personalNotes.filter(
    (item) =>
      !item.archived_at &&
      (!item.folder_id || folderIds.has(item.folder_id)) &&
      (!item.binder_id || binderIds.has(item.binder_id)) &&
      (!item.document_id || documentIds.has(item.document_id)),
  );
  return { personalNotes, personalFolders, personalBinders, personalDocuments };
}
