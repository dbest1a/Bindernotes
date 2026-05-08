import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0024_chemistry_learning_foundation.sql"),
  "utf8",
).replace(/\s+/g, " ")
  .toLowerCase();

describe("chemistry learning migration", () => {
  it("adds additive chemistry learning tables with RLS", () => {
    for (const table of [
      "chem_concepts",
      "chem_problem_templates",
      "user_chem_attempts",
      "user_chem_mastery",
      "chem_lab_templates",
      "user_lab_runs",
      "user_lab_reports",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("keeps learner rows owner-scoped and templates public-readable", () => {
    expect(migration).toContain('create policy "chem concepts read published"');
    expect(migration).toContain('create policy "chem problem templates read published"');
    expect(migration).toContain('create policy "user chem attempts select own"');
    expect(migration).toContain("using (user_id = (select auth.uid()))");
    expect(migration).toContain("with check (user_id = (select auth.uid()))");
  });

  it("adds required performance indexes and does not delete data", () => {
    for (const indexName of [
      "user_chem_attempts_user_created_idx",
      "user_chem_attempts_user_concept_idx",
      "user_chem_mastery_user_concept_idx",
      "user_lab_runs_user_updated_idx",
      "user_lab_reports_user_updated_idx",
    ]) {
      expect(migration).toContain(`create index if not exists ${indexName}`);
    }

    expect(migration).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/);
  });
});
