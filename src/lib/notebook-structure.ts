import { extractRenderablePlainText } from "@/lib/highlights";
import type {
  Binder,
  BinderLesson,
  BinderNotebookLessonEntry,
  BinderNotebookSection,
  LearnerNote,
} from "@/types";

type NotebookSectionSeed = {
  id: string;
  title: string;
  description: string;
  startOrder: number;
  endOrder: number;
};

export function buildBinderNotebookStructure({
  binder,
  lessons,
  notes,
  ownerId,
}: {
  binder: Binder;
  lessons: BinderLesson[];
  notes: LearnerNote[];
  ownerId: string;
}) {
  const lessonsInOrder = [...lessons].sort((left, right) => left.order_index - right.order_index);
  const notesByLessonId = new Map(
    notes
      .filter((note) => note.owner_id === ownerId)
      .map((note) => [note.lesson_id, note] as const),
  );

  const sectionSeeds = resolveNotebookSectionSeeds(binder, lessonsInOrder);
  const entries = lessonsInOrder.map((lesson) => {
    const note = notesByLessonId.get(lesson.id) ?? null;
    const matchingSection =
      sectionSeeds.find(
        (section) =>
          lesson.order_index >= section.startOrder && lesson.order_index <= section.endOrder,
      ) ?? sectionSeeds[sectionSeeds.length - 1];
    const plainText = note ? normalizePlainText(note.content) : "";

    return {
      lesson,
      note,
      excerpt: buildExcerpt(plainText),
      wordCount: countWords(plainText),
      mathBlockCount: note?.math_blocks.length ?? 0,
      updatedAt: note?.updated_at ?? null,
      sectionId: matchingSection.id,
      sectionTitle: matchingSection.title,
      sectionDescription: matchingSection.description,
      sectionOrderIndex: sectionSeeds.indexOf(matchingSection),
    } satisfies BinderNotebookLessonEntry;
  });

  const sections = sectionSeeds
    .map((section, index) => {
      const sectionLessons = entries.filter((entry) => entry.sectionId === section.id);
      const firstSavedEntry = sectionLessons.find((entry) => Boolean(entry.note));
      const updatedAt = latestTimestamp(sectionLessons.map((entry) => entry.updatedAt));

      return {
        id: section.id,
        title: section.title,
        description: section.description,
        orderIndex: index,
        excerpt:
          firstSavedEntry?.excerpt ||
          `Keep ${sectionLessons.length} lesson${sectionLessons.length === 1 ? "" : "s"} together in one notebook lane.`,
        noteCount: sectionLessons.filter((entry) => Boolean(entry.note)).length,
        totalWords: sectionLessons.reduce((sum, entry) => sum + entry.wordCount, 0),
        totalMathBlocks: sectionLessons.reduce((sum, entry) => sum + entry.mathBlockCount, 0),
        updatedAt,
        lessons: sectionLessons,
      } satisfies BinderNotebookSection;
    })
    .filter((section) => section.lessons.length > 0);

  return {
    entries,
    sections,
  };
}

function resolveNotebookSectionSeeds(binder: Binder, lessons: BinderLesson[]): NotebookSectionSeed[] {
  if (binder.id === "binder-jacob-math-notes") {
    return [
      {
        id: "geometry-trig",
        title: "Geometry and Trig",
        description: "Core geometry language, triangle reasoning, circles, and trigonometric setup.",
        startOrder: 1,
        endOrder: 5,
      },
      {
        id: "algebra-precalculus",
        title: "Algebra 2 and Precalculus",
        description: "Polynomials, logarithms, rational functions, matrices, vectors, and series foundations.",
        startOrder: 6,
        endOrder: 10,
      },
      {
        id: "calculus-core",
        title: "Calculus Core",
        description: "Limits, derivatives, integrals, and the first full arc of single-variable calculus.",
        startOrder: 11,
        endOrder: 16,
      },
      {
        id: "multivariable",
        title: "Multivariable Calculus",
        description: "Vector algebra, partial derivatives, optimization, and multivariable integration.",
        startOrder: 17,
        endOrder: 19,
      },
      {
        id: "linear-differential",
        title: "Linear Algebra and Differential Equations",
        description: "Systems, eigen-ideas, orthogonality, Fourier tools, and differential-equation structure.",
        startOrder: 20,
        endOrder: 23,
      },
      {
        id: "analysis",
        title: "Real Analysis",
        description: "Sequences, continuity, convergence, differentiation, and integration from a proof-first angle.",
        startOrder: 24,
        endOrder: 27,
      },
    ];
  }

  if (binder.id === "binder-algebra-foundations") {
    return [
      {
        id: "expression-building",
        title: "Expression Building",
        description: "Foundations for simplifying, multiplying, and factoring algebraic expressions.",
        startOrder: 1,
        endOrder: 3,
      },
      {
        id: "quadratics-functions",
        title: "Quadratics and Functions",
        description: "Core function thinking, quadratics, slope, and line relationships.",
        startOrder: 4,
        endOrder: 6,
      },
      {
        id: "systems-review",
        title: "Systems and Review",
        description: "Inequalities, systems, and the binder-wide vocabulary and formula bank.",
        startOrder: 7,
        endOrder: 9,
      },
    ];
  }

  if (binder.id === "binder-calculus") {
    return [
      {
        id: "core-calculus",
        title: "Core Calculus Ideas",
        description: "Limits, derivatives, and the central interpretation work behind them.",
        startOrder: 1,
        endOrder: Math.max(1, lessons.length),
      },
    ];
  }

  if (binder.id === "binder-writing") {
    return [
      {
        id: "teach-back-notebook",
        title: "Teach-back Notebook",
        description: "Capture explain-it-back notes, examples, and revisions in one notebook lane.",
        startOrder: 1,
        endOrder: Math.max(1, lessons.length),
      },
    ];
  }

  if (lessons.length <= 4) {
    return [
      {
        id: "full-binder",
        title: `${binder.title} notebook`,
        description: "A single notebook view across the whole binder.",
        startOrder: lessons[0]?.order_index ?? 1,
        endOrder: lessons[lessons.length - 1]?.order_index ?? 1,
      },
    ];
  }

  const sectionCount = lessons.length >= 12 ? 4 : lessons.length >= 8 ? 3 : 2;
  const chunkSize = Math.ceil(lessons.length / sectionCount);

  return Array.from({ length: sectionCount }, (_, index) => {
    const sliceStart = index * chunkSize;
    const sliceEnd = Math.min(lessons.length, sliceStart + chunkSize) - 1;
    const firstLesson = lessons[sliceStart];
    const lastLesson = lessons[sliceEnd];
    return {
      id: `section-${index + 1}`,
      title: `Section ${index + 1}`,
      description: `${firstLesson?.title ?? "Lesson"} through ${lastLesson?.title ?? "lesson"}.`,
      startOrder: firstLesson?.order_index ?? index * chunkSize + 1,
      endOrder: lastLesson?.order_index ?? firstLesson?.order_index ?? index * chunkSize + 1,
    } satisfies NotebookSectionSeed;
  });
}

function normalizePlainText(content: LearnerNote["content"]) {
  return extractRenderablePlainText(content).replace(/\s+/g, " ").trim();
}

function buildExcerpt(value: string) {
  if (!value) {
    return "";
  }

  return value.length > 180 ? `${value.slice(0, 180)}...` : value;
}

function countWords(value: string) {
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}

function latestTimestamp(values: Array<string | null>) {
  const timestamps = values.filter((value): value is string => Boolean(value));
  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.reduce((latest, current) =>
    Date.parse(current) > Date.parse(latest) ? current : latest,
  );
}
