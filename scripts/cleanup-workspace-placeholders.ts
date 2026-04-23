import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { deriveBinderTitle, deriveLessonTitle, isPlaceholderBinder, isPlaceholderDocument, isPlaceholderFolder, isPlaceholderTitle, noteHasMeaningfulContent } from "../src/lib/workspace-records";
import type { Binder, BinderLesson, Folder, FolderBinderLink, Highlight, LearnerNote } from "../src/types";

type CleanupAction =
  | { type: "rename-binder"; id: string; nextTitle: string }
  | { type: "archive-binder"; id: string; nextTitle?: string }
  | { type: "rename-lesson"; id: string; nextTitle: string }
  | { type: "delete-lesson"; id: string }
  | { type: "rename-folder"; id: string; nextName: string }
  | { type: "delete-folder"; id: string };

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function hasLessonActivity(
  lessonId: string,
  notes: LearnerNote[],
  highlights: Pick<Highlight, "lesson_id">[],
  comments: Array<{ lesson_id: string }>,
) {
  return (
    notes.some((note) => note.lesson_id === lessonId && noteHasMeaningfulContent(note)) ||
    highlights.some((highlight) => highlight.lesson_id === lessonId) ||
    comments.some((comment) => comment.lesson_id === lessonId)
  );
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const [bindersResult, lessonsResult, foldersResult, folderLinksResult, notesResult, highlightsResult, commentsResult] =
    await Promise.all([
      supabase.from("binders").select("*"),
      supabase.from("binder_lessons").select("*"),
      supabase.from("folders").select("*"),
      supabase.from("folder_binders").select("*"),
      supabase.from("learner_notes").select("*"),
      supabase.from("highlights").select("id,binder_id,lesson_id"),
      supabase.from("comments").select("id,binder_id,lesson_id"),
    ]);

  const possibleError =
    bindersResult.error ||
    lessonsResult.error ||
    foldersResult.error ||
    folderLinksResult.error ||
    notesResult.error ||
    highlightsResult.error ||
    commentsResult.error;

  if (possibleError) {
    throw new Error(possibleError.message);
  }

  const binders = (bindersResult.data ?? []) as Binder[];
  const lessons = (lessonsResult.data ?? []) as BinderLesson[];
  const folders = (foldersResult.data ?? []) as Folder[];
  const folderLinks = (folderLinksResult.data ?? []) as FolderBinderLink[];
  const notes = (notesResult.data ?? []) as LearnerNote[];
  const highlights = (highlightsResult.data ?? []) as Highlight[];
  const comments = (commentsResult.data ?? []) as Array<{ id: string; binder_id: string; lesson_id: string }>;

  const actions: CleanupAction[] = [];
  const deletedLessonIds = new Set<string>();

  for (const lesson of lessons) {
    const lessonNotes = notes.filter((note) => note.lesson_id === lesson.id);
    const lessonHighlights = highlights.filter((highlight) => highlight.lesson_id === lesson.id);
    const lessonComments = comments.filter((comment) => comment.lesson_id === lesson.id);

    if (
      isPlaceholderDocument({
        lesson,
        notes: lessonNotes,
        highlights: lessonHighlights,
      }) &&
      lessonComments.length === 0
    ) {
      actions.push({ type: "delete-lesson", id: lesson.id });
      deletedLessonIds.add(lesson.id);
      continue;
    }

    if (
      isPlaceholderTitle(lesson.title) &&
      hasLessonActivity(lesson.id, lessonNotes, lessonHighlights, lessonComments)
    ) {
      actions.push({
        type: "rename-lesson",
        id: lesson.id,
        nextTitle: deriveLessonTitle(lesson),
      });
    }
  }

  for (const binder of binders) {
    const binderLessons = lessons.filter(
      (lesson) => lesson.binder_id === binder.id && !deletedLessonIds.has(lesson.id),
    );
    const binderNotes = notes.filter((note) => note.binder_id === binder.id);
    const binderHighlights = highlights.filter((highlight) => highlight.binder_id === binder.id);
    const binderComments = comments.filter((comment) => comment.binder_id === binder.id);

    if (
      isPlaceholderBinder({
        binder,
        lessons: binderLessons,
        notes: binderNotes,
        highlights: binderHighlights,
      }) &&
      binderComments.length === 0
    ) {
      actions.push({ type: "archive-binder", id: binder.id });
      continue;
    }

    if (isPlaceholderTitle(binder.title) && (binderLessons.length > 0 || binderNotes.length > 0)) {
      actions.push({
        type: "rename-binder",
        id: binder.id,
        nextTitle: deriveBinderTitle(binder, binderLessons),
      });
    }
  }

  for (const folder of folders) {
    const linkedBinders = binders.filter((binder) =>
      folderLinks.some((link) => link.folder_id === folder.id && link.binder_id === binder.id),
    );
    const folderNotes = notes.filter((note) => note.folder_id === folder.id);

    if (isPlaceholderFolder({ folder, binders: linkedBinders, notes: folderNotes })) {
      if (linkedBinders.length === 0) {
        actions.push({ type: "delete-folder", id: folder.id });
      } else if (isPlaceholderTitle(folder.name)) {
        actions.push({
          type: "rename-folder",
          id: folder.id,
          nextName: `${deriveBinderTitle(
            linkedBinders[0],
            lessons.filter((lesson) => lesson.binder_id === linkedBinders[0].id),
          )} Folder`,
        });
      }
    }
  }

  console.log("");
  console.log(dryRun ? "Workspace placeholder cleanup dry run" : "Applying workspace placeholder cleanup");
  console.table(
    actions.map((action) => ({
      action: action.type,
      id: action.id,
      nextTitle:
        "nextTitle" in action
          ? action.nextTitle
          : "nextName" in action
            ? action.nextName
            : "",
    })),
  );

  if (dryRun || actions.length === 0) {
    return;
  }

  for (const action of actions) {
    if (action.type === "rename-binder") {
      const { error } = await supabase
        .from("binders")
        .update({ title: action.nextTitle, updated_at: new Date().toISOString() })
        .eq("id", action.id);
      if (error) {
        throw error;
      }
    }

    if (action.type === "archive-binder") {
      const { error } = await supabase
        .from("binders")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", action.id);
      if (error) {
        throw error;
      }
    }

    if (action.type === "rename-lesson") {
      const { error } = await supabase
        .from("binder_lessons")
        .update({ title: action.nextTitle, updated_at: new Date().toISOString() })
        .eq("id", action.id);
      if (error) {
        throw error;
      }
    }

    if (action.type === "delete-lesson") {
      const { error } = await supabase.from("binder_lessons").delete().eq("id", action.id);
      if (error) {
        throw error;
      }
    }

    if (action.type === "rename-folder") {
      const { error } = await supabase
        .from("folders")
        .update({ name: action.nextName, updated_at: new Date().toISOString() })
        .eq("id", action.id);
      if (error) {
        throw error;
      }
    }

    if (action.type === "delete-folder") {
      const { error } = await supabase.from("folders").delete().eq("id", action.id);
      if (error) {
        throw error;
      }
    }
  }
}

main().catch((error) => {
  console.error("");
  console.error("Workspace placeholder cleanup failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
