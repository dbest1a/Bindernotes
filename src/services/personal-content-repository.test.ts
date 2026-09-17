import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savePersonalContent } from "./personal-content-repository";
import { saveQueue } from "@/lib/save-queue";
import { ContentConflictError, type SaveOperation } from "@/lib/revisioned-save";
import type { PersonalContentSnapshot } from "@/lib/personal-content-contract";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));
const snapshot: PersonalContentSnapshot = {
  kind: "note",
  id: "note-id",
  ownerId: "A",
  title: "Draft",
  content: { type: "doc", content: [] },
  mathBlocks: [],
  tags: ["revision"],
  tagsInput: "revision",
  pinned: false,
  binderId: null,
  folderId: null,
  documentId: null,
  lessonId: null,
};
const operation: SaveOperation<PersonalContentSnapshot> = {
  snapshot,
  expectedRevision: 7,
  localRevision: 9,
  operationId: "stable-operation",
};
beforeEach(() => {
  saveQueue.setAccount("A");
  mocks.rpc
    .mockReset()
    .mockResolvedValue({ data: { id: "note-id", owner_id: "A", revision: 8 }, error: null });
});
afterEach(() => saveQueue.setAccount(null));

describe("personal content RPC contract", () => {
  it.each(["note", "document", "learner-note"] as const)(
    "uses only the %s kind's permitted fields and preserves request identity",
    async (kind) => {
      await savePersonalContent({ ...operation, snapshot: { ...snapshot, kind } });
      const parameters = mocks.rpc.mock.calls[0][1];
      expect(parameters).toMatchObject({
        p_kind: kind,
        p_expected_revision: 7,
        p_operation_id: "stable-operation",
      });
      const common = ["id", "owner_id", "title", "content", "math_blocks", "pinned", "binder_id"];
      const extras =
        kind === "note"
          ? ["folder_id", "document_id", "tags"]
          : kind === "document"
            ? ["tags"]
            : ["folder_id", "lesson_id"];
      expect(Object.keys(parameters.p_record).sort()).toEqual([...common, ...extras].sort());
    },
  );
  it("does not send an old account's operation under the next user's session", async () => {
    saveQueue.setAccount("B");
    await expect(savePersonalContent(operation)).rejects.toThrow("account that owns");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("surfaces a server conflict distinctly and does not retry over it", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "40001", message: "CONTENT_REVISION_CONFLICT" },
    });
    await expect(savePersonalContent(operation)).rejects.toBeInstanceOf(ContentConflictError);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects unsafe persisted attributes before submitting content", async () => {
    await expect(
      savePersonalContent({
        ...operation,
        snapshot: {
          ...snapshot,
          content: { type: "doc", content: [{ type: "image", attrs: { src: "javascript:alert(1)" } }] },
        },
      }),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects a mismatched server acknowledgement", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "other-note", owner_id: "A", revision: 8 }, error: null });
    await expect(savePersonalContent(operation)).rejects.toThrow("did not match");
  });
});
