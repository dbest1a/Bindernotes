import { describe, expect, it } from "vitest";
import {
  createSearchQuery,
  getSearchHighlightSegments,
  matchesSearchText,
  normalizeSearchText,
  prepareSearchText,
  scoreSearchFields,
} from "@/lib/search/text-match";

describe("search text matching", () => {
  it("normalizes case, accents, apostrophes, and punctuation", () => {
    expect(normalizeSearchText("  Newton's  Laws — Équilibre!  ")).toBe("newtons laws equilibre");
    expect(normalizeSearchText(null)).toBe("");
  });

  it("matches every word in any order", () => {
    expect(matchesSearchText("math jacob", "Jacob Math Notes")).toBe(true);
    expect(matchesSearchText("notes jacob math", "Jacob Math Notes")).toBe(true);
    expect(matchesSearchText("jacob chemistry", "Jacob Math Notes")).toBe(false);
  });

  it("lets words match across a title and its context", () => {
    const query = createSearchQuery("rome founding");
    expect(scoreSearchFields(query, [{ text: "Founding Myth and Alba Longa" }, { text: "Rise of Rome" }])).not.toBeNull();
  });

  it("matches prefixes, inner word parts, initials, and words typed without spaces", () => {
    expect(matchesSearchText("quadr", "Completing the Square and Quadratics")).toBe(true);
    expect(matchesSearchText("synth", "Photosynthesis basics")).toBe(true);
    expect(matchesSearchText("hsm", "Hide side monitor")).toBe(true);
    expect(matchesSearchText("newnote", "New note")).toBe(true);
    expect(matchesSearchText("note", "knot eat")).toBe(false);
  });

  it("tolerates a small typo once words are long enough", () => {
    expect(matchesSearchText("quadratc", "Quadratics practice")).toBe(true);
    expect(matchesSearchText("qaudratic", "Quadratics practice")).toBe(true);
    expect(matchesSearchText("photosythesis", "Photosynthesis basics")).toBe(true);
    expect(matchesSearchText("roem", "Rise of Rome")).toBe(true);
  });

  it("does not let short words drift into unrelated neighbours", () => {
    expect(matchesSearchText("math", "Path of the river")).toBe(false);
    expect(matchesSearchText("cat", "Carbon cycle")).toBe(false);
    expect(matchesSearchText("rome", "Rise of Rose gardens")).toBe(false);
  });

  it("keeps filler words optional unless they are the whole query", () => {
    expect(matchesSearchText("the russian revolution", "Causes of Russian Revolution")).toBe(true);
    expect(matchesSearchText("the", "Causes of Russian Revolution")).toBe(false);
    expect(matchesSearchText("the", "The Russian Revolution")).toBe(true);
  });

  it("ranks exact and leading title matches above weaker ones", () => {
    const query = createSearchQuery("algebra");
    const exact = scoreSearchFields(query, [{ text: "Algebra" }]);
    const leading = scoreSearchFields(query, [{ text: "Algebra 1 Foundations" }]);
    const context = scoreSearchFields(query, [{ text: "Linear equations" }, { text: "Algebra 1 Foundations", weight: 0.7 }]);
    const typo = scoreSearchFields(createSearchQuery("algebar"), [{ text: "Algebra 1 Foundations" }]);

    expect(exact).toBeGreaterThan(leading ?? 0);
    expect(leading).toBeGreaterThan(context ?? 0);
    expect(context).toBeGreaterThan(typo ?? 0);
    expect(typo).not.toBeNull();
  });

  it("skips typo tolerance for fields that opt out, such as long bodies", () => {
    const query = createSearchQuery("mitochondira");
    expect(scoreSearchFields(query, [{ text: "Cell notes" }, { text: "The mitochondria makes energy", typos: false }])).toBeNull();
    expect(scoreSearchFields(query, [{ text: "Cell notes" }, { text: "The mitochondria makes energy" }])).not.toBeNull();
  });

  it("returns a neutral score for an empty query", () => {
    expect(scoreSearchFields(createSearchQuery("   "), [{ text: "Anything" }])).toBe(0);
    expect(prepareSearchText("").words).toEqual([]);
  });

  it("highlights matched word starts and inner parts in the original text", () => {
    const segments = getSearchHighlightSegments("Rise of Rome: Équilibre", createSearchQuery("rom equi"));
    expect(segments.filter((segment) => segment.match).map((segment) => segment.text)).toEqual(["Rom", "Équi"]);
    expect(segments.map((segment) => segment.text).join("")).toBe("Rise of Rome: Équilibre");
  });

  it("does not highlight single letters inside words", () => {
    const segments = getSearchHighlightSegments("Data analysis", createSearchQuery("a"));
    expect(segments.filter((segment) => segment.match).map((segment) => segment.text)).toEqual(["a"]);
  });
});
