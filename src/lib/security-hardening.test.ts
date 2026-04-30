import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const securityMigrationPath = "supabase/migrations/0019_security_hardening_rls.sql";
const advisorCleanupMigrationPath =
  "supabase/migrations/0020_supabase_security_advisor_lint_cleanup.sql";
const clientPrivilegeLockMigrationPath =
  "supabase/migrations/0021_lock_profile_and_purchase_client_privileges.sql";
const performanceAdvisorCleanupMigrationPath =
  "supabase/migrations/0022_supabase_performance_advisor_cleanup.sql";

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function normalized(path: string) {
  return readSource(path).replace(/\s+/g, " ").toLowerCase();
}

describe("security hardening migration", () => {
  it("keeps private notes, documents, comments, and highlights owner-scoped by RLS", () => {
    const personalNotesSql = normalized("supabase/migrations/0016_personal_notes_workspace.sql");
    const accountNotesSql = normalized("supabase/migrations/0005_align_content_ids_with_app_routes.sql");

    for (const table of [
      "personal_notes",
      "personal_note_folders",
      "personal_note_binders",
      "personal_note_documents",
    ]) {
      expect(personalNotesSql).toContain(`alter table public.${table} enable row level security`);
      expect(personalNotesSql).toContain(`create policy "${table} select own" on public.${table}`);
      expect(personalNotesSql).toContain("for select using (owner_id = auth.uid())");
      expect(personalNotesSql).toContain("with check (owner_id = auth.uid())");
    }

    for (const policy of ["learner notes own", "comments own", "highlights own"]) {
      expect(accountNotesSql).toContain(`create policy "${policy}"`);
    }
    expect(accountNotesSql).toContain("for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())");
  });

  it("blocks profile role self-promotion while preserving safe profile edits", () => {
    const sql = normalized(securityMigrationPath);
    const authSource = readSource("src/hooks/use-auth.tsx");
    const binderService = readSource("src/services/binder-service.ts");

    expect(sql).toContain('drop policy if exists "profiles insert own"');
    expect(sql).toContain('create policy "profiles insert own learner"');
    expect(sql).toContain("role = 'learner'");
    expect(sql).toContain("revoke update on public.profiles from anon, authenticated");
    expect(sql).toContain("grant update (full_name, updated_at) on public.profiles to authenticated");
    expect(sql).not.toMatch(/grant update \([^)]*role[^)]*\) on public\.profiles/);

    expect(authSource).not.toMatch(/data:\s*{[^}]*role/s);
    expect(binderService).not.toMatch(/from\("profiles"\)[\s\S]{0,500}role:\s*bootstrap\.role/);
  });

  it("keeps purchase and entitlement state server-controlled", () => {
    const sql = normalized(securityMigrationPath);

    expect(sql).toContain('drop policy if exists "purchases insert own placeholder"');
    expect(sql).toContain("revoke insert, update, delete on public.purchases from anon, authenticated");
    expect(sql).toContain("grant select on public.purchases to authenticated");
    expect(sql).not.toContain('create policy "purchases insert');
    expect(sql).not.toContain('create policy "purchases update');
  });

  it("prevents learners from publishing global question bank rows", () => {
    const sql = normalized(securityMigrationPath);

    expect(sql).toContain('create policy "questions insert own drafts"');
    expect(sql).toContain('create policy "questions update own drafts"');
    expect(sql).toContain('create policy "questions delete own drafts"');
    expect(sql).toContain("created_by = auth.uid() and status = 'draft'");
    expect(sql).toContain('create policy "choices write through owned draft question"');
    expect(sql).not.toContain("created_by = auth.uid() or public.is_admin()");
  });

  it("adds server-side whiteboard storage and version limits", () => {
    const sql = normalized(securityMigrationPath);

    expect(sql).toContain("whiteboards_scene_size_limit");
    expect(sql).toContain("whiteboards_object_count_limit");
    expect(sql).toContain("whiteboard_versions_scene_size_limit");
    expect(sql).toContain("whiteboard_assets_file_size_limit");
    expect(sql).toContain("create trigger whiteboards_enforce_payload_limits");
    expect(sql).toContain("create trigger whiteboard_versions_enforce_payload_limits");
    expect(sql).toContain("create trigger whiteboard_versions_prune_history");
    expect(sql).toContain("offset 10");
  });

  it("locks down exposed security definer helper RPCs from browser roles", () => {
    const sql = normalized(securityMigrationPath);

    for (const functionName of [
      "public.handle_new_user()",
      "public.enforce_whiteboard_active_limit()",
      "public.enqueue_summary_refresh_job(text, text, text, uuid, integer)",
      "public.process_summary_refresh_queue(integer)",
      "public.refresh_all_admin_summaries()",
    ]) {
      expect(sql).toContain(`revoke execute on function ${functionName} from public, anon, authenticated`);
    }

    expect(sql).toContain("grant execute on function public.process_summary_refresh_queue(integer) to service_role");
    expect(sql).toContain("grant execute on function public.refresh_all_admin_summaries() to service_role");
  });

  it("pins function search paths and removes broad public storage listing", () => {
    const sql = normalized(securityMigrationPath);

    expect(sql).toContain("alter function public.is_admin() set search_path = public");
    expect(sql).toContain("create or replace function public.set_personal_notes_updated_at()");
    expect(sql).toContain("create or replace function public.bn_word_count(input text)");
    expect(sql).toContain("create or replace function public.bn_jsonb_plain_text(value jsonb)");
    expect(sql.match(/set search_path = public/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(sql).toContain('drop policy if exists "tutorial videos public read" on storage.objects');
    expect(sql).toContain('drop policy if exists "tutorial posters public read" on storage.objects');
  });
});

