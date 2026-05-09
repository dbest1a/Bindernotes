import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deterministicRecallDraftProviders } from "@/lib/recall/recall-draft-providers";

const sourceFiles = [
  "src/components/workspace/recall-lab.tsx",
  "src/lib/recall/recall-types.ts",
  "src/lib/recall/recall-draft-providers.ts",
  "src/lib/recall/recall-scheduler.ts",
];

function sourceText() {
  return sourceFiles.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
}

describe("Recall Lab product safety", () => {
  it("uses original BinderNotes naming and does not include competitor branding or content flows", () => {
    const text = sourceText();

    expect(text).not.toContain("Quizlet");
    expect(text).not.toContain("quizlet");
    expect(text).not.toContain("public deck");
    expect(text).not.toContain("import deck");
  });

  it("does not add product-visible generation or grading integrations", () => {
    const text = sourceText();
    const forbidden = [
      "Generate with AI",
      "Ask AI",
      "AI flashcards",
      "AI tutor",
      "AI coach",
      "OpenAI",
      "Anthropic",
      "Gemini",
      "LLM",
      "aiModel",
      "aiConfidence",
      "generatedByAI",
      "tokenUsage",
    ];

    for (const phrase of forbidden) {
      expect(text).not.toContain(phrase);
    }
  });

  it("registers deterministic draft providers only", () => {
    expect(deterministicRecallDraftProviders.map((provider) => provider.id)).toEqual([
      "manualCardProvider",
      "selectedTextDraftProvider",
      "highlightDraftProvider",
      "noteDraftProvider",
      "stickyDraftProvider",
      "subjectToolDraftProvider",
    ]);
  });
});
