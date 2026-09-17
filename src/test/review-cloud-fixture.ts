import type { RecallCard } from "@/lib/recall/recall-types";
import type { StudyItem } from "@/services/study-items-service";

export const reviewOwnerA = "00000000-0000-4000-8000-000000000001";
export const reviewOwnerB = "00000000-0000-4000-8000-000000000002";
export function recallFixture(overrides: Partial<RecallCard> = {}): RecallCard {
  return { id: "card-1", userId: reviewOwnerA, binderId: "binder-1", documentId: "lesson-1", lessonId: "lesson-1",
    sourceType: "highlight", sourceId: "highlight-1", sourceExcerpt: "A derivative is local change.", sourceAnchor: "paragraph-2",
    front: "Differentiate x^2.", back: "2x", explanation: "Power rule.", whyItMatters: "Local rate", tags: ["calculus"], subject: "Math",
    cardType: "formula_meaning", status: "Learning", difficulty: "good", confidence: 0.4, lastReviewedAt: "2026-09-15T12:00:00.000Z",
    nextReviewAt: "2026-09-18T12:00:00.000Z", reviewCount: 2, lapseCount: 1, createdVia: "highlight", draftStatus: "accepted", qualityStatus: "good",
    missReasons: [{ reason: "Careless error", note: "Forgot coefficient", createdAt: "2026-09-14T12:00:00.000Z" }],
    teachBackReflections: [{ text: "The exponent becomes the coefficient.", createdAt: "2026-09-15T12:00:00.000Z" }],
    createdAt: "2026-09-13T12:00:00.000Z", updatedAt: "2026-09-15T12:00:00.000Z", ...overrides };
}
export function studyFixture(overrides: Partial<StudyItem> = {}): StudyItem {
  return { id: "study-item-1", owner_id: reviewOwnerA, type: "formula_card", prompt: "Derivative of x^2?", answer: "2x",
    source_kind: "formula", source_id: "formula-1", source_title: "Power rule", source_excerpt: "d/dx x^n = nx^(n-1)",
    binder_id: "binder-1", binder_title: "Calculus", course_id: null, course_title: null,
    due_at: "2026-09-16T12:00:00.000Z", status: "due", mastery: 0.3, review_count: 2, lapse_count: 1,
    created_at: "2026-09-13T12:00:00.000Z", updated_at: "2026-09-15T12:00:00.000Z", ...overrides };
}

/** Browser/service contract fixture. Real role and transaction checks live in scripts/database/review-cases.mjs. */
export function reviewCloudFixture() {
  type Row = Record<string, unknown>;
  const fixture = { owner: reviewOwnerA, fail: false, loseNextAcknowledgement: false, bypassOwner: false,
    tables: { review_items: [] as Row[], review_events: [] as Row[], review_sessions: [] as Row[] }, receipts: new Map<string, { request: string; revision: number; id: string }>() };
  function from(table: keyof typeof fixture.tables) {
    let fromIndex = 0, toIndex = Infinity;
    const filters: Array<[string, unknown]> = [];
    const read = (single: boolean) => {
      if (fixture.fail) return { data: null, error: { message: "private error" } };
      const rows = fixture.tables[table].filter((row) => fixture.bypassOwner || (row.owner_id === fixture.owner && filters.every(([key, value]) => row[key] === value))).slice(fromIndex, toIndex + 1);
      return { data: structuredClone(single ? rows[0] ?? null : rows), error: null };
    };
    const query = { select: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      order: () => query, range: (first: number, last: number) => { fromIndex = first; toIndex = last; return query; }, abortSignal: () => query,
      maybeSingle: async () => read(true), then: (resolve: (result: ReturnType<typeof read>) => unknown) => Promise.resolve(read(false)).then(resolve) };
    return query;
  }
  async function rpc(name: string, args: Record<string, unknown>) {
    if (fixture.fail) return { data: null, error: { message: "private error" } };
    if (name === "save_review_session") {
      const session = args.p_session as { scope: { userId: string } };
      if (session.scope.userId !== fixture.owner) return { data: null, error: { code: "42501" } };
      const existing = fixture.tables.review_sessions.find((row) => row.id === args.p_id && row.owner_id === fixture.owner);
      if (existing && JSON.stringify(existing.payload) !== JSON.stringify(session)) return { data: null, error: { code: "40001" } };
      if (!existing) fixture.tables.review_sessions.push({ id: args.p_id, owner_id: fixture.owner, payload: structuredClone(session) });
      return { data: structuredClone(session), error: null };
    }
    if (name !== "save_review_item") throw new Error(`Unexpected RPC ${name}`);
    const record = args.p_record as { item: StudyItem };
    if (record.item.owner_id !== fixture.owner) return { data: null, error: { code: "42501" } };
    const key = `${fixture.owner}:${args.p_operation_id}`;
    const request = JSON.stringify(args);
    const prior = fixture.receipts.get(key);
    const existing = fixture.tables.review_items.find((row) => row.id === record.item.id && row.owner_id === fixture.owner);
    if (prior) {
      if (prior.request !== request) return { data: null, error: { code: "22023" } };
      return prior.revision === existing?.revision ? { data: structuredClone(existing), error: null } : { data: null, error: { code: "40001" } };
    }
    if ((existing?.revision ?? 0) !== args.p_expected_revision) return { data: null, error: { code: "40001" } };
    const row = { id: record.item.id, owner_id: fixture.owner, payload: structuredClone(record), revision: Number(args.p_expected_revision) + 1 };
    fixture.tables.review_items = [...fixture.tables.review_items.filter((candidate) => candidate !== existing), row];
    for (const event of (args.p_events ?? []) as Row[]) if (!fixture.tables.review_events.some((prior) => prior.id === event.id && prior.owner_id === fixture.owner)) fixture.tables.review_events.push({ id: event.id, owner_id: fixture.owner, payload: structuredClone(event) });
    fixture.receipts.set(key, { request, revision: row.revision, id: row.id });
    if (fixture.loseNextAcknowledgement) { fixture.loseNextAcknowledgement = false; return { data: null, error: { message: "lost acknowledgement" } }; }
    return { data: structuredClone(row), error: null };
  }
  return Object.assign(fixture, { from, rpc });
}
