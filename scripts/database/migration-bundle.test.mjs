import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "vitest";
import { projectRoot, readMigrationBundle } from "./migration-bundle.mjs";

test("bundle preserves source SQL and fingerprints the PGMQ prerequisite separately", async () => {
  const bundle = await readMigrationBundle();
  const migration = bundle.find((item) => item.version === "0018");
  assert(migration);
  const original = (
    await readFile(path.join(projectRoot, "supabase/migrations/0018_backend_performance_layer.sql"), "utf8")
  ).replace(/\r\n/g, "\n");
  assert.equal(migration.sources[0].sql, original);
  assert.equal(migration.sources[0].sha256, createHash("sha256").update(original).digest("hex"));
  assert.equal(migration.prerequisites.length, 1);
  const prerequisite = migration.prerequisites[0];
  assert.equal(prerequisite.sql, "create extension if not exists pgmq;\n");
  assert.equal(prerequisite.sha256, createHash("sha256").update(prerequisite.sql).digest("hex"));
  assert(migration.sql.endsWith(original));
  assert(migration.sql.indexOf(prerequisite.sql) < migration.sql.indexOf("-- Original:"));
  assert(bundle.filter((item) => item.version !== "0018").every((item) => item.prerequisites.length === 0));
  assert.equal(new Set(bundle.map((item) => item.version)).size, bundle.length);
});
