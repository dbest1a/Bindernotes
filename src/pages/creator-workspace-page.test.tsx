// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { saveQueue } from "@/lib/save-queue";
import { listCreatorDrafts } from "@/lib/creator-drafts";
import { creatorCloudFixture, creatorProfile } from "@/test/creator-cloud-fixture";
import { reviewOwnerB } from "@/test/review-cloud-fixture";
import { CreatorWorkspacePage } from "./creator-workspace-page";
import type { Profile } from "@/types";
import type { JSONContent } from "@tiptap/react";
const transport = vi.hoisted(() => ({ from: vi.fn(), profile: null as Profile | null }));
vi.mock("@/lib/supabase", () => ({ supabase: transport }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ profile: transport.profile }) }));
vi.mock("@/components/editor/rich-text-editor", () => ({
  RichTextEditor: ({
    value,
    onChange,
    editable,
  }: {
    value: JSONContent;
    onChange: (value: JSONContent) => void;
    editable: boolean;
  }) => (
    <textarea
      aria-label="Lesson body"
      disabled={!editable}
      value={value.content?.[0]?.content?.[0]?.text ?? ""}
      onChange={(event) =>
        onChange({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: event.target.value }] }],
        })
      }
    />
  ),
}));
vi.mock("@/components/math/math-blocks", () => ({ MathBlocks: () => <div>Math blocks</div> }));
let db: ReturnType<typeof creatorCloudFixture>;
beforeEach(() => {
  window.localStorage.clear();
  db = creatorCloudFixture();
  transport.from.mockImplementation(db.from);
  transport.profile = creatorProfile;
  saveQueue.setAccount(creatorProfile.id);
});
afterEach(() => {
  cleanup();
  saveQueue.setAccount(null);
});
function page() {
  return render(
    <MemoryRouter>
      <CreatorWorkspacePage />
    </MemoryRouter>,
  );
}
it("keeps creator tools inaccessible to a free learner", async () => {
  db.tables.account_entitlements = [];
  page();
  await screen.findByText("Creator access required");
  expect(screen.queryByRole("button", { name: "New creator binder" })).toBeNull();
  expect(screen.queryByText("Admin studio")).toBeNull();
});
it("lets a paid creator create and publish an owned binder without operator controls", async () => {
  page();
  await screen.findByTestId("creator-workspace");
  expect(screen.queryByText(/binder-foreign|binder-system|Seed system|Diagnostics|Admin studio/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "New creator binder" }));
  fireEvent.change(screen.getByLabelText("Binder title"), { target: { value: "My own study course" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish binder" }));
  await screen.findByText("Saved “My own study course” as published.");
  expect(db.tables.binders.find((binder) => binder.title === "My own study course")).toMatchObject({
    owner_id: creatorProfile.id,
    status: "published",
    suite_template_id: null,
  });
  expect(listCreatorDrafts(creatorProfile.id).drafts).toEqual([]);
});
it("retains a failed lesson edit across remount and saves it on retry", async () => {
  const first = page();
  fireEvent.click(await screen.findByRole("button", { name: "My calculus · draft" }));
  fireEvent.click(await screen.findByRole("button", { name: "1. Limits" }));
  fireEvent.change(await screen.findByLabelText("Lesson body"), {
    target: { value: "My unsaved limit explanation" },
  });
  db.denyWrites = true;
  fireEvent.click(screen.getByRole("button", { name: "Save lesson" }));
  await screen.findByRole("alert");
  expect(screen.getByDisplayValue("My unsaved limit explanation")).toBeTruthy();
  first.unmount();
  db.denyWrites = false;
  page();
  fireEvent.click(await screen.findByRole("button", { name: "Resume Limits" }));
  expect(await screen.findByDisplayValue("My unsaved limit explanation")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save lesson" }));
  await screen.findByText("Saved “Limits”.");
  expect(JSON.stringify(db.tables.binder_lessons[0].content)).toContain("My unsaved limit explanation");
});
it("preserves a conflicting local edit as a copy before reloading the account version", async () => {
  page();
  fireEvent.click(await screen.findByRole("button", { name: "My calculus · draft" }));
  fireEvent.change(screen.getByLabelText("Binder title"), { target: { value: "My device title" } });
  db.tables.binders[0] = {
    ...db.tables.binders[0],
    title: "Other device title",
    updated_at: "2026-09-17T12:00:00.000Z",
  };
  fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
  await screen.findByRole("alert");
  expect(screen.getByDisplayValue("My device title")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reload account version and keep a draft copy" }));
  await screen.findByDisplayValue("Other device title");
  expect(
    listCreatorDrafts(creatorProfile.id).drafts.some(
      (draft) => draft.input.title === "My device title (recovered)" && draft.expectedUpdatedAt === null,
    ),
  ).toBe(true);
});
it("resets the editor and hides account A drafts after an account switch", async () => {
  const view = page();
  await screen.findByTestId("creator-workspace");
  fireEvent.click(screen.getByRole("button", { name: "New creator binder" }));
  fireEvent.change(screen.getByLabelText("Binder title"), { target: { value: "Private A draft" } });
  saveQueue.setAccount(reviewOwnerB);
  transport.profile = { ...creatorProfile, id: reviewOwnerB };
  db.tables.account_entitlements = [];
  view.rerender(
    <MemoryRouter>
      <CreatorWorkspacePage />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.queryByDisplayValue("Private A draft")).toBeNull());
  await screen.findByText("Creator access required");
});
