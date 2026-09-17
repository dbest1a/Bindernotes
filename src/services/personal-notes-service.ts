import { readMetadataPages, readMetadataForIds } from "@/lib/metadata-pages";
import { editorDocumentSchema, mathBlockSchema } from "@/lib/personal-content-contract";
import type { JSONContent } from "@tiptap/react";
import { ContentConflictError } from "@/lib/revisioned-save";
import { supabase } from "@/lib/supabase";
import { emptyDoc } from "@/lib/utils";
import { buildPersonalNotesEntries } from "@/lib/personal-notes";
import { activePersonalTree } from "@/lib/personal-trash";
import { setPersonalTrash } from "@/services/personal-trash-service";
import { getDashboard, upsertLearnerNote } from "@/services/binder-service";
import type {
  Binder,
  BinderLesson,
  Folder,
  FolderBinderLink,
  LearnerNote,
  MathBlock,
  PersonalNote,
  PersonalNoteBinder,
  PersonalNoteDocument,
  PersonalNoteFolder,
  PersonalNotesData,
  PersonalNotesEntry,
  PersonalNotesLoadIssue,
  Profile,
} from "@/types";

export const LEARNER_NOTE_METADATA_SELECT = "id,owner_id,binder_id,lesson_id,folder_id,title,pinned,revision,created_at,updated_at";
export const PERSONAL_NOTE_METADATA_SELECT = "id,owner_id,title,folder_id,binder_id,document_id,tags,pinned,revision,archived_at,created_at,updated_at";
export const PERSONAL_DOCUMENT_METADATA_SELECT = "id,owner_id,binder_id,title,tags,pinned,revision,archived_at,created_at,updated_at";
const LESSON_METADATA_SELECT = "id,binder_id,title,order_index,is_preview,created_at,updated_at";
function metadataContent<T>(row: T): T & { content: JSONContent; math_blocks: [] } {
  return { ...row, content: emptyDoc(""), math_blocks: [] };
}

const now = () => new Date().toISOString();

type SupabaseErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type SupabaseTableResult = {
  data: unknown;
  error: SupabaseErrorLike | null;
};

type PersonalNoteInput = {
  id?: string;
  ownerId: string;
  title: string;
  content?: JSONContent;
  mathBlocks?: MathBlock[];
  folderId?: string | null;
  binderId?: string | null;
  documentId?: string | null;
  tags?: string[];
  pinned?: boolean;
  expectedRevision?: number;
  operationId?: string;
};

type PersonalDocumentInput = {
  id?: string;
  ownerId: string;
  binderId: string;
  title: string;
  content?: JSONContent;
  mathBlocks?: MathBlock[];
  tags?: string[];
  pinned?: boolean;
  expectedRevision?: number;
  operationId?: string;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Personal Notes needs a signed-in Supabase workspace.");
  }

  return supabase;
}

