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
import type { JSONContent } from "@tiptap/react";

function extractText(content: JSONContent | JSONContent[] | undefined): string {
  if (!content) {
    return "";
  }

  if (Array.isArray(content)) {
    return content.map((node) => extractText(node)).join(" ");
  }

  return `${content.text ?? ""} ${extractText(content.content)}`.replace(/\s+/g, " ").trim();
}

const requiredUnitTitles = [
  "Unit 0 - Chemistry Toolkit / Foundations",
  "Unit 1 - Atomic Structure and Periodic Properties",
  "Unit 2 - Chemical Bonding and Compound Structure",
  "Unit 3 - Intermolecular Forces, Gases, Solutions, and Mixtures",
  "Unit 4 - Chemical Reactions and Stoichiometry",
  "Unit 5 - Kinetics",
  "Unit 6 - Thermochemistry",
  "Unit 7 - Equilibrium",
  "Unit 8 - Acids and Bases",
  "Unit 9 - Thermodynamics and Electrochemistry",
  "Unit 10 - AP Chemistry Exam Skills and Final Review",
];

describe("chemistry showcase content", () => {
  it("defines the stable Chemistry folder and full Chemistry 101 + AP Chemistry binder without touching user notes", () => {
    expect(chemistryShowcaseFolder.id).toBe(CHEMISTRY_SHOWCASE_FOLDER_ID);
    expect(chemistryShowcaseFolder.name).toBe("Chemistry");
    expect(chemistryShowcaseBinder.id).toBe(CHEMISTRY_SHOWCASE_BINDER_ID);
    expect(chemistryShowcaseBinder.title).toBe("Chemistry 101 + AP Chemistry");
    expect(chemistryShowcaseBinder.description.toLowerCase()).toContain("interactive study binder workspace");
    expect(chemistryShowcaseBinder.description.toLowerCase()).not.toContain("demo");
    expect(chemistryShowcaseBinder.description.toLowerCase()).not.toContain("showcase");
    expect(chemistryShowcaseBinder.description.toLowerCase()).not.toContain("ai textbooks replacing human authors");
    expect(chemistryShowcaseFolderLink.folder_id).toBe(CHEMISTRY_SHOWCASE_FOLDER_ID);
    expect(chemistryShowcaseFolderLink.binder_id).toBe(CHEMISTRY_SHOWCASE_BINDER_ID);
  });

  it("includes the complete AP and Gen Chem aligned unit spine", () => {
    expect(chemistryShowcaseLessons.map((lesson) => lesson.id)).toEqual([...CHEMISTRY_SHOWCASE_LESSON_IDS]);
    expect(chemistryShowcaseLessons).toHaveLength(77);
    expect(chemistryShowcaseLessonMetadata).toHaveLength(77);

    const unitTitles = [
      ...new Set(
        chemistryShowcaseLessonMetadata.map(
          (metadata) => (metadata as { unitTitle?: string }).unitTitle,
        ),
      ),
    ];

    expect(unitTitles).toEqual(requiredUnitTitles);
    chemistryShowcaseLessonMetadata.forEach((metadata) => {
      expect(metadata.conceptTags.length).toBeGreaterThanOrEqual(3);
      expect(metadata.alignmentTags.join(" ")).toMatch(/AP|Chem 101|Chem 102/);
      expect(getChemistryShowcasePresetForLesson(metadata.lessonId)).toBe(metadata.presetId);
    });
  });

  it("gives every lesson the required student-facing modules and original-practice sections", () => {
    const prohibited = /\b(todo|placeholder|coming soon|copied from|excerpt from|sample content|demo binder)\b/i;

    chemistryShowcaseLessons.forEach((lesson) => {
      const text = extractText(lesson.content);

      expect(text, lesson.title).toContain("Why this matters");
      expect(text, lesson.title).toContain("Study Workspace Transparency");
      expect(text, lesson.title).toContain(
        "This binder teaches standard chemistry concepts using original lessons and study tools. It is designed as a study support workspace, not a copied replacement for any textbook. Content should be reviewed for accuracy.",
      );
      expect(text, lesson.title).toContain("Human Review Status");
      expect(text, lesson.title).toContain("Source Ledger");
      expect(text, lesson.title).toContain("Learning objectives");
      expect(text, lesson.title).toContain("Prerequisites");
      expect(text, lesson.title).toContain("Source Lesson");
      expect(text, lesson.title).toContain("Quick Check");
      expect(text, lesson.title).toContain("Worked Example Module");
      expect(text, lesson.title).toContain("Practice Set");
      expect(text, lesson.title).toContain("AP Extension");
      expect(text, lesson.title).toContain("Vocab Sheet");
      expect(text, lesson.title).toContain("Formula Sheet");
      expect(text, lesson.title).toContain("Private Notes Prompts");
      expect(text, lesson.title).toContain("Whiteboard / Canvas Prompt");
      expect(text, lesson.title).toContain("Data / Lab Notebook Prompt");
      expect(text, lesson.title).toContain("Misconceptions");
      expect(text, lesson.title).toContain("Spaced Review Cards");
      expect(text, lesson.title).toContain("Related Concept Links");
      expect(text, lesson.title).toContain("Mastery Checklist");
      expect(text, lesson.title).toContain("Copyright Hygiene Check");
      expect(text, lesson.title).toContain("No copied textbook phrasing, copied problems, official AP question text, copied figures, copied tables, or copied labs are intentionally included.");
      expect(text.length, lesson.title).toBeGreaterThan(3200);
      expect(lesson.math_blocks.length, lesson.title).toBeGreaterThanOrEqual(1);
      expect(text, lesson.title).not.toMatch(prohibited);
      expect(text, lesson.title).not.toMatch(/\bofficial ap question\s*[:#]/i);
      expect(text.toLowerCase(), lesson.title).not.toContain("ai textbooks replacing human authors");
    });
  });

  it("uses chemistry-specific presets and modules across reading, practice, lab, AP, and studio work", () => {
    const presetIds = new Set(chemistryShowcaseLessonMetadata.map((metadata) => metadata.presetId));

    expect([...presetIds]).toEqual(
      expect.arrayContaining([
        "chem-guided-study",
        "chem-element-explorer",
        "chem-bonding-studio",
        "chem-reaction-studio",
        "chem-stoichiometry-lab",
        "chem-solutions-molarity-lab",
        "chem-acid-base-titration-lab",
        "chem-kinetics-graph-lab",
        "chem-thermochemistry-studio",
        "chem-full-studio",
        "chemistry-lab",
      ]),
    );

    const modules = new Set(
      chemistryShowcaseLessonMetadata.flatMap(
        (metadata) => (metadata as { moduleIds?: string[] }).moduleIds ?? [],
      ),
    );

    expect([...modules]).toEqual(
      expect.arrayContaining([
        "lesson",
        "private-notes",
        "formula-sheet",
        "flashcards",
        "whiteboard",
        "chem-periodic-table",
        "chem-reaction-balancer",
        "chem-stoichiometry-coach",
        "chem-titration-lab",
        "chem-lab-notebook",
        "chem-desmos-kinetics-plot",
      ]),
    );
  });
});
