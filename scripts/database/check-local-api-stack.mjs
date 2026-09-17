import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

assert(process.env.BINDERNOTES_LOCAL_RUNTIME, "Set the outside-repository BINDERNOTES_LOCAL_RUNTIME");
const manifest = JSON.parse(
  await readFile(path.join(process.env.BINDERNOTES_LOCAL_RUNTIME, "local-api-stack.json"), "utf8"),
);
assert.equal(manifest.apiUrl, "http://127.0.0.1:55442", "Local-only HTTP proof");
const sessions = {};
for (const user of manifest.users) {
  const response = await fetch(`${manifest.apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: manifest.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  assert.equal(response.status, 200, `Real password sign-in: ${user.name}`);
  const session = await response.json();
  assert.equal(session.user.id, user.id);
  assert(session.access_token);
  sessions[user.name] = { ...user, token: session.access_token, refreshToken: session.refresh_token };
}
console.log("PASS four real GoTrue password sign-ins");
async function api(name, endpoint, { method = "GET", body, prefer } = {}) {
  return fetch(`${manifest.apiUrl}/rest/v1/${endpoint}`, {
    method,
    headers: {
      apikey: manifest.anonKey,
      authorization: `Bearer ${sessions[name].token}`,
      "content-type": "application/json",
      ...(prefer ? { prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const learner = sessions["learner-a"];
let response = await api("learner-a", "profiles?select=id,role");
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), [{ id: learner.id, role: "learner" }]);
response = await api("learner-a", `profiles?id=eq.${learner.id}`, {
  method: "PATCH",
  body: { role: "admin" },
});
assert.equal(response.status, 403);
console.log("PASS real JWT owner-only profile read and role escalation denial");
const id = randomUUID();
const operation = randomUUID();
const record = {
  id,
  owner_id: learner.id,
  title: "Local HTTP proof",
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Meaningful HTTP persistence proof" }] }],
  },
  math_blocks: [],
};
const body = { p_kind: "note", p_record: record, p_expected_revision: 0, p_operation_id: operation };
response = await api("learner-a", "rpc/save_personal_content", { method: "POST", body });
assert.equal(response.status, 200);
assert.equal((await response.json()).revision, 1);
response = await api("learner-a", "rpc/save_personal_content", { method: "POST", body });
assert.equal(response.status, 200);
assert.equal((await response.json()).revision, 1);
response = await api("learner-b", `personal_notes?id=eq.${id}`);
assert.deepEqual(await response.json(), []);
response = await api("learner-b", "rpc/save_personal_content", {
  method: "POST",
  body: {
    ...body,
    p_record: { ...record, owner_id: sessions["learner-b"].id },
    p_operation_id: randomUUID(),
    p_expected_revision: 1,
  },
});
assert.equal(response.status, 403);
response = await api("learner-a", "rpc/save_personal_content", {
  method: "POST",
  body: { ...body, p_record: { ...record, title: "Stale rejected" }, p_operation_id: randomUUID() },
});
assert.equal(response.status, 500);
assert.equal((await response.json()).code, "40001");
response = await api("learner-a", `personal_notes?id=eq.${id}&select=title,revision,content`);
assert.equal(response.status, 200);
assert.deepEqual((await response.json())[0], { title: record.title, revision: 1, content: record.content });
response = await api("learner-a", "rpc/set_personal_trash", {
  method: "POST",
  body: { p_kind: "note", p_id: id, p_action: "trash" },
});
assert.equal(response.status, 200);
response = await api("learner-a", "rpc/set_personal_trash", {
  method: "POST",
  body: { p_kind: "note", p_id: id, p_action: "delete", p_confirmation: "DELETE" },
});
assert.equal(response.status, 200);
console.log("PASS real HTTP note CAS/retry/cross-owner denial/conflict/readback/cleanup");
const refreshed = await fetch(`${manifest.apiUrl}/auth/v1/token?grant_type=refresh_token`, {
  method: "POST",
  headers: { apikey: manifest.anonKey, "content-type": "application/json" },
  body: JSON.stringify({ refresh_token: learner.refreshToken }),
});
assert.equal(refreshed.status, 200);
assert.equal((await refreshed.json()).user.id, learner.id);
console.log("PASS real GoTrue refresh-token exchange; no tokens or passwords printed");
