import { describe, expect, it } from "vitest";
import { activePersonalTree } from "./personal-trash";
import type { PersonalNote, PersonalNoteBinder, PersonalNoteDocument, PersonalNoteFolder } from "@/types";
const tree = {
  personalFolders: [{ id: "folder", archived_at: null } as PersonalNoteFolder],
  personalBinders: [{ id: "course", folder_id: "folder", archived_at: null } as PersonalNoteBinder],
  personalDocuments: [{ id: "doc", binder_id: "course", archived_at: null }, { id: "old-doc", binder_id: "course", archived_at: "yesterday" }] as PersonalNoteDocument[],
  personalNotes: [{ id: "note", folder_id: null, binder_id: "course", document_id: "doc", archived_at: null }, { id: "loose", folder_id: null, binder_id: null, document_id: null, archived_at: null }] as PersonalNote[],
};
describe("personal trash trees", () => {
  it("hides a trashed course and descendants without mutating relationships", () => {
    const changed = { ...tree, personalBinders: [{ ...tree.personalBinders[0], archived_at: "today" }] };
    const result = activePersonalTree(changed);
    expect(result.personalBinders).toEqual([]); expect(result.personalDocuments).toEqual([]);
    expect(result.personalNotes.map(item => item.id)).toEqual(["loose"]);
    expect(changed.personalDocuments[0].binder_id).toBe("course");
    expect(activePersonalTree(tree).personalDocuments.map(item => item.id)).toEqual(["doc"]);
  });
  it("hides a folder tree and leaves individually archived children archived after restore", () => {
    expect(activePersonalTree({ ...tree, personalFolders: [{ ...tree.personalFolders[0], archived_at: "today" }] }).personalDocuments).toEqual([]);
    expect(activePersonalTree(tree).personalDocuments.map(item => item.id)).toEqual(["doc"]);
  });
});
