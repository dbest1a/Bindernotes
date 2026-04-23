import { describe, expect, it } from "vitest";
import { currency, emptyDoc, slugify } from "@/lib/utils";

describe("utils", () => {
  it("creates stable binder slugs", () => {
    expect(slugify("Calculus I: Patterns Before Procedures")).toBe(
      "calculus-i-patterns-before-procedures",
    );
  });

  it("formats free and paid prices", () => {
    expect(currency(0)).toBe("Free");
    expect(currency(3900)).toBe("$39");
  });

  it("creates a valid empty Tiptap document", () => {
    expect(emptyDoc("hello")).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "hello" }],
        },
      ],
    });
  });
});
