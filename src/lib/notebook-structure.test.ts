import { describe, expect, it } from "vitest";
import { emptyDoc } from "@/lib/utils";
import { buildBinderNotebookStructure } from "@/lib/notebook-structure";
import { demoBinders, demoLessons, demoNotes } from "@/lib/demo-data";
import type { Binder, BinderLesson } from "@/types";

describe("notebook structure", () => {
  it("builds section notebooks for the expanded Jacob binder", () => {
    const binder = demoBinders.find((item) => item.id === "binder-jacob-math-notes");
    const lessons = demoLessons.filter((lesson) => lesson.binder_id === "binder-jacob-math-notes");

    expect(binder).toBeDefined();
    expect(lessons).toHaveLength(27);

    const structure = buildBinderNotebookStructure({
      binder: binder!,
      lessons,
      notes: demoNotes,
      ownerId: "profile-learner-demo",
    });

    expect(structure.sections.map((section) => section.title)).toEqual([
      "Geometry and Trig",
      "Algebra 2 and Precalculus",
      "Calculus Core",
      "Multivariable Calculus",
      "Linear Algebra and Differential Equations",
      "Real Analysis",
    ]);
    expect(structure.sections[0]?.lessons).toHaveLength(5);
    expect(structure.sections[2]?.lessons[0]?.lesson.title).toContain("Calculus Limits");
    expect(structure.entries[0]?.sectionTitle).toBe("Geometry and Trig");
  });

  it("falls back to chunked sections for generic binders", () => {
    const binder: Binder = {
      id: "binder-generic",
      owner_id: "user-1",
      title: "Generic Binder",
      slug: "generic-binder",
      description: "",
      subject: "General",
      level: "Mixed",
      status: "published",
      price_cents: 0,
      cover_url: null,
      pinned: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };
    const lessons: BinderLesson[] = Array.from({ length: 7 }, (_, index) => ({
      id: `lesson-${index + 1}`,
      binder_id: binder.id,
      title: `Lesson ${index + 1}`,
      order_index: index + 1,
      content: emptyDoc(`Lesson ${index + 1}`),
      math_blocks: [],
      is_preview: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    }));

    const structure = buildBinderNotebookStructure({
      binder,
      lessons,
      notes: [],
      ownerId: "user-1",
    });

    expect(structure.sections).toHaveLength(2);
    expect(structure.sections[0]?.lessons).toHaveLength(4);
    expect(structure.sections[1]?.lessons).toHaveLength(3);
    expect(structure.sections[0]?.title).toBe("Section 1");
  });
});
