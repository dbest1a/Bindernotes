import { describe, expect, it } from "vitest";
import { reconcileLessonSummaries, type LessonMetadata, type LessonSummary } from "./dashboard-summary-coverage";
const row = (id: string): LessonMetadata => ({ id, binder_id: "binder", title: id, order_index: 0, is_preview: false, created_at: "2026-01-01", updated_at: "2026-09-17" });
const summary = (id: string): LessonSummary => ({ ...row(id), lesson_id: id, plain_text_excerpt: "Current excerpt" });
describe("dashboard summary coverage", () => {
  it("repairs a nonempty partial summary without dropping missing lessons", () => {
    const result = reconcileLessonSummaries([row("a"), row("b")], [summary("a")]);
    expect(result.lessons.map((lesson) => lesson.id)).toEqual(["a", "b"]);
    expect(result).toMatchObject({ repaired: 1, complete: false });
  });
  it("discards stale excerpt/title, deleted summaries and wrong-binder rows", () => {
    const result = reconcileLessonSummaries([row("a"), row("b")], [
      { ...summary("a"), updated_at: "2025-01-01", title: "Old" }, { ...summary("b"), binder_id: "other" }, summary("deleted"),
    ]);
    expect(result).toMatchObject({ repaired: 2, removed: 1, complete: false });
    expect(JSON.stringify(result.lessons)).not.toContain("Current excerpt");
    expect(result.lessons[0].title).toBe("a");
  });
  it("uses fresh excerpts only with authoritative membership and timestamps", () => {
    const result = reconcileLessonSummaries([row("a")], [summary("a")]);
    expect(result.complete).toBe(true);
    expect(JSON.stringify(result.lessons)).toContain("Current excerpt");
  });
});
