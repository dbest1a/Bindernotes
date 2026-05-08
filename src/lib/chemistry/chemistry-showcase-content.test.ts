import { describe, expect, it } from "vitest";
import {
  CHEMISTRY_SHOWCASE_BINDER_ID,
  CHEMISTRY_SHOWCASE_FOLDER_ID,
  CHEMISTRY_SHOWCASE_LESSON_IDS,
  chemistryShowcaseBinder,
  chemistryShowcaseFolder,
  chemistryShowcaseFolderLink,
  chemistryShowcaseLessonMetadata,
  chemistryShowcaseLessons,
  getChemistryShowcasePresetForLesson,
} from "@/lib/chemistry/chemistry-showcase-content";

describe("chemistry showcase content", () => {
  it("defines the stable Chemistry folder and showcase binder without touching user notes", () => {
    expect(chemistryShowcaseFolder.id).toBe(CHEMISTRY_SHOWCASE_FOLDER_ID);
    expect(chemistryShowcaseFolder.name).toBe("Chemistry");
    expect(chemistryShowcaseBinder.id).toBe(CHEMISTRY_SHOWCASE_BINDER_ID);
    expect(chemistryShowcaseBinder.title).toBe("Chemistry 101 Showcase: Atoms, Reactions, and Acid-Base Labs");
    expect(chemistryShowcaseFolderLink.folder_id).toBe(CHEMISTRY_SHOWCASE_FOLDER_ID);
    expect(chemistryShowcaseFolderLink.binder_id).toBe(CHEMISTRY_SHOWCASE_BINDER_ID);
  });

  it("includes all 12 AP and Gen Chem aligned lessons", () => {
    expect(chemistryShowcaseLessons.map((lesson) => lesson.id)).toEqual([...CHEMISTRY_SHOWCASE_LESSON_IDS]);
    expect(chemistryShowcaseLessons).toHaveLength(12);
    expect(chemistryShowcaseLessonMetadata).toHaveLength(12);
    chemistryShowcaseLessonMetadata.forEach((metadata) => {
      expect(metadata.conceptTags.length).toBeGreaterThanOrEqual(3);
      expect(metadata.alignmentTags.join(" ")).toMatch(/AP|Gen Chem/);
      expect(getChemistryShowcasePresetForLesson(metadata.lessonId)).toBe(metadata.presetId);
    });
  });
});
