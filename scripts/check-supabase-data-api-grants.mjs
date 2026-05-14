import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationDir = join(root, "supabase", "migrations");
const grantMigrationPath = join(migrationDir, "0025_data_api_explicit_grants.sql");

function normalizeSql(sql) {
  return sql.toLowerCase().replace(/\s+/g, " ").trim();
}

function readMigrations() {
  return readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      file,
      sql: readFileSync(join(migrationDir, file), "utf8"),
    }));
}

function publicTablesFromMigrations(migrations) {
  const tables = new Set();
  const createTablePattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi;

  for (const { sql } of migrations) {
    let match;
    while ((match = createTablePattern.exec(sql))) {
      tables.add(match[1]);
    }
  }

  return [...tables].sort();
}

function hasTablePolicy(sql, table) {
  return new RegExp(`create\\s+policy[\\s\\S]+?on\\s+public\\.${table}\\b`, "i").test(sql);
}

function hasRls(sql, table) {
  return normalizeSql(sql).includes(`alter table public.${table} enable row level security;`);
}

function hasServiceRoleGrant(grantSql, table) {
  return normalizeSql(grantSql).includes(
    `grant select, insert, update, delete on table public.${table} to service_role;`,
  );
}

function sequenceBackedTables(sql, tables) {
  return tables.filter((table) => {
    const tablePattern = new RegExp(
      `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
      "i",
    );
    const block = sql.match(tablePattern)?.[1] ?? "";
    return /\b(bigserial|serial)\b|generated\s+(?:always|by\s+default)\s+as\s+identity/i.test(block);
  });
}

function main() {
  const failures = [];
  const migrations = readMigrations();
  const allSql = migrations.map(({ sql }) => sql).join("\n");
  const tables = publicTablesFromMigrations(migrations);

  if (!existsSync(grantMigrationPath)) {
    failures.push("Missing supabase/migrations/0025_data_api_explicit_grants.sql.");
  }

  const grantSql = existsSync(grantMigrationPath) ? readFileSync(grantMigrationPath, "utf8") : "";
  const normalizedGrantSql = normalizeSql(grantSql);

  if (!normalizedGrantSql.includes("grant usage on schema public to anon, authenticated, service_role;")) {
    failures.push("Missing schema usage grant for anon, authenticated, and service_role.");
  }

  for (const table of tables) {
    if (!hasRls(allSql, table)) {
      failures.push(`public.${table} is created without ALTER TABLE ... ENABLE ROW LEVEL SECURITY.`);
    }

    if (!hasTablePolicy(allSql, table)) {
      failures.push(`public.${table} is created without a CREATE POLICY statement.`);
    }

    if (!hasServiceRoleGrant(grantSql, table)) {
      failures.push(`public.${table} is missing an explicit service_role Data API grant.`);
    }
  }

  const anonWritePattern =
    /grant\s+[^;]*(insert|update|delete)[^;]*\s+on\s+table\s+public\.[a-z0-9_]+\s+to\s+anon;/i;
  if (anonWritePattern.test(grantSql)) {
    failures.push("Anon has a table write grant. Add this only with a documented, intentional public-write policy.");
  }

  const sequenceTables = sequenceBackedTables(allSql, tables);
  if (sequenceTables.length > 0 && !normalizedGrantSql.includes("grant usage, select on sequence")) {
    failures.push(
      `Sequence-backed public tables need explicit sequence grants: ${sequenceTables
        .map((table) => `public.${table}`)
        .join(", ")}.`,
    );
  }

  if (failures.length > 0) {
    console.error("Supabase Data API grant lint failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Supabase Data API grant lint passed for ${tables.length} public tables.`);
}

main();
