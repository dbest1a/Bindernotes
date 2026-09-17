import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runBillingCases } from "./billing-cases.mjs";
import { runReviewCases } from "./review-cases.mjs";
import { runAssetCases } from "./asset-cases.mjs";
import { runAccountCases } from "./account-cases.mjs";
import { runArchiveCases } from "./archive-cases.mjs";
import { runNoteSearchCases } from "./note-search-cases.mjs";

const users = {
  a: "10000000-0000-4000-8000-000000000001",
  b: "10000000-0000-4000-8000-000000000002",
  creator: "10000000-0000-4000-8000-000000000003",
  admin: "10000000-0000-4000-8000-000000000004",
};
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;
const roleSql = (role, actor, statement) =>
  `begin; set local role ${role}; set local "request.jwt.claim.sub"=${literal(actor ?? "")}; set local "request.jwt.claim.role"=${literal(role)}; set local "request.jwt.claims"=${literal(JSON.stringify({ sub: actor, role, session_id: actor }))};\n${statement}\ncommit;`;
export async function run({ sql, concurrentSql }) {
  let count = 0;
  const check = (name, fn) => {
    fn();
    count++;
    console.log(`PASS ${name}`);
  };
  const as = (actor, statement, role = "authenticated") => sql(roleSql(role, actor, statement));
  const denied = (
    actor,
    statement,
    pattern = /permission denied|row-level security|PRIVATE_PARENT_OWNERSHIP|CONTENT_NOT_FOUND|WHITEBOARD_NOT_FOUND/,
  ) => assert.throws(() => as(actor, statement), pattern);
  sql(`insert into auth.users(id,email) values ${Object.entries(users)
    .map(([name, id]) => `('${id}','${name}@disposable.invalid')`)
    .join(",")};
    insert into auth.sessions(id,user_id) select id,id from auth.users;
    update public.profiles set role='admin' where id='${users.admin}';
    insert into public.account_entitlements(user_id,plan,status) values('${users.creator}','studio','active');
    insert into public.binders(id,owner_id,title,slug,status) values('catalog','${users.admin}','Catalog','catalog','published');
    insert into public.binder_lessons(id,binder_id,title) values('lesson','catalog','Lesson');
    insert into public.question_bank(id,type,prompt_markdown,status,created_by) values('question','numeric','1+1','published','${users.admin}');
    insert into public.quiz_sets(id,user_id,title) values('quiz','${users.a}','Private quiz');
    insert into public.quiz_attempts(id,quiz_set_id,user_id) values('attempt','quiz','${users.a}');`);
  check("anonymous cannot read profiles or private notes", () => {
    assert.throws(() => as(null, "select * from public.profiles;", "anon"), /permission denied/);
    assert.throws(() => as(null, "select * from public.personal_notes;", "anon"), /permission denied/);
  });
  check("learner cannot assign roles, forge purchases or entitlements", () => {
    denied(users.a, `update public.profiles set role='admin' where id='${users.a}';`);
    denied(users.a, `insert into public.purchases(user_id,status) values('${users.a}','paid');`);
    denied(
      users.a,
      `insert into public.account_entitlements(user_id,plan,status) values('${users.a}','everything','active');`,
    );
    assert.equal(as(users.a, "select count(*) from public.profiles;"), "1");
  });
  check("profile safe fields remain editable", () => {
    as(users.a, `update public.profiles set full_name='Learner A' where id='${users.a}';`);
    assert.equal(as(users.a, "select full_name from public.profiles;"), "Learner A");
  });
  check("chemistry helper permits published reads and operator writes", () => {
    as(
      users.admin,
      "insert into public.chem_concepts(id,slug,title,status) values('chem','chem','Chemistry','published'),('draft','draft','Draft','draft');",
    );
    assert.equal(as(users.a, "select count(*) from public.chem_concepts;"), "1");
    assert.equal(as(users.admin, "select count(*) from public.chem_concepts;"), "2");
    denied(users.a, "insert into public.chem_concepts(id,slug,title) values('forged','forged','Forged');");
    assert.equal(
      as(
        users.creator,
        "with changed as (update public.chem_concepts set title='Overwrite' where id='chem' returning id) select count(*) from changed;",
      ),
      "0",
    );
  });
  check("private helper RPC and maintenance functions are forbidden", () => {
    for (const actor of [users.a, users.creator, users.admin]) {
      denied(actor, "select public.is_admin();");
      denied(actor, "select public.refresh_all_dashboard_summaries();");
      denied(actor, "select public.apply_catalog_seed('{}'::jsonb);");
    }
  });
  check("paid creator edits own content without operator authority", () => {
    as(
      users.creator,
      `insert into public.binders(id,owner_id,title,slug,status) values('creator-binder','${users.creator}','Creator binder','creator-binder','draft');`,
    );
    as(
      users.creator,
      "insert into public.binder_lessons(id,binder_id,title) values('creator-lesson','creator-binder','Draft lesson');",
    );
    as(users.creator, "update public.binders set status='published' where id='creator-binder';");
    assert.equal(
      as(users.creator, `select role from public.profiles where id='${users.creator}';`),
      "learner",
    );
    denied(
      users.creator,
      `insert into public.binders(id,owner_id,title,slug) values('stolen','${users.a}','Stolen','stolen');`,
    );
    denied(
      users.creator,
      "insert into public.math_courses(id,slug,title) values('forged-course','forged','Forged');",
    );
    as(
      users.creator,
      "delete from public.binder_lessons where id='creator-lesson'; delete from public.binders where id='creator-binder';",
    );
  });
  check("History source evidence fields survive an owned edit", () => {
    as(
      users.a,
      `insert into public.history_sources(id,owner_id,binder_id,title,source_type,author,date_label,quote_text,claim_supports,claim_challenges) values('30000000-0000-4000-8000-000000000036','${users.a}','catalog','Source','primary','Author','1900','Exact quote','Claim supported','Claim challenged');`,
    );
    assert.equal(
      as(
        users.a,
        "select quote_text||':'||claim_supports||':'||claim_challenges from public.history_sources where id='30000000-0000-4000-8000-000000000036';",
      ),
      "Exact quote:Claim supported:Claim challenged",
    );
    assert.equal(
      as(
        users.b,
        "select count(*) from public.history_sources where id='30000000-0000-4000-8000-000000000036';",
      ),
      "0",
    );
  });
  as(
    users.creator,
    `insert into public.binders(id,owner_id,title,slug,status) values('creator-race','${users.creator}','Own published course','creator-race','published');insert into public.binder_lessons(id,binder_id,title) values('creator-race-lesson','creator-race','Before');`,
  );
  const creatorVersion = as(
    users.creator,
    "select updated_at from public.binder_lessons where id='creator-race-lesson';",
  );
  const creatorWrites = await Promise.all(
    [0, 1].map((index) =>
      concurrentSql(
        roleSql(
          "authenticated",
          users.creator,
          `with changed as(update public.binder_lessons set title='Creator edit${index}',updated_at=now()+interval '1 second' where id='creator-race-lesson' and updated_at='${creatorVersion}'::timestamptz returning id)select count(*) from changed;`,
        ),
      ),
    ),
  );
  assert.equal(
    creatorWrites.filter((result) => result.status === 0 && result.stdout.trim() === "1").length,
    1,
  );
  as(users.creator, "update public.binders set status='archived' where id='creator-race';");
  assert.equal(as(users.creator, "select status from public.binders where id='creator-race';"), "archived");
  assert.equal(
    as(
      users.a,
      "with changed as(update public.binder_lessons set title='Foreign' where id='creator-race-lesson' returning id)select count(*) from changed;",
    ),
    "0",
  );
  console.log(
    "PASS paid creator publishes/archives own binder and competing lesson edits have one conditional winner",
  );
  check("private chemistry CRUD is account-owned", () => {
    const id = randomUUID();
    as(
      users.a,
      `insert into public.user_lab_runs(id,user_id,checkpoint) values('${id}','${users.a}','{"step":1}');`,
    );
    as(
      users.a,
      `insert into public.user_lab_runs(id,user_id,lab_template_id,checkpoint) values('${id}','${users.a}',null,'{"step":2,"builtinTemplateId":"titration"}')
      on conflict(id) do update set checkpoint=excluded.checkpoint;`,
    );
    assert.equal(as(users.a, `select checkpoint->>'step' from public.user_lab_runs where id='${id}';`), "2");
    assert.equal(as(users.b, `select count(*) from public.user_lab_runs where id='${id}';`), "0");
    assert.equal(
      as(
        users.b,
        `with changed as (update public.user_lab_runs set checkpoint='{}' where id='${id}' returning id) select count(*) from changed;`,
      ),
      "0",
    );
    denied(users.b, `insert into public.user_lab_reports(user_id,lab_run_id) values('${users.b}','${id}');`);
    denied(
      users.b,
      `insert into public.user_lab_runs(id,user_id,checkpoint) values('${id}','${users.b}','{}') on conflict(id) do update set checkpoint=excluded.checkpoint;`,
    );
    as(
      users.a,
      `update public.user_lab_runs set checkpoint='{"step":2}' where id='${id}'; delete from public.user_lab_runs where id='${id}';`,
    );
    const attemptId = randomUUID();
    as(
      users.a,
      `insert into public.user_chem_attempts(id,user_id,problem_template_id,final_answer,metadata)
      values('${attemptId}','${users.a}',null,'{"amount":2}','{"builtinTemplateId":"stoichiometry"}');`,
    );
    as(
      users.a,
      `insert into public.user_chem_attempts(id,user_id,final_answer) values('${attemptId}','${users.a}','{"amount":3}')
      on conflict(id) do update set final_answer=excluded.final_answer;`,
    );
    assert.equal(
      as(users.a, `select final_answer->>'amount' from public.user_chem_attempts where id='${attemptId}';`),
      "3",
    );
    assert.equal(as(users.b, `select count(*) from public.user_chem_attempts where id='${attemptId}';`), "0");
    denied(
      users.b,
      `insert into public.user_chem_attempts(id,user_id) values('${attemptId}','${users.b}') on conflict(id) do update set final_answer='{}';`,
    );
    const reportId = randomUUID();
    as(
      users.a,
      `insert into public.user_lab_reports(id,user_id,lab_run_id) values('${reportId}','${users.a}',null)
      on conflict(id) do update set lab_run_id=excluded.lab_run_id;`,
    );
    assert.equal(as(users.a, `select count(*) from public.user_lab_reports where id='${reportId}';`), "1");
    assert.equal(as(users.b, `select count(*) from public.user_lab_reports where id='${reportId}';`), "0");
    denied(
      users.b,
      `insert into public.user_lab_reports(id,user_id) values('${reportId}','${users.b}') on conflict(id) do update set lab_run_id=null;`,
    );
  });
  check("cross-account question attempt parent is rejected", () => {
    denied(
      users.b,
      `insert into public.question_attempts(quiz_attempt_id,question_id,user_id) values('attempt','question','${users.b}');`,
    );
    as(
      users.a,
      `insert into public.question_attempts(id,quiz_attempt_id,question_id,user_id) values('attempt:question','attempt','question','${users.a}');`,
    );
    as(
      users.a,
      `insert into public.question_attempts(id,quiz_attempt_id,question_id,user_id,submitted_answer_json)
      values('attempt:question','attempt','question','${users.a}','{"answer":2}') on conflict(id) do update set submitted_answer_json=excluded.submitted_answer_json;`,
    );
    assert.equal(
      as(
        users.a,
        "select submitted_answer_json->>'answer' from public.question_attempts where id='attempt:question';",
      ),
      "2",
    );
    assert.equal(as(users.b, "select count(*) from public.quiz_attempts where id='attempt';"), "0");
    assert.equal(
      as(users.b, "select count(*) from public.question_attempts where quiz_attempt_id='attempt';"),
      "0",
    );
  });
  const note = {
    id: randomUUID(),
    owner_id: users.a,
    title: "Original",
    content: { type: "doc", content: [{ type: "paragraph" }] },
    math_blocks: [],
  };
  const noteOp = randomUUID();
  const noteCall = (record, revision, operation = randomUUID()) =>
    `select public.save_personal_content('note',${json(record)},${revision},'${operation}');`;
  check("personal snapshot creation, retry and owner checks", () => {
    const first = JSON.parse(as(users.a, noteCall(note, 0, noteOp)));
    assert.equal(first.revision, 1);
    assert.deepEqual(JSON.parse(as(users.a, noteCall(note, 0, noteOp))), first);
    denied(users.b, noteCall({ ...note, owner_id: users.b, title: "Stolen" }, 1));
    denied(users.a, `update public.personal_notes set title='Bypass CAS' where id='${note.id}';`);
  });
  check("stale note revision cannot overwrite newer content", () => {
    as(users.a, noteCall({ ...note, title: "Newer" }, 1));
    denied(users.a, noteCall({ ...note, title: "Stale" }, 1), /CONTENT_REVISION_CONFLICT/);
    assert.equal(as(users.a, `select title from public.personal_notes where id='${note.id}';`), "Newer");
  });
  check("note foreign parents must belong to same account", () => {
    const foreign = randomUUID();
    sql(`insert into public.personal_note_binders(id,owner_id,title) values('${foreign}','${users.b}','B');`);
    denied(users.a, noteCall({ ...note, id: randomUUID(), binder_id: foreign }, 0));
  });
  check("safe metadata updates increment revision and cannot forge it", () => {
    as(users.a, `update public.personal_notes set pinned=true where id='${note.id}';`);
    assert.equal(as(users.a, `select revision from public.personal_notes where id='${note.id}';`), "3");
    denied(users.a, noteCall({ ...note, title: "Before pin" }, 2), /CONTENT_REVISION_CONFLICT/);
    denied(
      users.a,
      `insert into public.personal_notes(id,owner_id,title,revision) values('${randomUUID()}','${users.a}','Forged',999);`,
    );
    assert.equal(as(users.b, `select count(*) from public.personal_notes where id='${note.id}';`), "0");
  });
  check("document and source-linked note use the same CAS boundary", () => {
    const binder = randomUUID();
    as(
      users.a,
      `insert into public.personal_note_binders(id,owner_id,title) values('${binder}','${users.a}','A binder');`,
    );
    const document = { ...note, id: randomUUID(), binder_id: binder };
    const saved = JSON.parse(
      as(users.a, `select public.save_personal_content('document',${json(document)},0,'${randomUUID()}');`),
    );
    assert.equal(saved.revision, 1);
    const learner = {
      id: "learner-cas",
      owner_id: users.a,
      binder_id: "catalog",
      lesson_id: "lesson",
      title: "Source note",
      content: note.content,
      math_blocks: [],
    };
    assert.equal(
      JSON.parse(
        as(
          users.a,
          `select public.save_personal_content('learner-note',${json(learner)},0,'${randomUUID()}');`,
        ),
      ).revision,
      1,
    );
    denied(
      users.b,
      `select public.save_personal_content('learner-note',${json({ ...learner, owner_id: users.b })},1,'${randomUUID()}');`,
    );
  });
  check("trash restores a whole course without losing children or relationships", () => {
    const folder = randomUUID(),
      binder = randomUUID(),
      document = randomUUID(),
      loose = randomUUID();
    as(
      users.a,
      `insert into public.personal_note_folders(id,owner_id,name) values('${folder}','${users.a}','Course folder');
      insert into public.personal_note_binders(id,owner_id,folder_id,title) values('${binder}','${users.a}','${folder}','Course');
      insert into public.personal_note_documents(id,owner_id,binder_id,title,content) values('${document}','${users.a}','${binder}','Document','{"type":"doc","content":[{"type":"text","text":"Keep this content"}]}');
      insert into public.personal_notes(id,owner_id,binder_id,document_id,title) values('${loose}','${users.a}','${binder}','${document}','Linked note');`,
    );
    denied(users.a, `delete from public.personal_note_binders where id='${binder}';`);
    denied(
      users.b,
      `select public.set_personal_trash('binder','${binder}','trash');`,
      /TRASH_ITEM_NOT_FOUND/,
    );
    denied(
      users.a,
      `select public.set_personal_trash('binder','${binder}','delete','DELETE');`,
      /TRASH_FIRST_REQUIRED/,
    );
    as(users.a, `select public.set_personal_trash('binder','${binder}','trash');`);
    assert(
      JSON.parse(as(users.a, "select public.list_personal_trash();")).some((item) => item.id === binder),
    );
    assert(
      !JSON.parse(as(users.b, "select public.list_personal_trash();")).some((item) => item.id === binder),
    );
    as(users.a, `select public.set_personal_trash('document','${document}','trash');`);
    denied(
      users.a,
      `select public.set_personal_trash('document','${document}','restore');`,
      /TRASH_PARENT_ARCHIVED/,
    );
    as(users.a, `select public.set_personal_trash('binder','${binder}','restore');`);
    assert.equal(
      as(
        users.a,
        `select (binder_id='${binder}' and archived_at is not null)::text from public.personal_note_documents where id='${document}';`,
      ),
      "true",
    );
    as(users.a, `select public.set_personal_trash('document','${document}','restore');`);
    assert.equal(
      as(
        users.a,
        `select content->'content'->0->>'text' from public.personal_note_documents where id='${document}';`,
      ),
      "Keep this content",
    );
    assert.equal(
      as(
        users.a,
        `select (document_id='${document}' and binder_id='${binder}')::text from public.personal_notes where id='${loose}';`,
      ),
      "true",
    );
    as(users.a, `select public.set_personal_trash('folder','${folder}','trash');`);
    denied(
      users.a,
      `select public.set_personal_trash('folder','${folder}','delete','yes');`,
      /EXPLICIT_DELETE_CONFIRMATION_REQUIRED/,
    );
    as(users.a, `select public.set_personal_trash('folder','${folder}','delete','DELETE');`);
    assert.equal(
      sql(
        `select (select count(*) from public.personal_note_documents where id='${document}')+(select count(*) from public.personal_notes where id='${loose}')+(select count(*) from public.personal_note_binders where id='${binder}');`,
      ),
      "0",
    );
  });
  const board = (owner, id) => ({
    id,
    owner_id: owner,
    title: "Board",
    module_context: "math-lab",
    scene_json: { elements: [] },
    module_elements: [],
    asset_size_bytes: 0,
  });
  const boardCall = (record, revision, operation = randomUUID()) =>
    `select public.save_whiteboard_snapshot(${json(record)},${revision},true,'${operation}');`;
  const firstBoard = board(users.a, "board-a");
  const boardOp = randomUUID();
  check("whiteboard scene and version save idempotently together", () => {
    const result = JSON.parse(as(users.a, boardCall(firstBoard, 0, boardOp)));
    assert.equal(result.revision, 1);
    as(users.a, boardCall(firstBoard, 0, boardOp));
    assert.equal(sql("select count(*) from public.whiteboard_versions where whiteboard_id='board-a';"), "1");
    denied(users.b, boardCall({ ...firstBoard, owner_id: users.b }, 1));
    denied(
      users.a,
      "insert into public.whiteboard_versions(whiteboard_id,owner_id,version) values('board-a','" +
        users.a +
        "',99);",
    );
  });
  check("version insertion failure rolls scene and revision back", () => {
    sql(`create function private.test_fail_version() returns trigger language plpgsql as $$begin raise exception 'TEST_VERSION_FAILURE'; end;$$;
      create trigger test_fail_version before insert on public.whiteboard_versions for each row execute function private.test_fail_version();`);
    denied(users.a, boardCall({ ...firstBoard, title: "Must roll back" }, 1), /TEST_VERSION_FAILURE/);
    assert.equal(sql("select title||':'||revision from public.whiteboards where id='board-a';"), "Board:1");
    sql(
      "drop trigger test_fail_version on public.whiteboard_versions; drop function private.test_fail_version();",
    );
  });
  const competing = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      concurrentSql(roleSql("authenticated", users.a, boardCall({ ...firstBoard, title: `Writer ${i}` }, 1))),
    ),
  );
  assert.equal(competing.filter((result) => result.status === 0).length, 1);
  assert(
    competing
      .filter((result) => result.status !== 0)
      .every((result) => result.stderr.includes("CONTENT_REVISION_CONFLICT")),
  );
  assert.equal(
    sql(
      "select string_agg(version::text,',' order by version) from public.whiteboard_versions where whiteboard_id='board-a';",
    ),
    "1,2",
  );
  count++;
  console.log("PASS concurrent board writes: one winner, explicit conflicts, unique consecutive versions");
  const quota = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      concurrentSql(roleSql("authenticated", users.b, boardCall(board(users.b, `quota-${i}`), 0))),
    ),
  );
  assert.equal(quota.filter((result) => result.status === 0).length, 3);
  assert(
    quota
      .filter((result) => result.status !== 0)
      .every((result) => result.stderr.includes("WHITEBOARD_LIMIT_REACHED")),
  );
  assert.equal(
    sql(`select count(*) from public.whiteboards where owner_id='${users.b}' and archived_at is null;`),
    "3",
  );
  count++;
  console.log("PASS concurrent quota requests: exactly three active free boards");
  check("creator quota and downgrade preserve existing work", () => {
    for (let i = 0; i < 4; i++) as(users.creator, boardCall(board(users.creator, `creator-${i}`), 0));
    assert.equal(
      sql(
        `select count(*) from public.whiteboards where owner_id='${users.creator}' and archived_at is null;`,
      ),
      "4",
    );
    as(
      null,
      `update public.account_entitlements set status='inactive' where user_id='${users.creator}';`,
      "service_role",
    );
    denied(
      users.creator,
      boardCall(board(users.creator, "creator-after-downgrade"), 0),
      /WHITEBOARD_LIMIT_REACHED/,
    );
    assert.equal(sql(`select count(*) from public.whiteboards where owner_id='${users.creator}';`), "4");
    as(
      users.creator,
      "update public.whiteboards set archived_at=now() where id in ('creator-0','creator-1');",
    );
    as(users.creator, boardCall(board(users.creator, "creator-after-archive"), 0));
    assert.equal(
      sql(
        `select count(*) from public.whiteboards where owner_id='${users.creator}' and archived_at is null;`,
      ),
      "3",
    );
  });
  check("whiteboard history bounds automatic snapshots and restores retained content with CAS", () => {
    const historical = board(users.a, "retention-board");
    as(users.a, boardCall({ ...historical, scene_json: { elements: [], marker: 0 } }, 0));
    const preservedId = sql(
      "select id from public.whiteboard_versions where whiteboard_id='retention-board' and version=1;",
    );
    sql(`update public.whiteboard_versions set version_kind='manual' where id='${preservedId}';`);
    as(
      users.a,
      Array.from({ length: 55 }, (_, i) =>
        boardCall({ ...historical, scene_json: { elements: [], marker: i + 1 } }, i + 1),
      ).join("\n"),
    );
    assert.equal(
      sql("select count(*) from public.whiteboard_versions where whiteboard_id='retention-board';"),
      "51",
    );
    assert.equal(
      sql(
        "select count(*) from public.whiteboard_versions where whiteboard_id='retention-board' and version_kind='auto';",
      ),
      "50",
    );
    assert.equal(
      sql("select scene_json->>'marker' from public.whiteboards where id='retention-board';"),
      "55",
    );
    const operation = randomUUID();
    const restore = `select public.restore_whiteboard_version('retention-board','${preservedId}',56,'${operation}');`;
    const restored = JSON.parse(as(users.a, restore));
    assert.equal(restored.revision, 57);
    assert.equal(restored.scene_json.marker, 0);
    assert.equal(JSON.parse(as(users.a, restore)).revision, 57);
    denied(
      users.b,
      `select public.restore_whiteboard_version('retention-board','${preservedId}',57,'${randomUUID()}');`,
    );
    denied(
      users.a,
      `select public.restore_whiteboard_version('retention-board','${preservedId}',56,'${randomUUID()}');`,
      /CONTENT_REVISION_CONFLICT/,
    );
    assert.equal(
      sql(
        "select count(*) from information_schema.columns where table_schema='public' and table_name in ('whiteboards','whiteboard_versions') and column_name in ('scene','modules');",
      ),
      "0",
    );
    assert.equal(
      sql(`select scene_json->>'marker' from public.whiteboard_versions where id='${preservedId}';`),
      "0",
    );
  });
  check("trusted catalog seed is transactional and idempotent", () => {
    const payload = { math_courses: [{ id: "seed-course", slug: "seed-course", title: "Seed" }] };
    as(null, `select public.apply_catalog_seed(${json(payload)});`, "service_role");
    as(null, `select public.apply_catalog_seed(${json(payload)});`, "service_role");
    assert.equal(sql("select count(*) from public.math_courses where id='seed-course';"), "1");
    const invalid = {
      math_courses: [{ id: "rollback-course", slug: "rollback-course", title: "Must rollback" }],
      math_topics: [{ id: "bad-topic", course_id: "missing", slug: "bad-topic", title: "Bad" }],
    };
    assert.throws(
      () => as(null, `select public.apply_catalog_seed(${json(invalid)});`, "service_role"),
      /foreign key/,
    );
    assert.equal(sql("select count(*) from public.math_courses where id='rollback-course';"), "0");
  });
  await runBillingCases({ sql, concurrentSql, roleSql, as, users });
  await runReviewCases({ sql, concurrentSql, roleSql, as, users, json });
  await runAssetCases({ sql, concurrentSql, roleSql, as, users });
  await runArchiveCases({ sql, as, users, json });
  await runNoteSearchCases({ sql, as, users, json });
  await runAccountCases({ sql, concurrentSql, roleSql, as, json });
  console.log(`${count} database scenarios plus billing/review authorization/concurrency passed.`);
}
