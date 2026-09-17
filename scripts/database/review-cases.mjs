import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function runReviewCases({ sql, concurrentSql, roleSql, as, users, json }) {
  const timestamp = "2026-09-17T00:00:00Z";
  const record = {
    schemaVersion: 1,
    recall: null,
    item: {
      id: "canonical-test",
      owner_id: users.a,
      type: "free_response",
      prompt: "What is conserved?",
      answer: "Mass",
      source_kind: "manual",
      source_id: null,
      source_title: null,
      source_excerpt: null,
      binder_id: null,
      binder_title: null,
      course_id: null,
      course_title: null,
      due_at: timestamp,
      status: "due",
      mastery: 0,
      review_count: 0,
      lapse_count: 0,
      created_at: timestamp,
      updated_at: timestamp,
    },
  };
  const call = (value, revision, events = [], operation = randomUUID()) =>
    `select public.save_review_item(${json(value)},${revision},'${operation}',${json(events)});`;
  // These shapes are accepted neither by the client schema nor the trusted RPC.
  for (const bad of ["now", "infinity", "2026-09-17", "2026-09-17T24:00:00Z", "2026-09-17T00:00:00+0200"]) {
    assert.throws(
      () => as(users.a, call({ ...record, item: { ...record.item, due_at: bad } }, 0)),
      /INVALID_REVIEW_TIME/,
    );
  }
  assert.throws(() => as(users.a, call({ ...record, schemaVersion: "1" }, 0)), /INVALID_REVIEW_RECORD/);
  const recall = {
    id: "card",
    userId: users.a,
    binderId: "binder",
    documentId: "doc",
    lessonId: "lesson",
    sourceType: "manual",
    front: record.item.prompt,
    back: record.item.answer,
    tags: [],
    cardType: "basic_qa",
    status: "Learning",
    difficulty: "new",
    confidence: 0,
    reviewCount: 0,
    lapseCount: 0,
    createdVia: "manual",
    draftStatus: "accepted",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const recallRecord = {
    ...record,
    item: { ...record.item, id: "recall:" + JSON.stringify(["binder", "doc", "lesson", "card"]) },
    recall,
  };
  assert.equal(JSON.parse(as(users.a, call(recallRecord, 0))).revision, 1);
  for (const patch of [
    { sourceId: 17 },
    { explanation: null },
    { qualityStatus: "unknown" },
    { cardType: "invalid" },
    { lastReviewedAt: "now" },
    { missReasons: [{ reason: "Other", note: 17, createdAt: timestamp }] },
    { teachBackReflections: [{ text: "Reflection", createdAt: "yesterday" }] },
  ]) {
    assert.throws(
      () => as(users.a, call({ ...recallRecord, recall: { ...recall, ...patch } }, 1)),
      /INVALID_RECALL|INVALID_REVIEW_TIME/,
    );
  }
  const operation = randomUUID();
  assert.throws(() => as(null, call(record, 0), "anon"), /permission denied/);
  for (const table of ["review_items", "review_events", "review_sessions"]) {
    assert.throws(() => as(users.a, `delete from public.${table};`), /permission denied/);
  }
  const first = JSON.parse(as(users.a, call(record, 0, [], operation)));
  assert.equal(first.revision, 1);
  assert.equal(JSON.parse(as(users.a, call(record, 0, [], operation))).revision, 1);
  assert.throws(() => as(users.b, call(record, 0)), /INVALID_REVIEW_RECORD/);
  assert.equal(as(users.b, "select count(*) from public.review_items where id='canonical-test';"), "0");
  const event = {
    id: "review-event",
    owner_id: users.a,
    item_id: record.item.id,
    rating: "good",
    reviewed_at: timestamp,
    due_at_before: timestamp,
    due_at_after: timestamp,
    response_length: 7,
  };
  assert.throws(
    () =>
      as(
        users.a,
        call({ ...record, item: { ...record.item, prompt: "Must roll back" } }, 1, [
          { ...event, owner_id: users.b },
        ]),
      ),
    /INVALID_REVIEW_EVENT/,
  );
  assert.equal(
    sql("select revision from public.review_items where owner_id='" + users.a + "' and id='canonical-test';"),
    "1",
  );
  const competing = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      concurrentSql(
        roleSql(
          "authenticated",
          users.a,
          call({ ...record, item: { ...record.item, prompt: `Writer ${i}` } }, 1),
        ),
      ),
    ),
  );
  assert.equal(competing.filter((result) => result.status === 0).length, 1);
  assert(
    competing
      .filter((result) => result.status !== 0)
      .every((result) => result.stderr.includes("CONTENT_REVISION_CONFLICT")),
  );
  const reviewed = { ...record, item: { ...record.item, prompt: "Reviewed", review_count: 1 } };
  assert.equal(JSON.parse(as(users.a, call(reviewed, 2, [event]))).revision, 3);
  assert.throws(
    () =>
      as(
        users.a,
        call({ ...reviewed, item: { ...reviewed.item, prompt: "History conflict" } }, 3, [
          { ...event, rating: "forgot" },
        ]),
      ),
    /REVIEW_HISTORY_CONFLICT/,
  );
  assert.equal(
    sql(
      `select revision||':'||(payload->'item'->>'prompt') from public.review_items where owner_id='${users.a}' and id='canonical-test';`,
    ),
    "3:Reviewed",
  );
  assert.equal(as(users.b, "select count(*) from public.review_events;"), "0");
  sql(`create function private.test_fail_review_event() returns trigger language plpgsql as $$begin raise exception 'TEST_REVIEW_EVENT_FAILURE';end;$$;
    create trigger test_fail_review_event before insert on public.review_events for each row execute function private.test_fail_review_event();`);
  assert.throws(
    () =>
      as(
        users.a,
        call({ ...reviewed, item: { ...reviewed.item, prompt: "Rolled back" } }, 3, [
          { ...event, id: "rollback-event" },
        ]),
      ),
    /TEST_REVIEW_EVENT_FAILURE/,
  );
  assert.equal(
    sql(`select revision from public.review_items where owner_id='${users.a}' and id='canonical-test';`),
    "3",
  );
  sql(
    "drop trigger test_fail_review_event on public.review_events;drop function private.test_fail_review_event();",
  );
  const session = {
    id: "session",
    scope: { userId: users.a, binderId: "binder", documentId: "doc", lessonId: "lesson" },
    mode: "Flip",
    cardIds: ["canonical-test"],
    correct: 1,
    missed: 0,
    score: 100,
    missedConcepts: [],
    createdAt: timestamp,
  };
  const sessionId = JSON.stringify(["binder", "doc", "lesson", "session"]);
  const saveSession = (value) => `select public.save_review_session('${sessionId}',${json(value)});`;
  as(users.a, saveSession(session));
  as(users.a, saveSession(session));
  assert.equal(as(users.a, "select count(*) from public.review_sessions;"), "1");
  assert.equal(as(users.b, "select count(*) from public.review_sessions;"), "0");
  assert.throws(() => as(users.a, saveSession({ ...session, score: 0 })), /REVIEW_SESSION_CONFLICT/);
  assert.throws(() => as(users.b, saveSession(session)), /INVALID_REVIEW_SESSION/);
  assert.throws(() => as(users.a, saveSession({ ...session, score: 101 })), /INVALID_REVIEW_SESSION/);
  console.log(
    "PASS review owner isolation, direct-write denial, revision retry/six-writer conflict, atomic event rollback, immutable history/session forged ownership denial and strict optional Recall/ISO timestamp validation",
  );
}
