import { describe, expect, it } from "vitest";
import { emptyDoc } from "@/lib/utils";
import {
  cleanAccidentalNotePrefix,
  detectAccidentalNotePrefix,
} from "@/lib/note-hygiene";
import { extractPlainText } from "@/lib/math-detection";

describe("note hygiene", () => {
  it("detects short repeated punctuation junk at the start of a lesson note", () => {
    const result = detectAccidentalNotePrefix(emptyDoc(";;;'';;mm The key idea is congruence."));

    expect(result).toEqual(
      expect.objectContaining({
        prefix: ";;;'';;mm ",
        reason: "accidental-prefix",
      }),
    );
  });

  it("does not flag normal student writing", () => {
    expect(detectAccidentalNotePrefix(emptyDoc("Rigid motions preserve length and angle measure."))).toBeNull();
  });

  it("removes only the accidental-looking prefix without deleting the real note", () => {
    const cleaned = cleanAccidentalNotePrefix(emptyDoc(";;;'';;mm Rigid motions preserve distances."), ";;;'';;mm ");

    expect(extractPlainText(cleaned)).toBe("Rigid motions preserve distances.");
  });
});
