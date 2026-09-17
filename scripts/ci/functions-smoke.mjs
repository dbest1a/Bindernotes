import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Compile and load exactly as native Node ESM, without Vite/tsx resolving imports.
const root = fileURLToPath(new URL("../../", import.meta.url));
const temporaryRoot = path.join(root, ".tmp");
await mkdir(temporaryRoot, { recursive: true });
const output = await mkdtemp(path.join(temporaryRoot, "functions-smoke-"));
const billingMessage = "Paid plans are not available yet. You can keep using the free workspace.";
const assetsMessage = "Private file uploads are not available in this environment yet.";
const expected = new Map([
  ["billing/checkout.ts", billingMessage],
  ["billing/portal.ts", billingMessage],
  ["billing/webhook.ts", billingMessage],
  ["assets/cleanup.ts", assetsMessage],
  ["assets/complete.ts", assetsMessage],
  ["assets/remove.ts", assetsMessage],
  ["account/delete.ts", "Account deletion is not available in this environment yet."],
  ["telemetry.ts", null],
]);
try {
  const compiled = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      "tsconfig.functions.json",
      "--noEmit",
      "false",
      "--outDir",
      output,
      "--pretty",
      "false",
    ],
    { cwd: root, stdio: "inherit" },
  );
  assert.equal(compiled.status, 0, "API entrypoints must compile with native Node ESM resolution");
  const entries = (await readdir(path.join(root, "api"), { recursive: true }))
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => entry.replaceAll(path.sep, "/"));
  assert.deepEqual(entries.sort(), [...expected.keys()].sort(), "Every API entrypoint needs a smoke case");

  for (const flag of [
    "BILLING_ENABLED",
    "ASSET_UPLOADS_ENABLED",
    "ACCOUNT_DELETION_ENABLED",
    "TELEMETRY_ENABLED",
  ])
    process.env[flag] = "false";
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls++;
    throw new Error("Disabled API startup must not contact external services");
  };
  for (const [entry, message] of expected) {
    const module = await import(pathToFileURL(path.join(output, "api", entry.replace(/\.ts$/, ".js"))).href);
    assert.equal(
      typeof module.default?.fetch,
      "function",
      `${entry} must export a Web Standard fetch handler`,
    );
    for (const authorization of [undefined, "Bearer smoke-test-invalid-token"]) {
      const headers = { "Content-Type": "application/json" };
      if (authorization) headers.Authorization = authorization;
      const response = await module.default.fetch(
        new Request(`https://smoke.invalid/api/${entry.replace(/\.ts$/, "")}`, {
          method: "POST",
          headers,
          body: "{}",
        }),
      );
      assert.ok(response instanceof Response, `${entry} must return a Web Response`);
      assert.equal(response.status, message ? 503 : 401, entry);
      if (message) {
        assert.deepEqual(await response.json(), { message }, entry);
        assert.equal(response.headers.get("Cache-Control"), "no-store", entry);
      } else {
        assert.equal(await response.text(), "", entry);
      }
    }
  }
  assert.equal(networkCalls, 0, "Disabled entrypoints must not contact external services");
  console.log(
    `Native ESM smoke passed: ${expected.size} API entrypoints, 16 disabled requests, no network calls.`,
  );
} finally {
  assert.equal(path.dirname(path.resolve(output)), path.resolve(temporaryRoot));
  await rm(output, { recursive: true, force: true });
}
