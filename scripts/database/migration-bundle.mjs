import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Historical files are immutable. 0016 is an explicitly reviewed pair, not an
// arbitrary duplicate to rename or silently discard.
const knownDuplicate = ["0016_dashboard_organization_ordering.sql", "0016_personal_notes_workspace.sql"];
// Full Supabase CI proved historical 0018 cannot install today's fixed-schema
// PGMQ extension into `extensions`. Install it in its declared schema first;
// the unchanged historical IF NOT EXISTS then safely observes it. This is an
// explicit bundle prerequisite, separately fingerprinted from historical SQL.
const prerequisites = new Map([
  ["0018", [{ name: "pgmq_declared_schema", sql: "create extension if not exists pgmq;\n" }]],
]);
export async function readMigrationBundle() {
  const root = path.join(projectRoot, "supabase/migrations");
  const files = (await readdir(root)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  const groups = new Map();
  for (const file of files) {
    const version = file.split("_")[0];
    groups.set(version, [...(groups.get(version) ?? []), file]);
  }
  return Promise.all(
    [...groups].map(async ([version, names]) => {
      if (names.length > 1 && JSON.stringify(names) !== JSON.stringify(knownDuplicate)) {
        throw new Error(`Unreviewed duplicate migration version: ${version}`);
      }
      const sources = await Promise.all(
        names.map(async (name) => {
          const sql = (await readFile(path.join(root, name), "utf8")).replace(/\r\n/g, "\n");
          return { name, sql, sha256: createHash("sha256").update(sql).digest("hex") };
        }),
      );
      const bootstrap = (prerequisites.get(version) ?? []).map((item) => ({
        ...item,
        sha256: createHash("sha256").update(item.sql).digest("hex"),
      }));
      return {
        version,
        name: names.length === 1 ? names[0] : "0016_reviewed_workspace_foundations.sql",
        sources,
        prerequisites: bootstrap,
        sql: [
          ...bootstrap.map((item) => `-- Reviewed prerequisite: ${item.name}\n${item.sql}`),
          ...sources.map((source) => `-- Original: ${source.name}\n${source.sql}`),
        ].join("\n"),
      };
    }),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = process.argv[2];
  if (!destination)
    throw new Error("Usage: node scripts/database/migration-bundle.mjs <new-empty-output-directory>");
  await mkdir(destination, { recursive: false });
  const bundle = await readMigrationBundle();
  for (const migration of bundle) await writeFile(path.join(destination, migration.name), migration.sql);
  await writeFile(
    path.join(destination, "manifest.json"),
    JSON.stringify(
      bundle.map(({ version, name, sources, prerequisites: bootstrap }) => ({
        version,
        name,
        sources: sources.map(({ name: sourceName, sha256 }) => ({ name: sourceName, sha256 })),
        prerequisites: bootstrap.map(({ name: prerequisiteName, sha256 }) => ({
          name: prerequisiteName,
          sha256,
        })),
      })),
      null,
      2,
    ) + "\n",
  );
  console.log(`Prepared ${bundle.length} distinct versions; both historical 0016 sources are preserved.`);
}
