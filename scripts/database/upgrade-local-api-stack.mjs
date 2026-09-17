import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { readMigrationBundle } from "./migration-bundle.mjs";
assert(process.env.BINDERNOTES_LOCAL_RUNTIME, "Set outside-repository BINDERNOTES_LOCAL_RUNTIME");
const runtime = process.env.BINDERNOTES_LOCAL_RUNTIME;
const manifest = JSON.parse(await readFile(path.join(runtime, "local-api-stack.json"), "utf8"));
assert.equal(manifest.apiUrl, "http://127.0.0.1:55442");
assert(
  /^bindernotes_api_[a-f0-9]{32}$/.test(manifest.database),
  "Only the local disposable stack is supported",
);
const requested = process.argv.slice(2);
assert(
  requested.length && requested.every((value) => /^00[3-9]\d$|^0029$/.test(value)),
  "Explicit additive versions0029+ required",
);
function sql(statement) {
  const result = spawnSync(
    path.join(runtime, "pgsql/bin/psql.exe"),
    [
      "-X",
      "-h",
      "127.0.0.1",
      "-p",
      "55439",
      "-U",
      "postgres",
      "-d",
      manifest.database,
      "-q",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: statement, encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
for (const migration of await readMigrationBundle()) {
  if (!requested.includes(migration.version)) continue;
  if (
    sql(
      `select count(*) from supabase_migrations.schema_migrations where version='${migration.version}';`,
    ) === "1"
  ) {
    console.log(`Already applied ${migration.version}; historical SQL was not rerun.`);
    continue;
  }
  sql(
    `begin;${migration.sql}\ninsert into supabase_migrations.schema_migrations(version,name) values('${migration.version}','${migration.name}');notify pgrst,'reload schema';commit;`,
  );
  console.log(`Applied ${migration.version} to disposable local Auth stack; users retained.`);
}
