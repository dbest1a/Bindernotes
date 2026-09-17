import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { projectRoot, readMigrationBundle } from "./migration-bundle.mjs";

// Never read .env or use SUPABASE_DB_URL. This runner creates its own database on
// loopback and refuses any external host, even if supplied accidentally.
const host = process.env.BINDERNOTES_TEST_DB_HOST ?? "127.0.0.1";
assert(["127.0.0.1", "::1", "localhost"].includes(host), "Disposable tests require a loopback database");
const port = process.env.BINDERNOTES_TEST_DB_PORT ?? "55439";
const user = process.env.BINDERNOTES_TEST_DB_USER ?? "postgres";
const psql = path.join(
  process.env.BINDERNOTES_PG_BIN ?? "",
  process.platform === "win32" ? "psql.exe" : "psql",
);
const native = process.argv.includes("--native-no-cron");
const upgradeFrom = process.argv.find((arg) => arg.startsWith("--upgrade-from="))?.split("=")[1];
assert(
  !upgradeFrom || ["0015", "0025", "production-observed"].includes(upgradeFrom),
  "Supported upgrade states: 0015, complete 0025 or production-observed simulation",
);
const base = ["-X", "-h", host, "-p", port, "-U", user, "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t"];
const db = `bindernotes_test_${randomUUID().replaceAll("-", "")}`;
const env = { ...process.env, PGOPTIONS: "-c client_min_messages=warning" };
function sql(text, database = db) {
  const result = spawnSync(psql, [...base, "-d", database], {
    input: text,
    encoding: "utf8",
    env,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout.trim();
}
function concurrentSql(text) {
  return new Promise((resolve) => {
    const child = spawn(psql, [...base, "-d", db], { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (value) => {
      stdout += value;
    });
    child.stderr.on("data", (value) => {
      stderr += value;
    });
    child.on("error", (error) => resolve({ status: -1, stderr: error.message, stdout }));
    child.on("close", (status) => resolve({ status, stderr, stdout }));
    child.stdin.end(text);
  });
}
function nativeMigration(migration) {
  if (!native || migration.version !== "0018") return migration.sql;
  let content = migration.sql.replace(
    /^create extension if not exists (pg_cron|pgmq) with schema extensions;\r?\n/gm,
    "",
  );
  let removed = 0;
  content = content.replace(/do \$\$\s*begin\s*perform cron\.unschedule[\s\S]*?\$\$;/g, () => {
    removed++;
    return "";
  });
  content = content.replace(/select cron\.schedule\([\s\S]*?\n\);/g, () => {
    removed++;
    return "";
  });
  assert.equal(removed, 4, "Native omission must only cover the two cron registrations and unschedules");
  return content;
}
let created = false;
try {
  sql(`create database "${db}";`, "postgres");
  created = true;
  sql(await readFile(path.join(projectRoot, "scripts/database/platform-fixture.sql"), "utf8"));
  if (native) {
    const pgmqPath = process.env.BINDERNOTES_TEST_PGMQ_SQL;
    assert(pgmqPath, "Native mode requires upstream PGMQ 1.5.1 SQL via BINDERNOTES_TEST_PGMQ_SQL");
    const pgmq = await readFile(pgmqPath);
    assert.equal(
      createHash("sha256").update(pgmq).digest("hex"),
      "65b9302faa660539584769a572b57f2df76ccf1b3a2153c37cefc57b8db633e9",
    );
    sql(pgmq.toString("utf8"));
    console.log(
      "NATIVE LIMITATION: real PostgreSQL + upstream PGMQ; cron registration/worker and Supabase HTTP services are NOT tested.",
    );
  }
  const migrations = await readMigrationBundle();
  let preserved;
  const sentinelId = "90000000-0000-4000-8000-000000000001";
  const preservationQuery = `select jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where id='${sentinelId}'),
    'note',(select to_jsonb(n)-'revision' from public.learner_notes n where id='upgrade-note'))::text;`;
  for (const migration of migrations) {
    if (migration.version === "0032") {
      sql(`insert into auth.users(id,email) values('90000000-0000-4000-8000-000000000006','history@disposable.invalid');
        insert into public.whiteboards(id,owner_id,title,module_context,scene_json,scene,module_elements,modules)
          values('upgrade-history','90000000-0000-4000-8000-000000000006','Keep current','math-lab','{"elements":[],"marker":"original current"}','{"elements":[],"marker":"original current"}','[]','[]');
        insert into public.whiteboard_versions(whiteboard_id,owner_id,version,version_kind,scene_json,scene,module_elements,modules)
          values('upgrade-history','90000000-0000-4000-8000-000000000006',1,'manual','{"elements":[],"marker":"original retained"}','{"elements":[],"marker":"original retained"}','[]','[]');`);
      assert.throws(
        () =>
          sql(
            `begin;update public.whiteboards set scene='{"elements":[],"marker":"conflicting copy"}' where id='upgrade-history';${migration.sql}\ncommit;`,
          ),
        /WHITEBOARD_LEGACY_PAYLOAD_CONFLICT/,
      );
      console.log("PASS: unequal legacy scene migration fails safely and rolls back");
    }
    sql(
      `begin;\n${nativeMigration(migration)}\ninsert into supabase_migrations.schema_migrations(version,name) values('${migration.version}','${migration.name}');\ncommit;`,
    );
    if (migration.version === "0032") {
      assert.equal(
        sql("select scene_json->>'marker' from public.whiteboards where id='upgrade-history';"),
        "original current",
      );
      assert.equal(
        sql(
          "select scene_json->>'marker' from public.whiteboard_versions where whiteboard_id='upgrade-history';",
        ),
        "original retained",
      );
      console.log("PASS: canonical migration preserves current and explicitly retained legacy content");
    }
    console.log(`Applied ${migration.version}`);
    if (upgradeFrom === "production-observed" && migration.version === "0018") {
      // Read-only production metadata shows unrecorded later helpers/policies,
      // personal tables, and no whiteboard payload constraints. This is a
      // simulation of that observed shape, not a production data/schema dump.
      sql("grant all on all tables in schema public to anon,authenticated;");
      for (const version of ["0020", "0021", "0022"]) {
        const unrecorded = migrations.find((item) => item.version === version);
        assert(unrecorded);
        sql(`begin; ${unrecorded.sql} commit;`);
      }
    }
    if (
      upgradeFrom === migration.version ||
      (upgradeFrom === "production-observed" && migration.version === "0018")
    ) {
      sql(`insert into auth.users(id,email) values('${sentinelId}','upgrade@disposable.invalid');
        insert into public.binders(id,owner_id,title,slug,status) values('upgrade-binder','${sentinelId}','Preserve binder','upgrade-binder','published');
        insert into public.binder_lessons(id,binder_id,title) values('upgrade-lesson','upgrade-binder','Preserve lesson');
        insert into public.learner_notes(id,owner_id,binder_id,lesson_id,title,content)
          values('upgrade-note','${sentinelId}','upgrade-binder','upgrade-lesson','Preserve title','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Meaningful pre-upgrade student content"}]}]}');`);
      preserved = sql(preservationQuery);
      console.log(`Captured populated upgrade snapshot through ${upgradeFrom}`);
    }
  }
  if (upgradeFrom) {
    assert(preserved, "Upgrade fixture must have been captured");
    assert.deepEqual(JSON.parse(sql(preservationQuery)), JSON.parse(preserved));
    console.log(`PASS: ${upgradeFrom} upgrade preserves profile and student content`);
  }
  const tests = await import("./runtime-cases.mjs");
  await tests.run({ sql, concurrentSql });
  const fixtureResult = spawnSync(
    process.execPath,
    ["--import", "tsx", path.join(projectRoot, "scripts/database/catalog-fixture.ts")],
    { cwd: projectRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (fixtureResult.status !== 0) throw new Error(fixtureResult.stderr);
  const fixture = JSON.parse(fixtureResult.stdout);
  const payloadSql = `'${JSON.stringify(fixture).replaceAll("'", "''")}'::jsonb`;
  const seedSql = `begin; set local role service_role; select public.apply_catalog_seed(${payloadSql}); commit;`;
  const firstSeed = sql(seedSql);
  const secondSeed = sql(seedSql);
  assert.deepEqual(JSON.parse(secondSeed), JSON.parse(firstSeed));
  console.log(
    "PASS: complete actual repository system+math seed payload, twice, through trusted transaction",
  );
  const typeCheck = spawnSync(
    process.execPath,
    [path.join(projectRoot, "scripts/database/generate-types.mjs"), `--database=${db}`, "--check"],
    { env: process.env, encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  assert.equal(typeCheck.status, 0, typeCheck.stderr || typeCheck.stdout);
  console.log(typeCheck.stdout.trim());
  console.log("PASS: disposable PostgreSQL authorization and concurrency cases");
} finally {
  if (created) sql(`drop database "${db}" with (force);`, "postgres");
}
