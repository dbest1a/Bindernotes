import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function runNoteSearchCases({ sql, as, users, json }) {
  const folder = randomUUID(),
    binder = randomUUID(),
    document = randomUUID(),
    hidden = randomUUID(),
    other = randomUUID(),
    lesson = randomUUID();
  const body = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Rare body phrase for search test" }] }],
  };
  sql(`insert into public.personal_notes(owner_id,title,content) select '${users.a}','Metadata title '||n,${json(body)} from generate_series(1,401)n;
    insert into public.personal_notes(id,owner_id,title,content) values('${other}','${users.b}','Other owner',${json(body)});
    insert into public.personal_note_folders(id,owner_id,name,archived_at) values('${folder}','${users.a}','Trashed ancestor',now());
    insert into public.personal_notes(id,owner_id,folder_id,title,content) values('${hidden}','${users.a}','${folder}','Hidden child',${json(body)});
    insert into public.personal_note_binders(id,owner_id,title) values('${binder}','${users.a}','Search notebook');
    insert into public.personal_note_documents(id,owner_id,binder_id,title,content) values('${document}','${users.a}','${binder}','Document metadata',${json(body)});
    insert into public.binder_lessons(id,binder_id,title) values('${lesson}','catalog','Search source');
    insert into public.learner_notes(owner_id,binder_id,lesson_id,title,content) values('${users.a}','catalog','${lesson}','Linked metadata',${json(body)});`);
  const page = (actor, offset) =>
    JSON.parse(
      as(
        actor,
        `select coalesce(jsonb_agg(r),'[]') from public.search_personal_notes('Rare body phrase',${offset},200) r;`,
      ),
    );
  const first = page(users.a, 0),
    second = page(users.a, 200),
    last = page(users.a, 400);
  assert.equal(first.length, 200);
  assert.equal(second.length, 200);
  assert.equal(last.length, 3);
  const matches = [...first, ...second, ...last];
  assert.equal(
    new Set(matches.map((row) => `${row.kind}:${row.id}`)).size,
    403,
    "Stable paging cannot repeat identities",
  );
  assert(matches.some((row) => row.kind === "binder-note"));
  assert(matches.some((row) => row.kind === "personal-document"));
  assert(
    matches.every((row) => Object.keys(row).sort().join(",") === "id,kind"),
    "Search responses must not contain full bodies",
  );
  assert(
    !matches.some((row) => row.id === hidden || row.id === other),
    "Trashed trees and other owners cannot enter search",
  );
  assert.deepEqual(page(users.b, 0), [{ kind: "personal-note", id: other }]);
  assert.equal(
    as(users.a, "select count(*) from public.search_personal_notes('%',0,200);"),
    "0",
    "Percent is literal, not a wildcard",
  );
  assert.throws(
    () => as(users.a, "select * from public.search_personal_notes('phrase',0,201);"),
    /INVALID_SEARCH_PAGE/,
  );
  assert.throws(
    () => as(null, "select * from public.search_personal_notes('phrase',0,200);", "anon"),
    /permission denied/,
  );
  console.log(
    "PASS owner-isolated note body search,403 identities across bounded pages, active-tree visibility and no body payloads",
  );
}
