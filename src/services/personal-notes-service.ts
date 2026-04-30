import type { JSONContent } from "@tiptap/react";
import { supabase } from "@/lib/supabase";
import { emptyDoc } from "@/lib/utils";
import { buildPersonalNotesEntries } from "@/lib/personal-notes";
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
  PersonalNotesLoadIssue,
  Profile,
} from "@/types";

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
  const [
    personalNotesResult,
    personalFoldersResult,
    personalBindersResult,
    personalDocumentsResult,
  ] = await Promise.all([
    readPersonalTable<PersonalNote>(
      "personal_notes",
      supabase
        .from("personal_notes")
        .select("*")
        .eq("owner_id", profile.id)
        .is("archived_at", null)
        .order("updated_at", { ascending: false }),
    ),
    readPersonalTable<PersonalNoteFolder>(
      "personal_note_folders",
      supabase
        .from("personal_note_folders")
        .select("*")
        .eq("owner_id", profile.id)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false }),
    ),
    readPersonalTable<PersonalNoteBinder>(
      "personal_note_binders",
      supabase
        .from("personal_note_binders")
        .select("*")
        .eq("owner_id", profile.id)
        .order("pinned", { ascending: false })
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false }),
    ),
    readPersonalTable<PersonalNoteDocument>(
      "personal_note_documents",
      supabase
        .from("personal_note_documents")
        .select("*")
        .eq("owner_id", profile.id)
        .is("archived_at", null)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false }),
    ),
  ]);

  const binderIds = [...new Set(learnerNotes.map((note) => note.binder_id))];
  const lessonIds = [...new Set(learnerNotes.map((note) => note.lesson_id))];
  const folderIds = [...new Set(learnerNotes.map((note) => note.folder_id).filter(Boolean))] as string[];

  const [bindersResult, lessonsResult, foldersResult] = await Promise.all([
    binderIds.length
      ? supabase.from("binders").select("*").in("id", binderIds)
      : Promise.resolve({ data: [], error: null }),
    lessonIds.length
      ? supabase.from("binder_lessons").select("*").in("id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
    folderIds.length
      ? supabase.from("folders").select("*").in("id", folderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const referenceError = bindersResult.error || lessonsResult.error || foldersResult.error;
  if (referenceError) {
    throw referenceError;
  }

  let workspaceData: Pick<PersonalNotesData, "binders" | "folders" | "folderBinders" | "lessons"> = {
    binders: [],
    folders: [],
    folderBinders: [],
    lessons: [],
  };
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

  return buildPersonalNotesData({
    learnerNotes,
    personalNotes: personalNotesResult.data,
    personalFolders: personalFoldersResult.data,
    personalBinders: personalBindersResult.data,
    personalDocuments: personalDocumentsResult.data,
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
}

export const getPersonalNotesData = getPersonalNotesWorkspace;

export async function getBinderLinkedLearnerNotes(profile: Profile): Promise<LearnerNote[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("learner_notes")
    .select("*")
    .eq("owner_id", profile.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as LearnerNote[];
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
  const client = requireSupabase();
  const { error } = await client
    .from("personal_note_folders")
    .delete()
    .eq("owner_id", input.ownerId)
    .eq("id", input.id);

  if (error) {
    throw error;
  }
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
  const client = requireSupabase();
  const { error } = await client
    .from("personal_note_binders")
    .delete()
    .eq("owner_id", input.ownerId)
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}

export async function createPersonalDocument(
  input: PersonalDocumentInput,
): Promise<PersonalNoteDocument> {
  const client = requireSupabase();
  const title = input.title.trim() || "Untitled document";

  const { data, error } = await client
    .from("personal_note_documents")
    .upsert({
      id: input.id ?? crypto.randomUUID(),
      owner_id: input.ownerId,
      binder_id: input.binderId,
      title,
      content: input.content ?? emptyDoc(""),
      math_blocks: input.mathBlocks ?? [],
      tags: normalizeTags(input.tags ?? []),
      pinned: input.pinned ?? false,
      updated_at: now(),
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
  return createPersonalDocument(input);
}

export async function deletePersonalDocument(input: {
  id: string;
  ownerId: string;
}) {
  const client = requireSupabase();
  const { error } = await client
    .from("personal_note_documents")
    .update({ archived_at: now(), updated_at: now() })
    .eq("owner_id", input.ownerId)
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}

export async function createLoosePersonalNote(input: PersonalNoteInput): Promise<PersonalNote> {
  return upsertPersonalNote(input);
}

export async function updateLoosePersonalNote(input: PersonalNoteInput): Promise<PersonalNote> {
  return upsertPersonalNote(input);
}

export async function deleteLoosePersonalNote(input: {
  id: string;
  ownerId: string;
}) {
  const client = requireSupabase();
  const { error } = await client
    .from("personal_notes")
    .update({ archived_at: now(), updated_at: now() })
    .eq("owner_id", input.ownerId)
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}

export async function upsertPersonalNote(input: PersonalNoteInput): Promise<PersonalNote> {
  const client = requireSupabase();
  const title = input.title.trim() || "Untitled note";

  const { data, error } = await client
    .from("personal_notes")
    .upsert({
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
      updated_at: now(),
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
    .update({ pinned: input.pinned, updated_at: now() })
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
