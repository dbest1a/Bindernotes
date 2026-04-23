import { describe, expect, it } from "vitest";
import { extractRenderablePlainText } from "@/lib/highlights";
import { demoBinders, demoConceptNodes, demoLessons } from "@/lib/demo-data";
import {
  riseOfRomeEventTemplates,
  riseOfRomeMythCheckTemplates,
  riseOfRomeSourceTemplates,
} from "@/lib/history-suite-seeds";

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

    expect(romeLessons.map((lesson) => lesson.title)).toEqual([
      "Start Here: Build Rome, Don't Just Memorize It",
      "Mythic Origins and the Kings",
      "Republic and Expansion in Italy",
      "Punic Wars and Mediterranean Power",
      "Crisis of the Republic",
      "Augustus and the Early Empire",
      "Crisis, Constantine, and Division",
      "Fall of the Western Empire",
      "Myth vs History: Separating Story, Evidence, and Interpretation",
      "Why Rome Matters: Institutions, Memory, and Modern Echoes",
    ]);
    expect(firstLessonText).toContain("Start with the timeline");
    expect(firstLessonText).toContain("Open Myth vs History");
    expect(firstLessonText).toContain("Republic to Empire argument chain");
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
    expect(labels).toContain("Patricians");
    expect(labels).toContain("Plebeians");
    expect(labels).toContain("Punic Wars");
    expect(labels).toContain("Byzantine Empire");
  });

  it("includes a full Rome timeline, evidence set, and myth checks for the History Suite", () => {
    const eventTitles = riseOfRomeEventTemplates.map((event) => event.title);
    const sourceClaims = riseOfRomeSourceTemplates.map((source) => source.claim_supports);
    const mythTexts = riseOfRomeMythCheckTemplates.map((myth) => myth.myth_text);

    expect(eventTitles).toEqual(
      expect.arrayContaining([
        "Aeneas and the Trojan origin tradition",
        "Romulus and Remus mythic origins",
        "Rome controls Italy",
        "Marius and Sulla militarize politics",
        "Pax Romana and the early empire",
        "Trajan's maximum extent",
        "Diocletian's reforms",
        "Second sack of Rome",
      ]),
    );
    expect(sourceClaims).toEqual(
      expect.arrayContaining([
        "The Republic formed in opposition to monarchy.",
        "Overseas expansion increased wealth but destabilized Roman politics.",
        "Roman civilization did not simply vanish because the Eastern Roman Empire continued.",
      ]),
    );
    expect(mythTexts).toEqual(
      expect.arrayContaining([
        "Romulus and Remus prove the literal details of Rome's founding.",
        "The Republic naturally became the Empire because Rome simply got bigger.",
        "Roman civilization disappeared after the western collapse.",
      ]),
    );
  });
});