describe("security deployment guards", () => {
  it("keeps env files ignored while allowing placeholders", () => {
    const ignore = readSource(".gitignore");

    expect(ignore).toContain(".env");
    expect(ignore).toContain(".env.*");
    expect(ignore).toContain("!.env.example");
  });

  it("verifies rendered auth page text rather than only HTTP 200", () => {
    const verifier = readSource("scripts/verify-live-auth.mjs");

    for (const forbidden of [
      "Supabase configuration required",
      "Auth setup required",
      "Demo mode",
      "Learner demo",
      "Admin demo",
    ]) {
      expect(verifier).toContain(forbidden);
    }

    expect(verifier).toContain("--dump-dom");
    expect(verifier).toContain("normalizedDom.includes");
  });
});

describe("Supabase Security Advisor lint cleanup migration", () => {
  const exposedSecurityDefinerFunctions = [
    "public.can_read_suite_template(text)",
    "public.cleanup_stale_summary_refresh_jobs(interval)",
    "public.enforce_whiteboard_active_limit()",
    "public.enqueue_binder_summary_refresh()",
    "public.enqueue_folder_binder_summary_refresh()",
    "public.enqueue_folder_row_summary_refresh()",
    "public.enqueue_lesson_summary_refresh()",
    "public.enqueue_summary_refresh_job(text, text, text, uuid, integer)",
    "public.enqueue_tutorial_summary_refresh()",
    "public.handle_new_user()",
    "public.is_admin()",
    "public.owns_published_or_enrolled(text)",
    "public.process_summary_refresh_queue(integer)",
    "public.refresh_admin_binder_summary(text)",
    "public.refresh_all_admin_summaries()",
    "public.refresh_all_dashboard_summaries()",
    "public.refresh_all_tutorial_video_summaries()",
    "public.refresh_dashboard_binder_summary(text)",
    "public.refresh_dashboard_folder_summary(text)",
    "public.refresh_lesson_search_excerpt(text)",
    "public.refresh_tutorial_video_summary(text)",
  ];

  it("matches the uploaded Advisor warning shape", () => {
    expect(exposedSecurityDefinerFunctions).toHaveLength(21);
  });

  it("moves RLS helpers to a private non-exposed schema and rewrites policy references", () => {
    const sql = normalized(advisorCleanupMigrationPath);

    expect(sql).toContain("create schema if not exists private");
    expect(sql).toContain("revoke all on schema private from public");
    expect(sql).toContain("create or replace function private.is_admin()");
    expect(sql).toContain("create or replace function private.owns_published_or_enrolled(target_binder_id text)");
    expect(sql).toContain("create or replace function private.can_read_suite_template(target_suite_id text)");
    expect(sql).toContain("set search_path = public, pg_temp");
    expect(sql).toContain("grant execute on function private.is_admin() to anon, authenticated, service_role");
    expect(sql).toContain("'public.is_admin()', 'private.is_admin()'");
    expect(sql).toContain("'public.owns_published_or_enrolled(', 'private.owns_published_or_enrolled('");
    expect(sql).toContain("'public.can_read_suite_template(', 'private.can_read_suite_template('");
    expect(sql).toContain("alter policy");
  });

  it("revokes browser execute privileges from every public Security Advisor function", () => {
    const sql = normalized(advisorCleanupMigrationPath);

    for (const functionSignature of exposedSecurityDefinerFunctions) {
      expect(sql).toContain(`revoke execute on function ${functionSignature} from public`);
      expect(sql).toContain(`revoke execute on function ${functionSignature} from anon`);
      expect(sql).toContain(`revoke execute on function ${functionSignature} from authenticated`);
    }

    expect(sql).toContain("to_regprocedure('public.owns_published_or_enrolled(uuid)')");
    expect(sql).toContain("alter function public.owns_published_or_enrolled(uuid) set search_path = public, pg_temp");
    expect(sql).toContain("revoke execute on function public.owns_published_or_enrolled(uuid) from authenticated");
  });

  it("keeps only trusted server/auth grants for functions that still need direct execution", () => {
    const sql = normalized(advisorCleanupMigrationPath);

    expect(sql).toContain("grant execute on function public.handle_new_user() to supabase_auth_admin");
    expect(sql).toContain("grant execute on function public.process_summary_refresh_queue(integer) to service_role");
    expect(sql).toContain("grant execute on function public.refresh_all_dashboard_summaries() to service_role");
    expect(sql).not.toContain("grant execute on function public.is_admin() to authenticated");
    expect(sql).not.toContain("grant execute on function public.can_read_suite_template(text) to authenticated");
  });

  it("pins remaining mutable search paths and removes broad tutorial bucket listing policies", () => {
    const sql = normalized(advisorCleanupMigrationPath);

    expect(sql).toContain("alter function public.bn_word_count(text) set search_path = public, pg_temp");
    expect(sql).toContain("alter function public.set_personal_notes_updated_at() set search_path = public, pg_temp");
    expect(sql).toContain("alter function public.bn_jsonb_plain_text(jsonb) set search_path = public, pg_temp");
    expect(sql).toContain('drop policy if exists "tutorial posters public read" on storage.objects');
    expect(sql).toContain('drop policy if exists "tutorial videos public read" on storage.objects');
    expect(sql).not.toContain('create policy "tutorial posters public read"');
    expect(sql).not.toContain('create policy "tutorial videos public read"');
  });
});

