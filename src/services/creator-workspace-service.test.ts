// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { saveQueue } from "@/lib/save-queue";
import {
  creatorBinder,
  creatorCloudFixture,
  creatorLesson,
  creatorProfile,
} from "@/test/creator-cloud-fixture";
import { reviewOwnerB } from "@/test/review-cloud-fixture";
import {
  creatorBinderInputSchema,
  creatorLessonInputSchema,
  getCreatorAccess,
  listCreatorBinders,
  listCreatorLessons,
  saveCreatorBinder,
  saveCreatorLesson,
} from "./creator-workspace-service";
const transport = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: transport }));
let db: ReturnType<typeof creatorCloudFixture>;
beforeEach(() => {
  db = creatorCloudFixture();
  saveQueue.setAccount(creatorProfile.id);
  transport.from.mockImplementation(db.from);
});
afterEach(() => saveQueue.setAccount(null));
const binderInput = () =>
  creatorBinderInputSchema.parse(
    Object.fromEntries(
      Object.keys(creatorBinderInputSchema.shape).map((key) => [
        key,
        creatorBinder[key as keyof typeof creatorBinder],
      ]),
    ),
  );
const lessonInput = () =>
  creatorLessonInputSchema.parse(
    Object.fromEntries(
      Object.keys(creatorLessonInputSchema.shape).map((key) => [
        key,
        creatorLesson[key as keyof typeof creatorLesson],
      ]),
    ),
  );
it("separates free learners, active creators, expired creators and operators without changing profile role", async () => {
  expect(await getCreatorAccess(creatorProfile)).toEqual({ allowed: true, operator: false });
  for (const patch of [
    { plan: "free" },
    { plan: "plus" },
    { status: "inactive" },
    { valid_until: "2000-01-01T00:00:00.000Z" },
  ]) {
    db.tables.account_entitlements[0] = {
      user_id: creatorProfile.id,
      plan: "studio",
      status: "active",
      valid_until: null,
      ...patch,
    };
    expect((await getCreatorAccess(creatorProfile)).allowed).toBe(false);
    await expect(listCreatorBinders(creatorProfile)).rejects.toThrow(/entitlement/);
  }
  expect(await getCreatorAccess({ ...creatorProfile, role: "admin" })).toEqual({
    allowed: true,
    operator: true,
  });
  expect(creatorProfile.role).toBe("learner");
});
it("lists only independent owned binders and requests lesson metadata without bodies", async () => {
  expect(await listCreatorBinders(creatorProfile)).toEqual([creatorBinder]);
  await listCreatorLessons(creatorProfile, creatorBinder.id);
  expect(db.selections).toContain("id,binder_id,title,order_index,is_preview,created_at,updated_at");
  await expect(listCreatorLessons(creatorProfile, "binder-foreign")).rejects.toThrow(/unavailable/);
  await expect(listCreatorLessons(creatorProfile, "binder-system")).rejects.toThrow(/unavailable/);
  db.bypassFilter = true;
  await expect(listCreatorBinders(creatorProfile)).rejects.toThrow(/own independent/);
});
it("publishes owned binders and rejects stale metadata/lesson writes without losing saved work", async () => {
  const published = await saveCreatorBinder(
    creatorProfile,
    { ...binderInput(), status: "published" },
    creatorBinder.updated_at,
  );
  expect(published.status).toBe("published");
  await expect(
    saveCreatorBinder(creatorProfile, { ...binderInput(), title: "Stale title" }, creatorBinder.updated_at),
  ).rejects.toThrow(/another tab or device/);
  const saved = await saveCreatorLesson(
    creatorProfile,
    { ...lessonInput(), title: "Updated limits" },
    creatorLesson.updated_at,
  );
  await expect(
    saveCreatorLesson(creatorProfile, { ...lessonInput(), title: "Stale limits" }, creatorLesson.updated_at),
  ).rejects.toThrow(/another tab or device/);
  expect(db.tables.binder_lessons[0].title).toBe(saved.title);
});
it("confirms a lost acknowledgement by stable ID and content and does not duplicate a lesson", async () => {
  db.loseAcknowledgement = true;
  const saved = await saveCreatorLesson(creatorProfile, { ...lessonInput(), id: "new-stable-id" }, null);
  expect(saved.id).toBe("new-stable-id");
  expect(db.tables.binder_lessons).toHaveLength(2);
});
it("fails closed on server denial, unsafe documents and account changes", async () => {
  db.denyWrites = true;
  await expect(
    saveCreatorLesson(creatorProfile, { ...lessonInput(), title: "Not saved" }, creatorLesson.updated_at),
  ).rejects.toThrow(/could not be confirmed/);
  db.denyWrites = false;
  await expect(
    saveCreatorLesson(
      creatorProfile,
      { ...lessonInput(), content: { type: "doc", attrs: { onclick: "unsafe" } } },
      creatorLesson.updated_at,
    ),
  ).rejects.toThrow();
  saveQueue.setAccount(reviewOwnerB);
  await expect(listCreatorBinders(creatorProfile)).rejects.toThrow(/owns/);
});
