import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const migration = readFileSync(
  join(repoRoot, "supabase/migrations/0023_data_quality_activity_spine.sql"),
  "utf8",
);
const normalizedMigration = migration.replace(/\s+/g, " ").toLowerCase();

function readScript(path: string) {
  return readFileSync(join(repoRoot, path), "utf8")
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("P0 data-quality migration", () => {
  it("replaces hard whiteboard version pruning with non-destructive compaction markers", () => {
    expect(normalizedMigration).toContain("drop trigger if exists whiteboard_versions_prune_history");
    expect(normalizedMigration).toContain("retention_status = 'compactable'");
    expect(normalizedMigration).toContain("create trigger whiteboard_versions_mark_compactable");
    expect(normalizedMigration).not.toContain("delete from public.whiteboard_versions");
    expect(normalizedMigration).not.toContain("truncate public.whiteboard_versions");
  });

  it("adds the activity spine with owner-scoped RLS policies", () => {
    for (const table of ["user_recent_items", "study_sessions", "workspace_activity_events"]) {
      expect(normalizedMigration).toContain(`create table if not exists public.${table}`);
      expect(normalizedMigration).toContain(`alter table public.${table} enable row level security`);
    }

    expect(normalizedMigration).toContain('create policy "user recent items select own"');
    expect(normalizedMigration).toContain('create policy "study sessions insert own"');
    expect(normalizedMigration).toContain('create policy "workspace activity events insert own"');
    expect(normalizedMigration).toContain("using (user_id = (select auth.uid()))");
    expect(normalizedMigration).toContain("with check (user_id = (select auth.uid()))");
  });

  it("adds high-confidence FK indexes without dropping advisor-reported unused indexes", () => {
    for (const indexName of [
      "comments_owner_updated_idx",
      "comments_binder_updated_idx",
      "highlights_binder_updated_idx",
      "dashboard_folder_summaries_owner_updated_idx",
      "admin_binder_summaries_owner_updated_idx",
      "whiteboard_versions_compactable_idx",
    ]) {
      expect(normalizedMigration).toContain(`create index if not exists ${indexName}`);
    }

    expect(normalizedMigration).not.toMatch(/drop\s+index/i);
  });

  it("adds dashboard summary health fields without colliding with binder publish status", () => {
    expect(normalizedMigration).toContain("add column if not exists summary_status text");
    expect(normalizedMigration).toContain("add column if not exists stale_after timestamptz");
    expect(normalizedMigration).toContain("add column if not exists refresh_error_code text");
    expect(normalizedMigration).not.toContain("add column if not exists status text");
  });

  it("keeps dry-run scripts read-only", () => {
    for (const script of [
      "scripts/whiteboard-version-retention-dry-run.sql",
      "scripts/dashboard-summary-health-check.sql",
    ]) {
      const sql = readScript(script);
      expect(sql).toContain("select");
      expect(sql).not.toMatch(/\bdelete\b|\btruncate\b|\bdrop\b|\bupdate\b|\binsert\b/);
    }
  });
});