describe("client privilege lock migration", () => {
  it("prevents browser roles from mutating profile roles or purchase state", () => {
    const sql = normalized(clientPrivilegeLockMigrationPath);

    expect(sql).toContain("revoke update on public.profiles from anon, authenticated");
    expect(sql).toContain("revoke update (id, email, role, created_at) on public.profiles from anon, authenticated");
    expect(sql).toContain("grant update (full_name, updated_at) on public.profiles to authenticated");
    expect(sql).not.toMatch(/grant update \([^)]*role[^)]*\) on public\.profiles/);

    expect(sql).toContain('drop policy if exists "purchases insert own placeholder" on public.purchases');
    expect(sql).toContain("revoke insert, update, delete on public.purchases from anon, authenticated");
    expect(sql).toContain("grant select on public.purchases to authenticated");
    expect(sql).toContain("notify pgrst, 'reload schema'");
  });
});

describe("Supabase Performance Advisor cleanup migration", () => {
  it("wraps row-independent auth and admin helper calls for RLS initplan performance", () => {
    const sql = readSource(performanceAdvisorCleanupMigrationPath).toLowerCase();

    expect(sql).toContain("(select auth.uid())");
    expect(sql).toContain("(select private.is_admin())");
    expect(sql).not.toMatch(/(?<!select )auth\.uid\(\)/);
    expect(sql).not.toMatch(/(?<!select )private\.is_admin\(\)/);
    expect(sql).not.toContain("public.is_admin()");
  });

  it("does not incorrectly cache row-dependent visibility helpers", () => {
    const sql = normalized(performanceAdvisorCleanupMigrationPath);

    expect(sql).toContain("private.owns_published_or_enrolled(binder_id)");
    expect(sql).toContain("private.can_read_suite_template(suite_template_id)");
    expect(sql).not.toContain("(select private.owns_published_or_enrolled(binder_id))");
    expect(sql).not.toContain("(select private.can_read_suite_template(suite_template_id))");
  });

  it("splits duplicate permissive select-causing write policies into action-specific writes", () => {
    const sql = normalized(performanceAdvisorCleanupMigrationPath);

    for (const policy of [
      '"admins write lessons"',
      '"concept nodes admin write"',
      '"concept edges admin write"',
      '"suite templates admin write"',
      '"workspace presets admin write"',
      '"admins write math courses"',
      '"admins write math topics"',
      '"admins write math modules"',
      '"quiz sets write own"',
      '"quiz attempts write own"',
      '"question attempts write own"',
    ]) {
      expect(sql).toContain(`drop policy if exists ${policy}`);
      expect(sql).not.toContain(`create policy ${policy}`);
    }

    expect(sql).toContain('create policy "admins insert lessons"');
    expect(sql).toContain('create policy "admins update lessons"');
    expect(sql).toContain('create policy "admins delete lessons"');
    expect(sql).toContain('create policy "quiz sets insert own"');
    expect(sql).toContain('create policy "quiz sets update own"');
    expect(sql).toContain('create policy "quiz sets delete own"');
  });

  it("keeps private user data owner-scoped and purchase/profile sensitive fields locked", () => {
    const sql = normalized(performanceAdvisorCleanupMigrationPath);

    for (const table of [
      "personal_notes",
      "personal_note_folders",
      "personal_note_binders",
      "personal_note_documents",
      "learner_notes",
      "comments",
      "highlights",
      "whiteboards",
      "whiteboard_versions",
      "whiteboard_assets",
    ]) {
      expect(sql).toContain(`on public.${table}`);
      expect(sql).toContain("owner_id = (select auth.uid())");
    }

    expect(sql).toContain("on public.workspace_preferences");
    expect(sql).toContain("user_id = (select auth.uid())");
    expect(sql).toContain("revoke update (id, email, role, created_at) on public.profiles from anon, authenticated");
    expect(sql).toContain("revoke insert, update, delete on public.purchases from anon, authenticated");
    expect(sql).toContain("grant select on public.purchases to authenticated");
  });

  it("keeps learner question publishing restricted and drops only the verified duplicate whiteboard index", () => {
    const sql = normalized(performanceAdvisorCleanupMigrationPath);

    expect(sql).toContain('create policy "questions insert own drafts"');
    expect(sql).toContain("created_by = (select auth.uid()) and status = 'draft'");
    expect(sql).toContain("whiteboards_owner_active_idx");
    expect(sql).toContain("whiteboards_owner_updated_idx");
    expect(sql).toContain("active_def is not null and active_def = updated_def");
    expect(sql).toContain("drop index if exists public.whiteboards_owner_active_idx");
    expect(sql).not.toContain("drop index if exists public.whiteboards_owner_updated_idx");
  });
});
