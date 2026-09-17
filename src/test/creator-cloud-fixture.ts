import { reviewOwnerA, reviewOwnerB } from "./review-cloud-fixture";
import type { Binder, BinderLesson, Profile } from "@/types";
export const creatorProfile: Profile = {
  id: reviewOwnerA,
  role: "learner",
  email: "creator@example.test",
  full_name: "Creator",
  created_at: "2026-09-01T12:00:00.000Z",
  updated_at: "2026-09-01T12:00:00.000Z",
};
export const creatorBinder: Binder = {
  id: "binder-own",
  owner_id: reviewOwnerA,
  title: "My calculus",
  slug: "my-calculus",
  description: "My sources",
  subject: "Math",
  level: "University",
  status: "draft",
  price_cents: 0,
  cover_url: null,
  pinned: false,
  suite_template_id: null,
  created_at: creatorProfile.created_at,
  updated_at: creatorProfile.updated_at,
};
export const creatorLesson: BinderLesson = {
  id: "lesson-own",
  binder_id: creatorBinder.id,
  title: "Limits",
  order_index: 1,
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "A limit describes nearby values." }] }],
  },
  math_blocks: [],
  is_preview: false,
  created_at: creatorProfile.created_at,
  updated_at: creatorProfile.updated_at,
};
/** Transport fixture only; role/RLS/concurrency are tested against PostgreSQL separately. */
export function creatorCloudFixture() {
  type Row = Record<string, unknown>;
  const state = {
    fail: false,
    denyWrites: false,
    loseAcknowledgement: false,
    bypassFilter: false,
    tables: {
      account_entitlements: [
        { user_id: reviewOwnerA, plan: "studio", status: "active", valid_until: null },
      ] as Row[],
      binders: [
        structuredClone(creatorBinder),
        { ...creatorBinder, id: "binder-foreign", owner_id: reviewOwnerB },
        { ...creatorBinder, id: "binder-system", suite_template_id: "system" },
      ] as Row[],
      binder_lessons: [structuredClone(creatorLesson)] as Row[],
    },
    selections: [] as string[],
  };
  function from(table: keyof typeof state.tables) {
    const filters: Array<[string, unknown]> = [];
    let action = "read",
      payload: Row = {},
      first = 0,
      last = Infinity;
    function result(single: boolean) {
      if (state.fail) return { data: null, error: { message: "offline" } };
      if (action !== "read" && state.denyWrites) return { data: null, error: { code: "42501" } };
      let rows = state.tables[table].filter(
        (row) => state.bypassFilter || filters.every(([key, value]) => row[key] === value),
      );
      if (action === "insert") {
        if (state.tables[table].some((row) => row.id === payload.id))
          return { data: null, error: { code: "23505" } };
        const saved = { created_at: creatorProfile.created_at, ...structuredClone(payload) };
        state.tables[table].push(saved);
        rows = [saved];
      } else if (action === "update") rows.forEach((row) => Object.assign(row, structuredClone(payload)));
      if (action !== "read" && state.loseAcknowledgement) {
        state.loseAcknowledgement = false;
        return { data: null, error: { message: "lost acknowledgement" } };
      }
      rows = rows.slice(first, last + 1);
      return { data: structuredClone(single ? (rows[0] ?? null) : rows), error: null };
    }
    const query = {
      select: (fields: string) => {
        state.selections.push(fields);
        return query;
      },
      eq: (key: string, value: unknown) => {
        filters.push([key, value]);
        return query;
      },
      is: (key: string, value: unknown) => {
        filters.push([key, value]);
        return query;
      },
      order: () => query,
      range: (start: number, end: number) => {
        first = start;
        last = end;
        return query;
      },
      insert: (value: Row) => {
        action = "insert";
        payload = value;
        return query;
      },
      update: (value: Row) => {
        action = "update";
        payload = value;
        return query;
      },
      maybeSingle: async () => result(true),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
        Promise.resolve(result(false)).then(resolve),
    };
    return query;
  }
  return Object.assign(state, { from });
}
