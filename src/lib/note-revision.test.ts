import { describe, expect, it } from "vitest";
import { classifyIncomingNoteRevision, serializeNoteSnapshot } from "@/lib/note-revision";
import { emptyDoc } from "@/lib/utils";

describe("serializeNoteSnapshot", () => {
  it("treats jsonb key reordering as the same note", () => {
    const editor = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Combine like terms" }] }] };
    // Postgres returns jsonb keys shortest-first: {"text": …, "type": …}.
    const readBack = { content: [{ content: [{ text: "Combine like terms", type: "text" }], type: "paragraph" }], type: "doc" };
    const math = [{ id: "m1", type: "latex" as const, latex: "x^2" }];
    const mathReadBack = [{ id: "m1", latex: "x^2", type: "latex" as const }];

    expect(serializeNoteSnapshot("Notes", editor, math)).toBe(serializeNoteSnapshot("Notes", readBack, mathReadBack));
  });

  it("still distinguishes real edits", () => {
    expect(serializeNoteSnapshot("Notes", emptyDoc("a"), [])).not.toBe(serializeNoteSnapshot("Notes", emptyDoc("b"), []));
    expect(serializeNoteSnapshot("Notes", emptyDoc("a"), [])).not.toBe(serializeNoteSnapshot("Notes 2", emptyDoc("a"), []));
  });
});

describe("classifyIncomingNoteRevision", () => {
  const known = { id: "note-1", updatedAt: "2026-10-31T10:00:01.000Z" };

  it("recognizes a refetch that started before the latest save as older", () => {
    expect(classifyIncomingNoteRevision(known, { id: "note-1", updatedAt: "2026-10-31T10:00:00.000Z" })).toBe("older");
  });

  it("treats a missing row as older once this page knows a saved note", () => {
    expect(classifyIncomingNoteRevision(known, { updatedAt: null })).toBe("older");
    expect(classifyIncomingNoteRevision({ updatedAt: null }, { updatedAt: null })).toBe("same");
  });

  it("recognizes the same revision across timestamp formats", () => {
    expect(classifyIncomingNoteRevision(known, { id: "note-1", updatedAt: "2026-10-31T10:00:01+00:00" })).toBe("same");
    expect(classifyIncomingNoteRevision(known, { id: "note-1", updatedAt: "2026-10-31T10:00:01.000000+00:00" })).toBe("same");
  });

  it("orders Postgres microseconds within one millisecond", () => {
    const micro = { id: "note-1", updatedAt: "2026-10-31T10:00:01.000250+00:00" };
    expect(classifyIncomingNoteRevision(micro, { id: "note-1", updatedAt: "2026-10-31T10:00:01.000900+00:00" })).toBe("newer");
    expect(classifyIncomingNoteRevision(micro, { id: "note-1", updatedAt: "2026-10-31T10:00:01.000100+00:00" })).toBe("older");
  });

  it("treats newer, replaced, first-seen, and unknown-base rows as newer", () => {
    expect(classifyIncomingNoteRevision(known, { id: "note-1", updatedAt: "2026-10-31T10:00:02.000Z" })).toBe("newer");
    expect(classifyIncomingNoteRevision(known, { id: "note-2", updatedAt: "2026-10-31T09:00:00.000Z" })).toBe("newer");
    expect(classifyIncomingNoteRevision(undefined, { id: "note-1", updatedAt: known.updatedAt })).toBe("newer");
    expect(classifyIncomingNoteRevision({ updatedAt: null }, { id: "note-1", updatedAt: known.updatedAt })).toBe("newer");
    expect(classifyIncomingNoteRevision({ id: "note-1", updatedAt: null }, { id: "note-1", updatedAt: known.updatedAt })).toBe("newer");
    expect(classifyIncomingNoteRevision(known, { id: "note-1", updatedAt: "not a time" })).toBe("newer");
  });
});