export async function getPersonalNotesWorkspace(profile: Profile): Promise<PersonalNotesData> {
  if (!supabase) {
    return buildPersonalNotesData({
      learnerNotes: [],
      personalNotes: [],
      personalFolders: [],
      personalBinders: [],
      personalDocuments: [],
      binders: [],
      lessons: [],
      folders: [],
      folderBinders: [],
      loadIssues: [
        {
          code: "personal_schema_blocked",
          severity: "error",
          title: "Supabase workspace is not connected",
          message: "Personal Notes needs the configured Supabase client before account notes can load.",
          technicalReason: "The Supabase client is null in src/lib/supabase.ts.",
        },
      ],
    });
  }

  const learnerNotes = await getBinderLinkedLearnerNotes(profile);
  const pageTable = (table: string, select: string, active = false) => readMetadataPages((from, to) => {
    let query = supabase!.from(table).select(select).eq("owner_id", profile.id);
    if (active) query = query.is("archived_at", null);
    return query.order("id").range(from, to);
  });
  const [personalNotesResult, personalFoldersResult, personalBindersResult, personalDocumentsResult] = await Promise.all([
    readPersonalTable<PersonalNote>("personal_notes", pageTable("personal_notes", PERSONAL_NOTE_METADATA_SELECT, true)),
    readPersonalTable<PersonalNoteFolder>("personal_note_folders", pageTable("personal_note_folders", "*")),
    readPersonalTable<PersonalNoteBinder>("personal_note_binders", pageTable("personal_note_binders", "*")),
    readPersonalTable<PersonalNoteDocument>("personal_note_documents", pageTable("personal_note_documents", PERSONAL_DOCUMENT_METADATA_SELECT, true)),
  ]);
  personalNotesResult.data = personalNotesResult.data.map(metadataContent);
  personalDocumentsResult.data = personalDocumentsResult.data.map(metadataContent);

  const binderIds = [...new Set(learnerNotes.map((note) => note.binder_id))];
  const lessonIds = [...new Set(learnerNotes.map((note) => note.lesson_id))];
  const folderIds = [...new Set(learnerNotes.map((note) => note.folder_id).filter(Boolean))] as string[];

  const [bindersResult, lessonsResult, foldersResult] = await Promise.all([
    binderIds.length
      ? readMetadataForIds(binderIds, (ids, from, to) => supabase!.from("binders").select("*").in("id", ids).order("id").range(from, to))
      : Promise.resolve({ data: [], error: null }),
    lessonIds.length
      ? readMetadataForIds(lessonIds, (ids, from, to) => supabase!.from("binder_lessons").select(LESSON_METADATA_SELECT).in("id", ids).order("id").range(from, to))
      : Promise.resolve({ data: [], error: null }),
    folderIds.length
      ? readMetadataForIds(folderIds, (ids, from, to) => supabase!.from("folders").select("*").in("id", ids).order("id").range(from, to))
      : Promise.resolve({ data: [], error: null }),
  ]);

  const referenceError = bindersResult.error || lessonsResult.error || foldersResult.error;
  if (referenceError) {
    throw referenceError;
  }

  let workspaceData: Pick<PersonalNotesData, "binders" | "folders" | "folderBinders" | "lessons">;
  try {
    const dashboard = await getDashboard(profile, { includeSystemStatus: false });
    workspaceData = {
      binders: dashboard.binders,
      folders: dashboard.folders,
      folderBinders: dashboard.folderBinders,
      lessons: dashboard.lessons,
    };
  } catch {
    workspaceData = {
      binders: [],
      folders: [],
      folderBinders: [],
      lessons: [],
    };
  }

  const binders = mergeById(workspaceData.binders, (bindersResult.data ?? []) as Binder[]);
  const lessons = mergeById(workspaceData.lessons, (lessonsResult.data ?? []) as BinderLesson[]);
  const folders = mergeById(workspaceData.folders, (foldersResult.data ?? []) as Folder[]);

  const workspace = buildPersonalNotesData({
    learnerNotes,
    ...activePersonalTree({
      personalNotes: personalNotesResult.data,
      personalFolders: personalFoldersResult.data,
      personalBinders: personalBindersResult.data,
      personalDocuments: personalDocumentsResult.data,
    }),
    binders,
    lessons,
    folders,
    folderBinders: workspaceData.folderBinders,
    loadIssues: [
      personalNotesResult.issue,
      personalFoldersResult.issue,
      personalBindersResult.issue,
      personalDocumentsResult.issue,
    ].filter(Boolean) as PersonalNotesLoadIssue[],
  });
  return { ...workspace, entries: workspace.entries.map((entry) => ({ ...entry, contentLoaded: false, excerpt: "Open to load content" })) };
}

export const getPersonalNotesData = getPersonalNotesWorkspace;

export async function getBinderLinkedLearnerNotes(profile: Profile): Promise<LearnerNote[]> {
  const client = requireSupabase();
  const { data, error } = await readMetadataPages((from, to) => client
    .from("learner_notes").select(LEARNER_NOTE_METADATA_SELECT)
    .eq("owner_id", profile.id).order("id").range(from, to));
  if (error) throw error;
  return (data ?? []).map(metadataContent) as LearnerNote[];
}

