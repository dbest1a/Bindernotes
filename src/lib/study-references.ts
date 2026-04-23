import type { JSONContent } from "@tiptap/react";
import type { MathBlock } from "@/types";
import { slugify } from "@/lib/utils";

export type LessonSectionAnchor = {
  id: string;
  title: string;
  level: number;
  order: number;
};

export function buildLessonSectionAnchorId(
  lessonId: string,
  heading: string,
  occurrence = 0,
) {
  const headingSlug = slugify(heading) || "section";
  return occurrence > 0
    ? `${lessonId}-${headingSlug}-${occurrence + 1}`
    : `${lessonId}-${headingSlug}`;
}

export function collectLessonSectionAnchors(
  content: JSONContent,
  lessonId: string,
): LessonSectionAnchor[] {
  const anchors: LessonSectionAnchor[] = [];
  const occurrences = new Map<string, number>();

  const visit = (node: JSONContent) => {
    if (node.type === "heading") {
      const title = extractText(node).trim();
      if (title) {
        const normalized = normalizeReferenceText(title);
        const count = occurrences.get(normalized) ?? 0;
        occurrences.set(normalized, count + 1);
        anchors.push({
          id: buildLessonSectionAnchorId(lessonId, title, count),
          title,
          level: clampHeadingLevel(node.attrs?.level),
          order: anchors.length,
        });
      }
    }

    (node.content ?? []).forEach(visit);
  };

  visit(content);
  return anchors;
}

export function findLessonSectionAnchorId(
  anchors: LessonSectionAnchor[],
  sourceHeading?: string | null,
  sourceAnchorId?: string | null,
) {
  if (sourceAnchorId) {
    const exact = anchors.find((anchor) => anchor.id === sourceAnchorId);
    if (exact) {
      return exact.id;
    }
  }

  if (!sourceHeading) {
    return null;
  }

  const normalized = normalizeReferenceText(sourceHeading);
  return anchors.find((anchor) => normalizeReferenceText(anchor.title) === normalized)?.id ?? null;
}

export function inferMathBlockLabel(block: MathBlock) {
  if (block.label?.trim()) {
    return block.label.trim();
  }

  if (block.type === "graph") {
    const expressions = block.expressions.filter(Boolean);
    if (expressions.length === 0) {
      return "Graph reference";
    }
    if (expressions.some((expression) => expression.includes(">") || expression.includes("<"))) {
      return "Inequality graph";
    }
    if (expressions.some((expression) => expression.includes("sqrt") || expression.includes("ln") || expression.includes("1/x"))) {
      return "Function graph reference";
    }
    if (expressions.some((expression) => expression.includes("x^2"))) {
      return "Quadratic graph reference";
    }
    if (expressions.length >= 2) {
      return "Lesson graph comparison";
    }
    return simplifyExpressionLabel(expressions[0]);
  }

  const latex = block.latex.replace(/\s+/g, "");
  if (latex.includes("x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}")) {
    return "Quadratic formula";
  }
  if (latex.includes("\\sin^2\\theta+\\cos^2\\theta=1")) {
    return "Pythagorean identity";
  }
  if (latex.includes("1+\\tan^2\\theta=\\sec^2\\theta")) {
    return "Tangent identity";
  }
  if (latex.includes("\\sin\\theta=\\frac{opp}{hyp}") || latex.includes("\\cos\\theta=\\frac{adj}{hyp}")) {
    return "Trig ratios";
  }
  if (latex.includes("m=\\frac{y_2-y_1}{x_2-x_1}")) {
    return "Slope formula";
  }
  if (latex.includes("y=mx+b")) {
    return "Slope-intercept form";
  }
  if (latex.includes("a^3-b^3=(a-b)(a^2+ab+b^2)")) {
    return "Difference of cubes";
  }
  if (latex.includes("S_n=a\\frac{1-r^n}{1-r}")) {
    return "Geometric series sum";
  }
  if (latex.includes("(x-h)^2+(y-k)^2=r^2")) {
    return "Circle standard form";
  }
  if (latex.includes("A(t)=A_0(1+r)^t")) {
    return "Growth model";
  }
  if (latex.includes("\\lim_{x\\toa}f(x)=L")) {
    return "Limit notation";
  }
  if (latex.includes("\\log")) {
    return "Log rule";
  }
  if (latex.includes("x^2-9=(x-3)(x+3)")) {
    return "Difference of squares";
  }
  if (latex.includes("x^2+6x+5=(x+3)^2-4")) {
    return "Completed-square form";
  }
  if (latex.includes("6x^2+9x=3x(2x+3)")) {
    return "Greatest common factor";
  }
  if (latex.includes("3x+5x-2=8x-2")) {
    return "Combining like terms";
  }
  if (latex.includes("6-(x+3)=6-1(x+3)=6-x-3")) {
    return "Distributing a negative";
  }

  return block.type === "latex" ? "Formula reference" : "Graph reference";
}

export function normalizeReferenceText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function extractText(node: JSONContent): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  return (node.content ?? []).map((child) => extractText(child)).join("");
}

function clampHeadingLevel(level?: number) {
  if (!level || level < 1 || level > 6) {
    return 2;
  }

  return level;
}

function simplifyExpressionLabel(expression: string) {
  const cleaned = expression.replace(/^y\s*=\s*/i, "").trim();
  return cleaned ? `Graph of ${cleaned}` : "Graph reference";
}
