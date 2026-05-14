import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_DIR = join(process.cwd(), "supabase", "migrations");
const GRANT_MIGRATION = join(MIGRATION_DIR, "0025_data_api_explicit_grants.sql");

const expectedPublicTables = [
  "admin_binder_summaries",
  "binder_lessons",
  "binders",
  "chem_concepts",
  "chem_lab_templates",
  "chem_problem_templates",
  "comments",
  "concept_edges",
  "concept_nodes",
  "dashboard_binder_summaries",
  "dashboard_folder_summaries",
  "dashboard_lesson_summaries",
  "enrollments",
  "folder_binders",
  "folders",
  "highlights",
  "history_argument_chains",
  "history_argument_edges",
  "history_argument_nodes",
  "history_event_templates",
  "history_events",
  "history_evidence_cards",
  "history_myth_check_templates",
  "history_myth_checks",
  "history_source_templates",
  "history_sources",
  "learner_notes",
  "math_courses",
  "math_graph_states",
  "math_modules",
  "math_topics",
  "personal_note_binders",
  "personal_note_documents",
  "personal_note_folders",
  "personal_notes",
  "profiles",
  "purchases",
  "question_attempts",
  "question_bank",
  "question_choices",
  "quiz_attempts",
  "quiz_set_questions",
  "quiz_sets",
  "seed_versions",
  "study_sessions",
  "suite_templates",
  "summary_refresh_job_dedupe",
  "tutorial_entries",
  "tutorial_video_summaries",
  "user_chem_attempts",
  "user_chem_mastery",
  "user_lab_reports",
  "user_lab_runs",
  "user_recent_items",
  "whiteboard_assets",
  "whiteboard_versions",
  "whiteboards",
  "workspace_activity_events",
  "workspace_preferences",
  "workspace_presets",
].sort();

const anonReadableTables = [
  "binder_lessons",
  "binders",
  "concept_edges",
  "concept_nodes",
  "dashboard_binder_summaries",
  "dashboard_lesson_summaries",
  "history_event_templates",
  "history_myth_check_templates",
  "history_source_templates",
  "math_courses",
  "math_graph_states",
  "math_modules",
  "math_topics",
  "question_bank",
  "question_choices",
  "seed_versions",
  "suite_templates",
  "tutorial_entries",
  "tutorial_video_summaries",
  "workspace_presets",
].sort();

const privateNoAnonTables = [
  "admin_binder_summaries",
  "chem_concepts",
  "chem_lab_templates",
  "chem_problem_templates",
  "comments",
  "dashboard_folder_summaries",
  "enrollments",
  "folder_binders",
  "folders",
  "highlights",
  "history_argument_chains",
  "history_argument_edges",
  "history_argument_nodes",
  "history_events",
  "history_evidence_cards",
  "history_myth_checks",
  "history_sources",
  "learner_notes",
  "personal_note_binders",
  "personal_note_documents",
  "personal_note_folders",
  "personal_notes",
  "profiles",
  "purchases",
  "question_attempts",
  "quiz_attempts",
  "quiz_set_questions",
  "quiz_sets",
  "study_sessions",
  "summary_refresh_job_dedupe",
  "user_chem_attempts",
  "user_chem_mastery",
  "user_lab_reports",
  "user_lab_runs",
  "user_recent_items",
  "whiteboard_assets",
  "whiteboard_versions",
  "whiteboards",
  "workspace_activity_events",
  "workspace_preferences",
].sort();

const authenticatedCrudTables = [
  "binder_lessons",
  "binders",
  "chem_concepts",
  "chem_lab_templates",
  "chem_problem_templates",
  "comments",
  "concept_edges",
  "concept_nodes",
  "folder_binders",
  "folders",
  "highlights",
  "history_argument_chains",
  "history_argument_edges",
  "history_argument_nodes",
  "history_event_templates",
  "history_events",
  "history_evidence_cards",
  "history_myth_check_templates",
  "history_myth_checks",
  "history_source_templates",
  "history_sources",
  "learner_notes",
  "math_courses",
  "math_graph_states",
  "math_modules",
  "math_topics",
  "personal_note_binders",
  "personal_note_documents",
  "personal_note_folders",
  "personal_notes",
  "question_attempts",
  "question_bank",
  "question_choices",
  "quiz_attempts",
  "quiz_set_questions",
  "quiz_sets",
  "suite_templates",
  "tutorial_entries",
  "user_chem_attempts",
  "user_chem_mastery",
  "user_lab_reports",
  "user_lab_runs",
  "user_recent_items",
  "whiteboards",
  "workspace_preferences",
  "workspace_presets",
].sort();

const authenticatedSelectOnlyTables = [
  "admin_binder_summaries",
  "dashboard_binder_summaries",
  "dashboard_folder_summaries",
  "dashboard_lesson_summaries",
  "purchases",
  "seed_versions",
  "summary_refresh_job_dedupe",
  "tutorial_video_summaries",
].sort();

