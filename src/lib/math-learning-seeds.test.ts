import { describe, expect, it } from "vitest";
import {
  mathSeedChoices,
  mathSeedCourses,
  mathSeedModules,
  mathSeedQuestions,
  mathSeedTopics,
} from "@/lib/math-learning-seeds";

describe("math learning seeds", () => {
  it("uses deterministic unique ids for idempotent upserts", () => {
    const ids = [
      ...mathSeedCourses,
      ...mathSeedTopics,
      ...mathSeedModules,
      ...mathSeedQuestions,
      ...mathSeedChoices,
    ].map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the required calculus courses and Jacob Math Notes modules", () => {
    expect(mathSeedCourses.map((course) => course.slug)).toEqual([
      "ap-calculus-ab",
      "ap-calculus-bc",
      "calculus-1",
      "calculus-2",
      "calculus-3",
      "jacob-math-notes",
    ]);
    expect(mathSeedModules.map((module) => module.slug)).toEqual(
      expect.arrayContaining([
        "derivative-as-slope",
        "taylor-polynomial-explorer",
        "surface-and-tangent-plane-explorer",
        "jacob-geometry-transformations",
        "jacob-multivariable-surfaces",
        "jacob-real-analysis-sequence-limits",
      ]),
    );
    expect(mathSeedTopics.filter((topic) => topic.course_id === "course-jacob-math-notes")).toHaveLength(8);
  });
});
