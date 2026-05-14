import { describe, expect, it } from "vitest";
import {
  bucketStudyItems,
  buildStudySessionSummary,
  scheduleStudyItemReview,
} from "@/lib/study-scheduler";
import type { StudyItem } from "@/services/study-items-service";

const baseNow = new Date("2026-05-14T12:00:00.000Z");

describe("study scheduler", () => {
  it("assigns deterministic due dates for review ratings", () => {
    const item = studyItem({ due_at: baseNow.toISOString(), review_count: 0 });

    expect(scheduleStudyItemReview(item, "forgot", baseNow).due_at).toBe("2026-05-14T12:10:00.000Z");
    expect(scheduleStudyItemReview(item, "hard", baseNow).due_at).toBe("2026-05-15T12:00:00.000Z");
    expect(scheduleStudyItemReview(item, "good", baseNow).due_at).toBe("2026-05-17T12:00:00.000Z");
    expect(scheduleStudyItemReview(item, "easy", baseNow).due_at).toBe("2026-05-21T12:00:00.000Z");
  });

  it("buckets due, upcoming, difficult, mastered, and binder groups", () => {
    const buckets = bucketStudyItems(
      [
        studyItem({ id: "due", due_at: "2026-05-14T09:00:00.000Z", binder_id: "binder-calc", binder_title: "Calculus" }),
        studyItem({ id: "upcoming", due_at: "2026-05-18T09:00:00.000Z", binder_id: "binder-calc", binder_title: "Calculus" }),
        studyItem({ id: "hard", status: "difficult", due_at: "2026-05-14T10:00:00.000Z", binder_id: "binder-history", binder_title: "History" }),
        studyItem({ id: "mastered", status: "mastered", due_at: "2026-06-01T09:00:00.000Z" }),
      ],
      baseNow,
    );

    expect(buckets.dueToday.map((item) => item.id)).toEqual(["due", "hard"]);
    expect(buckets.upcoming.map((item) => item.id)).toEqual(["upcoming"]);
    expect(buckets.difficult.map((item) => item.id)).toEqual(["hard"]);
    expect(buckets.mastered.map((item) => item.id)).toEqual(["mastered"]);
    expect(buckets.byBinder.map((group) => [group.label, group.items.length])).toEqual([
      ["Calculus", 2],
      ["History", 1],
      ["Unfiled", 1],
    ]);
  });

  it("summarizes a study session without storing private response text", () => {
    const summary = buildStudySessionSummary({
      events: [
        { item_id: "one", rating: "good", due_at_after: "2026-05-17T12:00:00.000Z" },
        { item_id: "two", rating: "hard", due_at_after: "2026-05-15T12:00:00.000Z" },
      ],
      items: [
        studyItem({ id: "one", prompt: "Explain the limit definition." }),
        studyItem({ id: "two", prompt: "Derivative sign mistake", status: "difficult" }),
      ],
      now: baseNow,
    });

    expect(summary.itemsReviewed).toBe(2);
    expect(summary.hardItems).toEqual(["Derivative sign mistake"]);
    expect(summary.nextDue).toBe("2026-05-15T12:00:00.000Z");
    expect(summary.suggestedNextStep).toContain("Review the hard items");
  });
});

function studyItem(patch: Partial<StudyItem> = {}): StudyItem {
  return {
    id: "item-1",
    owner_id: "user-1",
    type: "free_response",
    prompt: "Explain this in your own words.",
    answer: "A clear explanation.",
    source_kind: "note",
    source_id: "note-1",
    source_title: "Limits note",
    source_excerpt: "Limits describe behavior near a value.",
    binder_id: null,
    binder_title: null,
    course_id: null,
    course_title: null,
    due_at: "2026-05-14T12:00:00.000Z",
    status: "due",
    mastery: 0,
    review_count: 0,
    lapse_count: 0,
    created_at: "2026-05-14T12:00:00.000Z",
    updated_at: "2026-05-14T12:00:00.000Z",
    ...patch,
  };
}
