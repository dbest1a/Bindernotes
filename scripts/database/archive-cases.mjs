import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function runArchiveCases({ sql, as, users, json }) {
  const timestamp = "2026-09-17T00:00:00Z";
  const names = [
    "personal_note_folders",
    "personal_note_binders",
    "personal_note_documents",
    "personal_notes",
    "folders",
    "binders",
    "binder_lessons",
    "folder_binders",
    "learner_notes",
    "comments",
    "highlights",
    "whiteboards",
    "whiteboard_versions",
  ];
  const make = () => {
    const owner = users.b,
      folder = randomUUID(),
      binder = randomUUID(),
      document = randomUUID(),
      note = randomUUID(),
      source = randomUUID(),
      lesson = randomUUID(),
      linked = randomUUID();
    const base = { owner_id: owner, created_at: timestamp, updated_at: timestamp };
    const body = {
      title: "Archive body",
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Preserve this exact sentence" }] }],
      },
      math_blocks: [{ id: "equation", type: "latex", latex: "x^2+1" }],
      pinned: true,
    };
    const tables = Object.fromEntries(names.map((name) => [name, []]));
    tables.personal_note_folders = [
      { ...base, id: folder, name: "Archive folder", color: "teal", sort_order: 0, archived_at: null },
    ];
    tables.personal_note_binders = [
      {
        ...base,
        id: binder,
        folder_id: folder,
        title: "Archive notebook",
        description: null,
        color: null,
        pinned: true,
        sort_order: 0,
        archived_at: null,
      },
    ];
    tables.personal_note_documents = [
      {
        ...base,
        id: document,
        binder_id: binder,
        ...body,
        tags: ["equation"],
        archived_at: null,
        revision: 7,
      },
    ];
    tables.personal_notes = [
      {
        ...base,
        id: note,
        folder_id: folder,
        binder_id: binder,
        document_id: document,
        ...body,
        tags: ["keep"],
        archived_at: null,
        revision: 3,
      },
    ];
    tables.binders = [
      {
        ...base,
        id: source,
        title: "Source copy",
        slug: `imported-${source}`,
        description: "Original source provenance retained",
        subject: "Math",
        level: "Algebra",
        status: "draft",
        price_cents: 0,
        cover_url: null,
        pinned: false,
      },
    ];
    tables.binder_lessons = [
      {
        id: lesson,
        binder_id: source,
        title: "Source lesson",
        order_index: 0,
        content: body.content,
        math_blocks: body.math_blocks,
        is_preview: false,
        created_at: timestamp,
        updated_at: timestamp,
      },
    ];
    tables.learner_notes = [
      { ...base, id: linked, binder_id: source, lesson_id: lesson, folder_id: null, ...body, revision: 9 },
    ];
    const parent = randomUUID(),
      child = randomUUID();
    tables.comments = [
      {
        ...base,
        id: child,
        binder_id: source,
        lesson_id: lesson,
        anchor_text: null,
        body: "Child comment",
        parent_id: parent,
        resolved_at: null,
      },
      {
        ...base,
        id: parent,
        binder_id: source,
        lesson_id: lesson,
        anchor_text: "Source quote",
        body: "Parent comment",
        parent_id: null,
        resolved_at: null,
      },
    ];
    tables.highlights = [
      {
        ...base,
        id: randomUUID(),
        binder_id: source,
        lesson_id: lesson,
        anchor_text: "Source quote",
        color: "yellow",
        note_id: linked,
        start_offset: 0,
        end_offset: 12,
        document_id: lesson,
        source_version_id: null,
        selected_text: "Source quote",
        prefix_text: null,
        suffix_text: null,
        selector_json: { textQuote: { exact: "Source quote" } },
        status: "active",
        reanchor_confidence: 1,
      },
    ];
    const board = randomUUID();
    tables.whiteboards = [
      {
        ...base,
        id: board,
        binder_id: source,
        lesson_id: lesson,
        title: "Archived whiteboard",
        subject: "Math",
        module_context: "lesson",
        scene_json: {
          elements: [{ id: "rectangle", type: "rectangle", x: 0, y: 0, width: 100, height: 80 }],
        },
        module_elements: [],
        scene_size_bytes: 100,
        asset_size_bytes: 0,
        object_count: 1,
        archived_at: timestamp,
        revision: 8,
      },
    ];
    tables.whiteboard_versions = [
      {
        id: randomUUID(),
        whiteboard_id: board,
        version: 1,
        scene_json: { elements: [], appState: { viewBackgroundColor: "#ffffff" } },
        module_elements: [],
        scene_size_bytes: 60,
        created_at: timestamp,
        created_by: owner,
        version_kind: "manual",
      },
    ];
    return {
      format: "bindernotes-archive",
      version: 1,
      ownerId: owner,
      exportedAt: timestamp,
      tables,
      reviews: [],
      reviewEvents: [],
      recallSessions: [],
      assets: [],
      localMath: { schemaVersion: 1, ownerId: owner, problemLogs: [], formulaCards: [], graphLinks: [] },
      deviceRecovery: [],
      sourceProvenance: [
        {
          binderId: source,
          sourceBinderId: "original-source",
          sourceOwnerId: users.a,
          sourceSlug: "published-source",
          sourceStatus: "published",
        },
      ],
    };
  };
  const call = (archive, batch = randomUUID(), digest = randomUUID().replaceAll("-", "").repeat(2)) =>
    `select public.import_portable_workspace(${json(archive)},'${batch}','${digest}');`;
  const forged = make();
  forged.tables.personal_notes[0].owner_id = users.a;
  assert.throws(() => as(users.b, call(forged)), /ARCHIVE_OWNER_MISMATCH/);
  assert.equal(
    sql(
      `select count(*) from public.personal_note_folders where id='${forged.tables.personal_note_folders[0].id}';`,
    ),
    "0",
    "Earlier parent insert must roll back",
  );
  const orphan = make();
  orphan.tables.personal_notes[0].binder_id = randomUUID();
  assert.throws(() => as(users.b, call(orphan)), /ARCHIVE_PARENT_MISSING/);
  assert.equal(
    sql(
      `select count(*) from public.personal_note_documents where id='${orphan.tables.personal_note_documents[0].id}';`,
    ),
    "0",
  );
  const published = make();
  published.tables.binders[0].status = "published";
  assert.throws(() => as(users.b, call(published)), /ARCHIVE_SOURCES_MUST_BE_PRIVATE/);
  const invalid = make();
  invalid.tables.personal_notes[0].pinned = "true";
  assert.throws(() => as(users.b, call(invalid)), /INVALID_ARCHIVE_FIELD_TYPE/);
  const unsafe = make();
  unsafe.tables.personal_notes[0].content = {
    type: "doc",
    content: [{ type: "image", attrs: { src: "java\nscript:alert(1)" } }],
  };
  assert.throws(() => as(users.b, call(unsafe)), /INVALID_ARCHIVE_CONTENT/);
  assert.equal(
    sql(
      `select count(*) from public.personal_note_folders where id='${unsafe.tables.personal_note_folders[0].id}';`,
    ),
    "0",
    "Unsafe editor attributes must roll back preceding inserts",
  );
  const extra = make();
  extra.tables.personal_notes[0].unexpected = "discard me";
  assert.throws(() => as(users.b, call(extra)), /INVALID_ARCHIVE_ROW/);
  const invalidAsset = make();
  invalidAsset.assets = [
    {
      id: randomUUID(),
      name: "missing.pdf",
      mime_type: "application/pdf",
      size_bytes: 9,
      sha256: "a".repeat(64),
    },
  ];
  assert.throws(() => as(users.b, call(invalidAsset)), /ARCHIVE_ASSET_NOT_STAGED/);
  assert.equal(
    sql(`select count(*) from public.learner_notes where id='${invalidAsset.tables.learner_notes[0].id}';`),
    "0",
    "Missing file must roll back all content",
  );
  const wrongComment = make();
  wrongComment.tables.comments[0].parent_id = randomUUID();
  assert.throws(() => as(users.b, call(wrongComment)), /ARCHIVE_PARENT_MISSING/);
  const archive = make(),
    batch = randomUUID(),
    digest = randomUUID().replaceAll("-", "").repeat(2);
  assert.throws(() => as(null, call(archive, batch, digest), "anon"), /permission denied/);
  const counts = JSON.parse(as(users.b, call(archive, batch, digest)));
  assert.equal(counts.personal_notes, 1);
  assert.equal(counts.learner_notes, 1);
  assert.deepEqual(
    JSON.parse(as(users.b, call(archive, batch, digest))),
    counts,
    "Uncertain-response retry must return receipt",
  );
  assert.equal(
    sql(`select count(*) from public.personal_notes where id='${archive.tables.personal_notes[0].id}';`),
    "1",
  );
  assert.equal(
    as(
      users.a,
      `select count(*) from public.personal_notes where id='${archive.tables.personal_notes[0].id}';`,
    ),
    "0",
  );
  assert.equal(
    as(users.a, `select count(*) from public.workspace_archive_imports where batch_id='${batch}';`),
    "0",
  );
  assert.equal(
    sql(`select status||':'||price_cents from public.binders where id='${archive.tables.binders[0].id}';`),
    "draft:0",
  );
  assert.equal(
    sql(`select revision from public.personal_notes where id='${archive.tables.personal_notes[0].id}';`),
    "0",
  );
  const changed = structuredClone(archive);
  changed.tables.personal_notes[0].title = "Must not overwrite";
  assert.throws(() => as(users.b, call(changed, batch, digest)), /ARCHIVE_RETRY_MISMATCH/);
  assert.throws(() => as(users.b, call(changed)), /duplicate key/);
  assert.equal(
    sql(`select title from public.personal_notes where id='${archive.tables.personal_notes[0].id}';`),
    "Archive body",
  );
  const exported = JSON.parse(as(users.b, "select public.export_portable_workspace();"));
  const exportedNote = exported.tables.personal_notes.find(
    (row) => row.id === archive.tables.personal_notes[0].id,
  );
  assert.deepEqual(exportedNote.content, archive.tables.personal_notes[0].content);
  assert.deepEqual(exportedNote.math_blocks, archive.tables.personal_notes[0].math_blocks);
  assert.deepEqual(
    exported.tables.whiteboards.find((row) => row.id === archive.tables.whiteboards[0].id).scene_json,
    archive.tables.whiteboards[0].scene_json,
  );
  assert.equal(
    exported.tables.whiteboard_versions.find((row) => row.whiteboard_id === archive.tables.whiteboards[0].id)
      .version_kind,
    "manual",
  );
  assert.equal(
    exported.tables.comments.find((row) => row.id === archive.tables.comments[0].id).parent_id,
    archive.tables.comments[1].id,
    "Child-before-parent threads restore their relationship",
  );
  assert.deepEqual(
    exported.tables.highlights.find((row) => row.id === archive.tables.highlights[0].id).selector_json,
    archive.tables.highlights[0].selector_json,
  );
  assert(exported.tables.binders.some((row) => row.id === archive.tables.binders[0].id));
  assert(
    exported.tables.binder_lessons.some((row) => row.id === archive.tables.binder_lessons[0].id),
    "Fresh owner must read private restored source lessons without creator entitlement",
  );
  console.log(
    "PASS archive transaction rollback, strict types/fields/parents/assets, private source copies, owner isolation, exact retry receipt and non-destructive insert-only restore/export",
  );
}