export async function getPersonalNoteEntryContent(entry: PersonalNotesEntry, ownerId: string, signal?: AbortSignal): Promise<PersonalNotesEntry> {
  if (entry.note.owner_id !== ownerId) throw new Error("This note belongs to a different account.");
  const table = entry.kind === "binder-note" ? "learner_notes" : entry.kind === "personal-document" ? "personal_note_documents" : "personal_notes";
  let query = requireSupabase().from(table).select("*").eq("owner_id", ownerId).eq("id", entry.id);
  if (table !== "learner_notes") query = query.is("archived_at", null);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.single();
  if (error) throw error;
  if (!data || data.id !== entry.id || data.owner_id !== ownerId) throw new Error("The selected note could not be loaded.");
  const content = editorDocumentSchema.parse(data.content);
  const mathBlocks = mathBlockSchema.array().parse(data.math_blocks ?? []);
  return { ...entry, note: { ...data, content, math_blocks: mathBlocks }, title: data.title, content, math_blocks: mathBlocks,
    pinned: data.pinned, tags: data.tags ?? [], updated_at: data.updated_at, contentLoaded: true };
}

export async function createPersonalNoteFolder(input: {
  ownerId: string;
  name: string;
  color?: string;
}): Promise<PersonalNoteFolder> {
  const client = requireSupabase();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Folder name is required.");
  }

  const { data, error } = await client
    .from("personal_note_folders")
    .insert({
      owner_id: input.ownerId,
      name,
      color: input.color ?? "teal",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PersonalNoteFolder;
}

export async function updatePersonalNoteFolder(input: {
  id: string;
  ownerId: string;
  name?: string;
  color?: string;
  sortOrder?: number | null;
}): Promise<PersonalNoteFolder> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("personal_note_folders")
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
      updated_at: now(),
    })
    .eq("owner_id", input.ownerId)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PersonalNoteFolder;
}

export async function deletePersonalNoteFolder(input: {
  id: string;
  ownerId: string;
}) {
  await setPersonalTrash("folder", input.id, "trash");
}

