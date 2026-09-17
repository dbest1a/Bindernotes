import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { projectRoot } from "./migration-bundle.mjs";
const runtime = process.env.BINDERNOTES_LOCAL_RUNTIME;
assert(runtime, "Set the outside-repository local runtime");
const manifest = JSON.parse(await readFile(path.join(runtime, "local-api-stack.json"), "utf8"));
assert.equal(manifest.apiUrl, "http://127.0.0.1:55442");
assert.match(manifest.database, /^bindernotes_api_[a-f0-9]{32}$/);
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
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: statement, encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
const operator = manifest.users.find((user) => user.name === "operator");
assert(operator);
const seed = spawnSync(
  process.execPath,
  ["--import", "tsx", path.join(projectRoot, "scripts/database/catalog-fixture.ts"), operator.id],
  { cwd: projectRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
assert.equal(seed.status, 0, seed.stderr);
const payload = JSON.parse(seed.stdout);
const chemistry = payload.binders.find((binder) => binder.slug === "chemistry-101-ap-chemistry");
assert(chemistry);
sql(
  `begin;set local role service_role;select public.apply_catalog_seed('${JSON.stringify(payload).replaceAll("'", "''")}'::jsonb);commit;`,
);
const password = "Local-only-" + randomUUID(),
  email = `chemistry-${randomUUID()}@disposable.invalid`;
const signup = await fetch(`${manifest.apiUrl}/auth/v1/signup`, {
  method: "POST",
  headers: { apikey: manifest.anonKey, "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
assert.equal(signup.status, 200);
const session = await signup.json();
assert(session.access_token && session.user?.id);
const owner = session.user.id;
assert.match(owner, /^[a-f0-9-]{36}$/);
try {
  const headers = {
    apikey: manifest.anonKey,
    authorization: `Bearer ${session.access_token}`,
    "content-type": "application/json",
  };
  const request = (endpoint, options = {}) =>
    fetch(`${manifest.apiUrl}/rest/v1/${endpoint}`, { headers, ...options });
  const binder = await request(`binders?id=eq.${chemistry.id}&select=id,owner_id,status`);
  assert.equal(binder.status, 200);
  const rows = await binder.json();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].owner_id, operator.id);
  assert.equal(rows[0].status, "published");
  const lessons = await request(`binder_lessons?binder_id=eq.${chemistry.id}&select=id`);
  assert.equal(lessons.status, 200);
  assert.equal((await lessons.json()).length, 77);
  const preference = {
    id: randomUUID(),
    user_id: owner,
    binder_id: chemistry.id,
    preferences: { activeModule: "acid-base", verification: "real-local-jwt" },
  };
  const saved = await request("workspace_preferences", { method: "POST", body: JSON.stringify(preference) });
  assert.equal(saved.status, 201);
  const reopened = await request(`workspace_preferences?id=eq.${preference.id}&select=preferences`);
  assert.equal(reopened.status, 200);
  assert.deepEqual((await reopened.json())[0]?.preferences, preference.preferences);
  console.log(
    "PASS real learner JWT reads operator-owned Chemistry binder/all77 lessons and persists/reopens workspace preferences; existing browser users retained",
  );
} finally {
  sql(`delete from auth.users where id='${owner}';`);
}
