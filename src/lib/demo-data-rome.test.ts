import { describe, expect, it } from "vitest";
import { extractRenderablePlainText } from "@/lib/highlights";
import { demoBinders, demoConceptNodes, demoLessons } from "@/lib/demo-data";

describe("Rise of Rome demo binder", () => {
  it("keeps the existing Rome binder and expands it with history-suite sections", () => {
    const binder = demoBinders.find((candidate) => candidate.id === "binder-rise-of-rome");
    expect(binder?.title).toBe("Rise of Rome: From Myth to Empire");
    expect(binder?.slug).toBe("binder-rise-of-rome");

    const romeLessons = demoLessons.filter((lesson) => lesson.binder_id === "binder-rise-of-rome");
    expect(romeLessons).toHaveLength(10);

    const firstLessonText = extractRenderablePlainText(romeLessons[0].content);
    const mythLesson = romeLessons.find((lesson) => lesson.id === "lesson-rome-myth-vs-history");
    expect(mythLesson).toBeTruthy();
    const mythLessonText = extractRenderablePlainText(mythLesson!.content);
    const lastLessonText = extractRenderablePlainText(romeLessons[9].content);

    expect(firstLessonText).toContain("Rome in one timeline");
    expect(firstLessonText).toContain("Evidence locker: founding story");
    expect(mythLessonText).toContain("Featured myth checks");
    expect(lastLessonText).toContain("Build history, do not just memorize it");
  });

  it("removes video-style transcript remnants from the Rome binder", () => {
    const romeText = demoLessons
      .filter((lesson) => lesson.binder_id === "binder-rise-of-rome")
      .map((lesson) => extractRenderablePlainText(lesson.content).toLowerCase())
      .join("\n");

    for (const banned of ["freecash", "domino", "subscribe", "in this video", "channel", "giveaway", "pizza"]) {
      expect(romeText).not.toContain(banned);
    }
  });

  it("adds richer Rome concept cards for people, institutions, and turning points", () => {
    const romeNodes = demoConceptNodes.filter((node) => node.binder_id === "binder-rise-of-rome");
    const labels = romeNodes.map((node) => node.label);

    expect(labels).toContain("Julius Caesar");
    expect(labels).toContain("Augustus");
    expect(labels).toContain("Constantine");
    expect(labels).toContain("Praetorian Guard");
    expect(labels).toContain("Eastern Roman Empire");
  });
});
