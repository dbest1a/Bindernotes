import { describe, expect, it } from "vitest";
import {
  createFolderSummary,
  getBinderDocumentSummaries,
  getUnfiledBinders,
} from "@/lib/workspace-structure";
import {
  demoBinders,
  demoFolderBinders,
  demoFolders,
  demoLessons,
  demoNotes,
} from "@/lib/demo-data";

describe("workspace structure", () => {
  it("groups binders and documents into a folder summary", () => {
    const summary = createFolderSummary(
      demoFolders[0],
      demoBinders,
      demoFolderBinders,
      demoNotes,
      demoLessons,
    );

    expect(summary.binders.map((binder) => binder.id)).toContain("binder-calculus");
    expect(summary.notes.map((note) => note.id)).toContain("note-limits");
    expect(summary.lessons.map((lesson) => lesson.id)).toContain("lesson-limits");
  });

  it("returns binders without folder links as unfiled", () => {
    const unfiled = getUnfiledBinders(demoBinders, demoFolderBinders);

    expect(unfiled.map((binder) => binder.id)).toContain("binder-writing");
    expect(unfiled.map((binder) => binder.id)).not.toContain("binder-calculus");
  });

  it("builds document summaries with private note state", () => {
    const summaries = getBinderDocumentSummaries(
      demoLessons.filter((lesson) => lesson.binder_id === "binder-calculus"),
      demoNotes.filter((note) => note.binder_id === "binder-calculus"),
    );

    expect(summaries[0].lesson.id).toBe("lesson-limits");
    expect(summaries[0].hasPrivateNote).toBe(true);
    expect(summaries[1].hasPrivateNote).toBe(false);
  });
});
