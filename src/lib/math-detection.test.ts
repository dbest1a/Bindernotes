import { describe, expect, it } from "vitest";
import { detectMathSuggestions } from "@/lib/math-detection";
import { emptyDoc } from "@/lib/utils";

describe("detectMathSuggestions", () => {
  it("detects graphable expressions in note text", () => {
    const suggestions = detectMathSuggestions(
      emptyDoc("Let's compare y=x^2 and y=sin(x) in class."),
    );

    expect(suggestions.some((suggestion) => suggestion.kind === "graph")).toBe(true);
  });

  it("detects latex-like expressions for reusable math blocks", () => {
    const suggestions = detectMathSuggestions(
      emptyDoc("Use \\int_0^1 x^2 dx for the warmup."),
    );

    expect(suggestions.some((suggestion) => suggestion.kind === "latex")).toBe(true);
  });

  it("does not repeat expressions already stored as math blocks", () => {
    const suggestions = detectMathSuggestions(
      emptyDoc("Use y=x^2 in the note."),
      [
        {
          id: "graph-1",
          type: "graph",
          expressions: ["y=x^2"],
          xMin: -5,
          xMax: 5,
          yMin: -5,
          yMax: 5,
        },
      ],
    );

    expect(suggestions).toHaveLength(0);
  });
});
