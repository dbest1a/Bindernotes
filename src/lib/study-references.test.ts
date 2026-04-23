import { describe, expect, it } from "vitest";
import { collectLessonSectionAnchors, findLessonSectionAnchorId, inferMathBlockLabel } from "@/lib/study-references";

describe("study references", () => {
  it("collects stable lesson anchors from headings", () => {
    const anchors = collectLessonSectionAnchors(
      {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Quadratic formula" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Example text" }],
          },
        ],
      },
      "lesson-quadratics",
    );

    expect(anchors[0]?.id).toBe("lesson-quadratics-quadratic-formula");
    expect(findLessonSectionAnchorId(anchors, "Quadratic formula", null)).toBe(
      "lesson-quadratics-quadratic-formula",
    );
  });

  it("infers a usable label for unlabeled formula blocks", () => {
    expect(
      inferMathBlockLabel({
        id: "quad",
        type: "latex",
        latex: "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}",
      }),
    ).toBe("Quadratic formula");
  });
});
