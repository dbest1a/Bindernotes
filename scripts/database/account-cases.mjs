import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function runAccountCases({ sql, concurrentSql, roleSql, as, json }) {
  const owner = randomUUID(),
    other = randomUUID(),
    note = randomUUID(),
    operation = randomUUID();
  sql(
    `insert into auth.users(id,email) values('${owner}','account-local@disposable.invalid'),('${other}','other-local@disposable.invalid');insert into auth.sessions(id,user_id) values('${owner}','${owner}'),('${other}','${other}');`,
  );
  const privateQuiz = "account-quiz-" + randomUUID(),
    catalogQuiz = "catalog-quiz-" + randomUUID(),
    legacyAttempt = randomUUID();
  sql(
    `insert into public.quiz_sets(id,user_id,title) values('${privateQuiz}','${owner}','Private quiz'),('${catalogQuiz}',null,'Catalog quiz');`,
  );
  as(
    owner,
    `insert into public.quiz_attempts(id,quiz_set_id,user_id) values('${randomUUID()}','${privateQuiz}','${owner}');`,
  );
  as(
    other,
    `insert into public.quiz_attempts(id,quiz_set_id,user_id) values('${randomUUID()}','${catalogQuiz}','${other}');`,
  );
  assert.throws(
    () =>
      as(
        other,
        `insert into public.quiz_attempts(id,quiz_set_id,user_id) values('${randomUUID()}','${privateQuiz}','${other}');`,
      ),
    /PRIVATE_PARENT_OWNERSHIP/,
  );
  // Fixture only: represent a foreign-owned attempt that an older schema allowed.
  sql(
    `begin;set local session_replication_role=replica;insert into public.quiz_attempts(id,quiz_set_id,user_id) values('${legacyAttempt}','${privateQuiz}','${other}');commit;`,
  );
  assert.equal(
    as(null, `select public.account_deletion_requires_transfer('${owner}');`, "service_role"),
    "t",
  );
  assert.throws(
    () =>
      as(
        null,
        `select public.begin_account_deletion('${owner}','${randomUUID()}',null,null);`,
        "service_role",
      ),
    /ACCOUNT_SHARED_CONTENT_REQUIRES_TRANSFER/,
  );
  assert.equal(sql(`select count(*) from public.quiz_attempts where id='${legacyAttempt}';`), "1");
  // Preserve all attempts by transferring this fixture to the operator catalog.
  sql(`update public.quiz_sets set user_id=null where id='${privateQuiz}';`);
  assert.throws(
    () => sql(`update public.quiz_sets set user_id='${owner}' where id='${catalogQuiz}';`),
    /QUIZ_SHARED_ATTEMPTS_REQUIRE_TRANSFER/,
  );
  const racingQuiz = "quiz-owner-race-" + randomUUID();
  sql(`insert into public.quiz_sets(id,user_id,title) values('${racingQuiz}',null,'Concurrent catalog');`);
  const [quizTransfer, quizAttempt] = await Promise.all([
    concurrentSql(
      roleSql(
        "service_role",
        null,
        `update public.quiz_sets set user_id='${owner}' where id='${racingQuiz}';select pg_sleep(0.15);`,
      ),
    ),
    concurrentSql(
      roleSql(
        "service_role",
        null,
        `insert into public.quiz_attempts(id,user_id,quiz_set_id) values('${randomUUID()}','${other}','${racingQuiz}');select pg_sleep(0.15);`,
      ),
    ),
  ]);
  assert.equal(
    [quizTransfer, quizAttempt].filter((result) => result.status === 0).length,
    1,
    "Quiz ownership transfer and foreign attempt cannot both commit",
  );
  if (quizTransfer.status === 0) assert.match(quizAttempt.stderr, /PRIVATE_PARENT_OWNERSHIP/);
  else assert.match(quizTransfer.stderr, /QUIZ_SHARED_ATTEMPTS_REQUIRE_TRANSFER/);
  const record = {
    id: note,
    title: "Private deletion fixture",
    content: { type: "doc", content: [] },
    math_blocks: [],
    tags: [],
  };
  const save = `select public.save_personal_content('note',${json(record)},0,'${operation}');`;
  as(owner, save);
  assert.equal(as(owner, "select public.get_account_session_status();"), "active");
  assert.throws(() => as(null, "select public.get_account_session_status();", "anon"), /permission denied/);
  sql(`delete from auth.sessions where user_id='${owner}';`);
  assert.equal(as(owner, "select public.get_account_session_status();"), "revoked");
  assert.equal(as(owner, `select count(*) from public.personal_notes where id='${note}';`), "0");
  assert.throws(() => as(owner, save), /ACCOUNT_SESSION_REVOKED/);
  assert.throws(
    () =>
      as(
        owner,
        `select public.reserve_user_asset('${randomUUID()}','No.pdf','application/pdf',10,'${"a".repeat(64)}');`,
      ),
    /ACCOUNT_SESSION_REVOKED/,
  );
  assert.equal(as(other, "select count(*) from public.profiles;"), "1");
  sql(`insert into auth.sessions(id,user_id) values('${owner}','${owner}');`);
  const shared = "shared-delete-" + randomUUID();
  sql(
    `insert into public.binders(id,owner_id,title,slug,status) values('${shared}','${owner}','Shared source','${shared}','published');insert into public.binder_lessons(id,binder_id,title) values('${shared}-lesson','${shared}','Source');`,
  );
  assert.equal(
    as(null, `select public.account_deletion_requires_transfer('${owner}');`, "service_role"),
    "t",
  );
  sql(
    `update public.binders set status='archived' where id='${shared}';insert into public.learner_notes(id,owner_id,binder_id,lesson_id,title) values('${randomUUID()}','${other}','${shared}','${shared}-lesson','Other learner must survive');`,
  );
  assert.throws(
    () =>
      as(
        null,
        `select public.begin_account_deletion('${owner}','${randomUUID()}',null,null);`,
        "service_role",
      ),
    /ACCOUNT_SHARED_CONTENT_REQUIRES_TRANSFER/,
  );
  assert.equal(
    sql(`select count(*) from public.learner_notes where owner_id='${other}' and binder_id='${shared}';`),
    "1",
  );
  // Explicit fixture transfer mirrors the required operator workflow; no student
  // records are deleted to make the account test proceed.
  sql(`update public.binders set owner_id='${other}' where id='${shared}';`);
  // A legitimate cross-owner reply must survive its parent's account deletion.
  // Catalog-derived edges also cover legacy mismatches in lab/report, whiteboard
  // and History parent chains without rewriting any existing student record.
  const parentComment = randomUUID(),
    reply = randomUUID();
  sql(
    `insert into public.comments(id,owner_id,binder_id,lesson_id,body) values('${parentComment}','${owner}','${shared}','${shared}-lesson','Parent');insert into public.comments(id,owner_id,binder_id,lesson_id,parent_id,body) values('${reply}','${other}','${shared}','${shared}-lesson','${parentComment}','Foreign reply');`,
  );
  assert.throws(
    () =>
      as(
        null,
        `select public.begin_account_deletion('${owner}','${randomUUID()}',null,null);`,
        "service_role",
      ),
    /ACCOUNT_SHARED_CONTENT_REQUIRES_TRANSFER/,
  );
  assert.equal(sql(`select body from public.comments where id='${reply}';`), "Foreign reply");
  sql(`update public.comments set owner_id='${other}' where id='${parentComment}';`);
  const edges = Number(sql("select count(*) from private.account_owned_cascade_edges();"));
  assert(edges >= 20, "Guard must discover all existing single-column owned cascade edges");
  assert.equal(
    Number(
      sql(
        "select count(*) from pg_trigger where tgname like 'account_cascade_guard_%' and not tgisinternal;",
      ),
    ),
    edges,
  );
  const commentOwner = randomUUID(),
    raceParent = randomUUID(),
    raceReply = randomUUID();
  sql(
    `insert into auth.users(id,email) values('${commentOwner}','comment-${commentOwner}@disposable.invalid');insert into public.comments(id,owner_id,binder_id,lesson_id,body) values('${raceParent}','${commentOwner}','${shared}','${shared}-lesson','Concurrent parent');`,
  );
  const [commentDeletion, commentAttachment] = await Promise.all([
    concurrentSql(
      roleSql(
        "service_role",
        null,
        `select public.begin_account_deletion('${commentOwner}','${randomUUID()}',null,null);select pg_sleep(0.15);`,
      ),
    ),
    concurrentSql(
      roleSql(
        "service_role",
        null,
        `insert into public.comments(id,owner_id,binder_id,lesson_id,parent_id,body) values('${raceReply}','${other}','${shared}','${shared}-lesson','${raceParent}','Concurrent reply');select pg_sleep(0.15);`,
      ),
    ),
  ]);
  assert.equal(
    [commentDeletion, commentAttachment].filter((result) => result.status === 0).length,
    1,
    "A foreign comment attachment and parent account deletion cannot both commit",
  );
  if (commentDeletion.status === 0) assert.match(commentAttachment.stderr, /SHARED_SOURCE_ACCOUNT_DELETING/);
  else assert.match(commentDeletion.stderr, /ACCOUNT_SHARED_CONTENT_REQUIRES_TRANSFER/);
  // Competing source attachment vs deletion cannot commit together. This uses
  // separate real PostgreSQL transactions, including privileged background writes.
  for (let attempt = 0; attempt < 2; attempt++) {
    const raceOwner = randomUUID(),
      source = "delete-race-" + randomUUID(),
      child = randomUUID();
    sql(
      `insert into auth.users(id,email) values('${raceOwner}','race-${raceOwner}@disposable.invalid');insert into public.binders(id,owner_id,title,slug,status) values('${source}','${raceOwner}','Private source','${source}','draft');`,
    );
    const deletionResult = concurrentSql(
      roleSql(
        "service_role",
        null,
        `select public.begin_account_deletion('${raceOwner}','${randomUUID()}',null,null);select pg_sleep(0.15);`,
      ),
    );
    const childResult = concurrentSql(
      roleSql(
        "service_role",
        null,
        `insert into public.learner_notes(id,owner_id,binder_id,title) values('${child}','${other}','${source}','Concurrent foreign child');select pg_sleep(0.15);`,
      ),
    );
    const [deleting, attaching] = await Promise.all([deletionResult, childResult]);
    assert.equal(
      [deleting, attaching].filter((result) => result.status === 0).length,
      1,
      "Exactly one side of the dependency/deletion race may commit",
    );
    if (deleting.status === 0) {
      assert.match(attaching.stderr, /SHARED_SOURCE_ACCOUNT_DELETING/);
      assert.equal(sql(`select count(*) from public.learner_notes where id='${child}';`), "0");
      assert.throws(
        () =>
          as(
            null,
            `insert into public.learner_notes(id,owner_id,binder_id,title) values('${randomUUID()}','${other}','${source}','Late child');`,
            "service_role",
          ),
        /SHARED_SOURCE_ACCOUNT_DELETING/,
      );
    } else {
      assert.match(deleting.stderr, /ACCOUNT_SHARED_CONTENT_REQUIRES_TRANSFER/);
      assert.equal(sql(`select count(*) from public.learner_notes where id='${child}';`), "1");
      assert.equal(as(null, `select public.account_deletion_state('${raceOwner}');`, "service_role"), "f");
    }
  }
  const deletion = randomUUID(),
    lease = randomUUID(),
    customer = "cus_accountcase";
  const begin = `select public.begin_account_deletion('${owner}','${deletion}','${customer}','${lease}');`;
  assert.throws(() => as(owner, begin), /permission denied/);
  assert.throws(() => as(owner, `select public.account_deletion_state('${owner}');`), /permission denied/);
  as(null, `select public.bind_billing_customer('${owner}','${customer}');`, "service_role");
  assert.throws(() => as(null, begin, "service_role"), /BILLING_LEASE_LOST/);
  assert.equal(
    as(
      null,
      `select public.claim_billing_event('${customer}','account-delete:${deletion}','${lease}');`,
      "service_role",
    ),
    "claimed",
  );
  assert.equal(
    as(
      null,
      `select public.claim_billing_event('${customer}','checkout','${randomUUID()}');`,
      "service_role",
    ),
    "busy",
  );
  as(null, begin, "service_role");
  as(null, begin, "service_role");
  assert.equal(as(owner, "select public.get_account_session_status();"), "deleting");
  assert.equal(as(null, `select public.account_deletion_state('${owner}');`, "service_role"), "t");
  assert.equal(as(owner, `select count(*) from public.personal_notes;`), "0");
  assert.throws(() => as(owner, save), /ACCOUNT_SESSION_REVOKED/);
  assert.throws(
    () => as(null, `select public.bind_billing_customer('${owner}','cus_duringdelete');`, "service_role"),
    /ACCOUNT_DELETING/,
  );
  assert.equal(
    as(
      null,
      `select public.claim_billing_event('${customer}','checkout','${randomUUID()}');`,
      "service_role",
    ),
    "busy",
  );
  assert.equal(
    sql(`select count(*) from public.personal_notes where id='${note}';`),
    "1",
    "Durable deletion marker must not prematurely erase data",
  );
  // Actual Auth admin HTTP cascade is exercised separately; this proves schema FK behavior.
  sql(`delete from auth.users where id='${owner}';`);
  for (const table of ["profiles", "personal_notes", "billing_accounts"])
    assert.equal(
      sql(
        `select count(*) from public.${table} where ${table === "profiles" ? "id" : table === "billing_accounts" ? "user_id" : "owner_id"}='${owner}';`,
      ),
      "0",
    );
  assert.equal(as(other, "select count(*) from public.profiles;"), "1");
  console.log(
    "PASS real session-row revocation denies reads/RPC retries, deletion marker fences writes/new billing, lease proof, retry and account cascade isolation",
  );
}
