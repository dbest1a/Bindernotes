import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readMigrationBundle, projectRoot } from "../database/migration-bundle.mjs";

// Full Linux Supabase runtime. Deliberately never consumes hosted env credentials.
assert.equal(process.env.CI, "true", "This orchestrator requires an isolated CI worker with Docker");
const baseline = process.argv[2] ?? "clean";
assert(["clean", "0015", "0025", "production-observed"].includes(baseline));
const directory = path.join(projectRoot, ".tmp", "ci-supabase");
await mkdir(path.dirname(directory), { recursive: true });
await mkdir(directory, { recursive: false });
function command(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${binary} failed; no credential-bearing output is included in CI logs`);
  return result.stdout;
}
command("supabase", ["init", "--workdir", directory]);
const configPath = path.join(directory, "supabase/config.toml");
let config = await readFile(configPath, "utf8");
config = config.replace(/^project_id = .+$/m, 'project_id = "bindernotes-ci"');
config = config.replace(/^major_version = \d+$/m, "major_version = 17");
await writeFile(configPath, config);
const migrations = await readMigrationBundle();
const checkpoint = baseline === "production-observed" ? "0018" : baseline;
const migrationDirectory = path.join(directory, "supabase/migrations");
await mkdir(migrationDirectory, { recursive: true });
for (const item of migrations) if (baseline === "clean" || item.version <= checkpoint) await writeFile(path.join(migrationDirectory, item.name), item.sql);
command("supabase", ["start", "--workdir", directory]);
const status = JSON.parse(command("supabase", ["status", "--workdir", directory, "--output", "json"]));
const dbUrl = new URL(status.DB_URL); const apiUrl = new URL(status.API_URL);
assert(["127.0.0.1", "localhost"].includes(dbUrl.hostname));
assert(["127.0.0.1", "localhost"].includes(apiUrl.hostname));
assert.equal(dbUrl.pathname, "/postgres");
const pgEnv = { ...process.env, PGHOST: dbUrl.hostname, PGPORT: dbUrl.port, PGUSER: dbUrl.username, PGPASSWORD: decodeURIComponent(dbUrl.password), PGDATABASE: "postgres" };
const pgArgs = ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"];
function sql(input) {
  const result = spawnSync("psql", pgArgs, { input, env: pgEnv, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
function concurrentSql(input) {
  return new Promise((resolve) => {
    const child = spawn("psql", pgArgs, { env: pgEnv }); let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => resolve({ status: -1, stderr: error.message, stdout }));
    child.on("close", (status) => resolve({ status, stdout, stderr })); child.stdin.end(input);
  });
}
if (baseline !== "clean") {
  if (baseline === "production-observed") {
    sql("grant all on all tables in schema public to anon,authenticated;");
    for (const version of ["0020", "0021", "0022"]) { const item = migrations.find((migration) => migration.version === version); assert(item); sql(item.sql); }
  }
  const id = "90000000-0000-4000-8000-000000000001";
  sql(`insert into auth.users(id,email) values('${id}','upgrade@disposable.invalid');
    insert into public.binders(id,owner_id,title,slug,status) values('upgrade-binder','${id}','Preserve','upgrade-binder','published');
    insert into public.binder_lessons(id,binder_id,title) values('upgrade-lesson','upgrade-binder','Preserve');
    insert into public.learner_notes(id,owner_id,binder_id,lesson_id,title,content) values('upgrade-note','${id}','upgrade-binder','upgrade-lesson','Preserve title','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Meaningful pre-upgrade student content"}]}]}');`);
  const select = `select jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where id='${id}'),'note',(select to_jsonb(n)-'revision' from public.learner_notes n where id='upgrade-note'))::text;`;
  const before = JSON.parse(sql(select));
  for (const item of migrations) if (item.version > checkpoint) await writeFile(path.join(migrationDirectory, item.name), item.sql);
  command("supabase", ["migration", "up", "--local", "--workdir", directory]);
  assert.deepEqual(JSON.parse(sql(select)), before);
  console.log(`PASS actual Supabase ${baseline} upgrade preserves populated student content`);
}
await (await import("../database/runtime-cases.mjs")).run({ sql, concurrentSql });
const fixture = JSON.parse(command(process.execPath, ["--import", "tsx", "scripts/database/catalog-fixture.ts"]));
const payload = JSON.stringify(fixture).replaceAll("'", "''");
const seed = `begin; set local role service_role; select public.apply_catalog_seed('${payload}'::jsonb); commit;`;
assert.deepEqual(JSON.parse(sql(seed)), JSON.parse(sql(seed)));
const admin = createClient(apiUrl.href, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [];
for (const name of ["learner-a", "learner-b", "creator", "operator"]) {
  const email = `${name}@bindernotes.invalid`; const password = `Test-${randomBytes(20).toString("base64url")}!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Local ${name}` } });
  assert(!error && data.user, "Disposable Auth user creation failed");
  users.push({ name, email, password, id: data.user.id });
  if (name === "operator") sql(`update public.profiles set role='admin' where id='${data.user.id}';`);
  if (name === "creator") sql(`insert into public.account_entitlements(user_id,plan,status) values('${data.user.id}','studio','active');`);
}
await writeFile(path.join(directory, "runtime.json"), JSON.stringify({ apiUrl: apiUrl.origin, anonKey: status.ANON_KEY, users, run: randomUUID() }));
console.log("PASS full Supabase schema, role/concurrency suites, catalogs and real disposable Auth accounts prepared");