export async function createPersonalBinder(input: {
  ownerId: string;
  title: string;
  folderId?: string | null;
  description?: string | null;
  color?: string | null;
  createFirstDocument?: boolean;
}): Promise<{
  binder: PersonalNoteBinder;
  document: PersonalNoteDocument | null;
}> {
  const client = requireSupabase();
  const title = input.title.trim();
  if (!title) {
    throw new Error("Binder title is required.");
  }

  const { data, error } = await client
    .from("personal_note_binders")
    .insert({
      owner_id: input.ownerId,
      folder_id: input.folderId ?? null,
      title,
      description: input.description?.trim() || null,
      color: input.color ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const binder = data as PersonalNoteBinder;
  const document = input.createFirstDocument
    ? await createPersonalDocument({
        ownerId: input.ownerId,
        binderId: binder.id,
        title: "First document",
      })
    : null;

  return { binder, document };
}

export async function updatePersonalBinder(input: {
  id: string;
  ownerId: string;
  title?: string;
  folderId?: string | null;
  description?: string | null;
  color?: string | null;
  pinned?: boolean;
  sortOrder?: number | null;
}): Promise<PersonalNoteBinder> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("personal_note_binders")
    .update({
      ...(input.title !== undefined ? { title: input.title.trim() || "Untitled binder" } : {}),
      ...(input.folderId !== undefined ? { folder_id: input.folderId } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
      updated_at: now(),
    })
    .eq("owner_id", input.ownerId)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PersonalNoteBinder;
}

export async function deletePersonalBinder(input: {
  id: string;
  ownerId: string;
}) {
  await setPersonalTrash("binder", input.id, "trash");
}

export async function createPersonalDocument(
  input: PersonalDocumentInput,
): Promise<PersonalNoteDocument> {
  const client = requireSupabase();
  const title = input.title.trim() || "Untitled document";

  const { data, error } = await client
    .from("personal_note_documents")
    .insert({
      id: input.id ?? crypto.randomUUID(),
      owner_id: input.ownerId,
      binder_id: input.binderId,
      title,
      content: input.content ?? emptyDoc(""),
      math_blocks: input.mathBlocks ?? [],
      tags: normalizeTags(input.tags ?? []),
      pinned: input.pinned ?? false,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PersonalNoteDocument;
}

export async function updatePersonalDocument(
  input: PersonalDocumentInput,
): Promise<PersonalNoteDocument> {
  if (input.id) return savePersonalRecord("document", input) as Promise<PersonalNoteDocument>;
  return createPersonalDocument(input);
}

export async function deletePersonalDocument(input: {
  id: string;
  ownerId: string;
}) {
  await setPersonalTrash("document", input.id, "trash");
}

export async function createLoosePersonalNote(input: PersonalNoteInput): Promise<PersonalNote> {
  return upsertPersonalNote(input);
}

export async function updateLoosePersonalNote(input: PersonalNoteInput): Promise<PersonalNote> {
  if (input.id) return savePersonalRecord("note", input) as Promise<PersonalNote>;
  return upsertPersonalNote(input);
}

async function savePersonalRecord(kind: "note" | "document", input: PersonalNoteInput | PersonalDocumentInput) {
  if (!input.id || input.expectedRevision === undefined || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new Error("The original saved revision is required before updating this note.");
  const { data, error } = await requireSupabase().rpc("save_personal_content", {
    p_kind: kind,
    p_record: {
      id: input.id, owner_id: input.ownerId, title: input.title.trim() || "Untitled note", content: input.content ?? emptyDoc(""),
      math_blocks: input.mathBlocks ?? [], tags: normalizeTags(input.tags ?? []), pinned: input.pinned ?? false, binder_id: input.binderId ?? null,
      ...(kind === "note" ? { folder_id: "folderId" in input ? input.folderId ?? null : null, document_id: "documentId" in input ? input.documentId ?? null : null } : {}),
    },
    p_expected_revision: input.expectedRevision,
    p_operation_id: input.operationId ?? crypto.randomUUID(),
  });
  if (error) { if (error.code === "40001") throw new ContentConflictError(); throw error; }
  if (!data || data.id !== input.id || data.owner_id !== input.ownerId || !Number.isSafeInteger(data.revision) || data.revision <= input.expectedRevision) throw new Error("The server did not confirm this note revision.");
  return data;
}

export async function deleteLoosePersonalNote(input: {
  id: string;
  ownerId: string;
}) {
  await setPersonalTrash("note", input.id, "trash");
}

export async function upsertPersonalNote(input: PersonalNoteInput): Promise<PersonalNote> {
  if (input.id && input.expectedRevision !== undefined) return savePersonalRecord("note", input) as Promise<PersonalNote>;
  const client = requireSupabase();
  const title = input.title.trim() || "Untitled note";

  const { data, error } = await client
    .from("personal_notes")
    .insert({
      id: input.id ?? crypto.randomUUID(),
      owner_id: input.ownerId,
      folder_id: input.folderId ?? null,
      binder_id: input.binderId ?? null,
      document_id: input.documentId ?? null,
      title,
      content: input.content ?? emptyDoc(""),
      math_blocks: input.mathBlocks ?? [],
      tags: normalizeTags(input.tags ?? []),
      pinned: input.pinned ?? false,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PersonalNote;
}

export async function updateBinderLinkedPersonalNote(input: {
  id?: string;
  ownerId: string;
  binderId: string;
  lessonId: string;
  folderId?: string | null;
  title: string;
  content: JSONContent;
  mathBlocks: MathBlock[];
  pinned?: boolean;
  expectedRevision?: number;
  operationId?: string;
}): Promise<LearnerNote> {
  return upsertLearnerNote(input);
}

export async function setPersonalEntryPinned(input: {
  ownerId: string;
  kind: "personal-note" | "personal-document";
  id: string;
  pinned: boolean;
}) {
  const client = requireSupabase();
  const table =
    input.kind === "personal-document"
      ? "personal_note_documents"
      : "personal_notes";
  const { error } = await client
    .from(table)
    .update({ pinned: input.pinned })
    .eq("owner_id", input.ownerId)
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}

export const createPersonalFolder = createPersonalNoteFolder;
export const createPersonalNotebookBinder = createPersonalBinder;
export const createPersonalNotebookDocument = createPersonalDocument;
export const updatePersonalNotebookDocument = updatePersonalDocument;

export function buildUnifiedPersonalNotesEntries(input: Parameters<typeof buildPersonalNotesEntries>[0]) {
  return buildPersonalNotesEntries(input);
}

function buildPersonalNotesData(input: {
  learnerNotes: LearnerNote[];
  personalNotes: PersonalNote[];
  personalFolders: PersonalNoteFolder[];
  personalBinders: PersonalNoteBinder[];
  personalDocuments: PersonalNoteDocument[];
  binders: Binder[];
  lessons: BinderLesson[];
  folders: Folder[];
  folderBinders: FolderBinderLink[];
  loadIssues?: PersonalNotesLoadIssue[];
}): PersonalNotesData {
  const entries = buildPersonalNotesEntries({
    learnerNotes: input.learnerNotes,
    personalNotes: input.personalNotes,
    personalDocuments: input.personalDocuments,
    personalBinders: input.personalBinders,
    binders: input.binders,
    lessons: input.lessons,
    folders: [...input.folders, ...input.personalFolders],
  });

  return {
    entries,
    learnerNotes: input.learnerNotes,
    personalNotes: input.personalNotes,
    personalFolders: input.personalFolders,
    personalBinders: input.personalBinders,
    personalDocuments: input.personalDocuments,
    binders: input.binders,
    lessons: input.lessons,
    folders: input.folders,
    folderBinders: input.folderBinders,
    loadIssues: input.loadIssues?.length ? input.loadIssues : undefined,
  };
}

function mergeById<T extends { id: string }>(primary: T[], fallback: T[]) {
  const merged = new Map<string, T>();
  fallback.forEach((item) => merged.set(item.id, item));
  primary.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

async function readPersonalTable<T>(
  table: string,
  query: PromiseLike<SupabaseTableResult>,
): Promise<{ data: T[]; issue: PersonalNotesLoadIssue | null }> {
  const { data, error } = await query;
  if (!error) {
    return { data: (data ?? []) as T[], issue: null };
  }

  return {
    data: [],
    issue: classifyPersonalTableError(table, error),
  };
}

function classifyPersonalTableError(table: string, error: SupabaseErrorLike): PersonalNotesLoadIssue {
  const technicalReason = [
    error.code ? `${error.code}:` : "",
    error.message,
    error.details,
    error.hint,
  ].filter(Boolean).join(" ");
  const normalized = technicalReason.toLowerCase();
  const isMissingTable =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    normalized.includes("does not exist") ||
    normalized.includes("could not find the table") ||
    normalized.includes("relation");
  const isPolicyBlocked =
    error.code === "42501" ||
    normalized.includes("row-level security") ||
    normalized.includes("permission denied");

  if (isMissingTable) {
    return {
      code: "personal_schema_missing",
      severity: "error",
      title: "Personal Notes schema is missing",
      message: `The ${table} table is not available for this Supabase workspace yet.`,
      technicalReason,
      table,
    };
  }

  if (isPolicyBlocked) {
    return {
      code: "personal_schema_blocked",
      severity: "error",
      title: "Personal Notes access is blocked",
      message: `Supabase denied access to ${table} for the signed-in account.`,
      technicalReason,
      table,
    };
  }

  return {
    code: "personal_query_failed",
    severity: "warning",
    title: "Personal Notes query failed",
    message: `BinderNotes could not load ${table}.`,
    technicalReason: technicalReason || "Unknown Supabase error.",
    table,
  };
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}
