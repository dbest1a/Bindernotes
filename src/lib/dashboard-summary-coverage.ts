import type { BinderLesson } from "@/types";
import { emptyDoc } from "@/lib/utils";

export type LessonMetadata = Omit<BinderLesson, "content" | "math_blocks">;
export type LessonSummary = Omit<LessonMetadata, "id"> & { lesson_id: string; plain_text_excerpt: string | null };

/** Authoritative metadata determines membership; summaries only enrich current rows. */
export function reconcileLessonSummaries(metadata: LessonMetadata[], summaries: LessonSummary[]) {
  const byId = new Map(summaries.map((summary) => [summary.lesson_id, summary]));
  let repaired = 0;
  const lessons = metadata.map((lesson): BinderLesson => {
    const summary = byId.get(lesson.id);
    const fresh = summary?.binder_id === lesson.binder_id
      && Number.isFinite(Date.parse(lesson.updated_at))
      && Date.parse(summary.updated_at) === Date.parse(lesson.updated_at);
    if (!fresh) repaired += 1;
    return { ...lesson, content: emptyDoc(fresh ? summary?.plain_text_excerpt ?? "" : ""), math_blocks: [] };
  });
  const ids = new Set(metadata.map((lesson) => lesson.id));
  const removed = summaries.filter((summary) => !ids.has(summary.lesson_id)).length;
  return { lessons, repaired, removed, complete: repaired === 0 && removed === 0 && byId.size === summaries.length };
}