const authenticatedSelectInsertTables = [
  "enrollments",
  "whiteboard_versions",
  "workspace_activity_events",
].sort();

const authenticatedSelectInsertUpdateTables = [
  "study_sessions",
].sort();

const authenticatedSelectInsertDeleteTables = [
  "whiteboard_assets",
].sort();

const readMigrations = () =>
  readdirSync(MIGRATION_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      file,
      sql: readFileSync(join(MIGRATION_DIR, file), "utf8"),
    }));

const normalizeSql = (sql: string) => sql.toLowerCase().replace(/\s+/g, " ").trim();

const allMigrationSql = () => readMigrations().map(({ sql }) => sql).join("\n");

const publicTablesCreatedByMigrations = () => {
  const tables = new Set<string>();
  const createTablePattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi;
  for (const { sql } of readMigrations()) {
    let match: RegExpExecArray | null;
    while ((match = createTablePattern.exec(sql))) {
      tables.add(match[1]);
    }
  }
  return [...tables].sort();
};

const expectTableGrant = (grantSql: string, table: string, privileges: string, role: string) => {
  const normalized = normalizeSql(grantSql);
  expect(normalized, `${table} should grant ${privileges} to ${role}`).toContain(
    `grant ${privileges} on table public.${table} to ${role};`,
  );
};

describe("Supabase Data API explicit grants", () => {
  it("keeps an inventory of every table created in public", () => {
    expect(publicTablesCreatedByMigrations()).toEqual(expectedPublicTables);
  });

  it("enables RLS for every public table exposed through migrations", () => {
    const normalized = normalizeSql(allMigrationSql());

    for (const table of expectedPublicTables) {
      expect(normalized, `${table} should enable RLS`).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("adds explicit Data API grants for anon, authenticated, and service_role", () => {
    expect(existsSync(GRANT_MIGRATION)).toBe(true);
    const grantSql = readFileSync(GRANT_MIGRATION, "utf8");
    const normalized = normalizeSql(grantSql);

    expect(normalized).toContain("grant usage on schema public to anon, authenticated, service_role;");

    for (const table of expectedPublicTables) {
      expectTableGrant(grantSql, table, "select, insert, update, delete", "service_role");
    }

    for (const table of anonReadableTables) {
      expectTableGrant(grantSql, table, "select", "anon");
    }

    for (const table of authenticatedCrudTables) {
      expectTableGrant(grantSql, table, "select, insert, update, delete", "authenticated");
    }

    for (const table of authenticatedSelectOnlyTables) {
      expectTableGrant(grantSql, table, "select", "authenticated");
    }

    for (const table of authenticatedSelectInsertTables) {
      expectTableGrant(grantSql, table, "select, insert", "authenticated");
    }

    for (const table of authenticatedSelectInsertUpdateTables) {
      expectTableGrant(grantSql, table, "select, insert, update", "authenticated");
    }

    for (const table of authenticatedSelectInsertDeleteTables) {
      expectTableGrant(grantSql, table, "select, insert, delete", "authenticated");
    }

    expect(normalized).toContain("grant select, insert on table public.profiles to authenticated;");
    expect(normalized).toContain(
      "grant update (full_name, appearance_settings, updated_at) on public.profiles to authenticated;",
    );
  });

  it("does not grant anon access to private user-owned or admin-only tables", () => {
    expect(existsSync(GRANT_MIGRATION)).toBe(true);
    const normalized = normalizeSql(readFileSync(GRANT_MIGRATION, "utf8"));

    for (const table of privateNoAnonTables) {
      expect(normalized, `${table} should not be granted to anon`).not.toMatch(
        new RegExp(`grant [^;]+ on table public\\.${table} to anon;`),
      );
    }

    expect(normalized).not.toMatch(/grant\s+[^;]*(insert|update|delete)[^;]*\s+on\s+table\s+public\.[a-z0-9_]+\s+to\s+anon;/);
  });

  it("documents sequence grant status and fails if a new public identity sequence is added without lint coverage", () => {
    const migrationSql = allMigrationSql();
    const sequenceBackedTables = expectedPublicTables.filter((table) => {
      const tablePattern = new RegExp(
        `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
        "i",
      );
      const block = migrationSql.match(tablePattern)?.[1] ?? "";
      return /\b(bigserial|serial)\b|generated\s+(?:always|by\s+default)\s+as\s+identity/i.test(block);
    });

    expect(sequenceBackedTables).toEqual([]);
    expect(normalizeSql(readFileSync(GRANT_MIGRATION, "utf8"))).toContain(
      "sequence grants: no public tables currently use serial, bigserial, or identity columns.",
    );
  });
});
