import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DASHBOARD_LESSON_SUMMARY_SELECT,
  DASHBOARD_NOTE_SUMMARY_SELECT,
} from "@/services/binder-service";

const migrationSql = () =>
  readFileSync(new URL("../../supabase/migrations/0018_backend_performance_layer.sql", import.meta.url), "utf8");
const binderServiceSource = () =>
  readFileSync(new URL("./binder-service.ts", import.meta.url), "utf8");
const healthCheckSql = () =>
  readFileSync(new URL("../../scripts/dashboard-summary-health-check.sql", import.meta.url), "utf8");

const expectedJobTypes = [
  "rebuild_dashboard_folder_summary",
  "rebuild_dashboard_binder_summary",
  "rebuild_lesson_search_excerpt",
  "rebuild_admin_binder_summary",
  "refresh_all_dashboard_summaries",
  "refresh_all_admin_summaries",
  "refresh_tutorial_video_summary",
  "refresh_all_tutorial_video_summaries",
  "process_tutorial_video_thumbnail",
  "validate_binder_content",
];

describe("Supabase backend performance layer", () => {
  it("adds lightweight summary structures without storing full lesson JSON", () => {
    const sql = migrationSql();

    expect(sql).toContain("create table if not exists public.dashboard_folder_summaries");
    expect(sql).toContain("create table if not exists public.dashboard_binder_summaries");
    expect(sql).toContain("create table if not exists public.dashboard_lesson_summaries");
    expect(sql).toContain("create table if not exists public.admin_binder_summaries");
    expect(sql).toContain("create table if not exists public.tutorial_video_summaries");
    expect(sql).not.toMatch(/dashboard_lesson_summaries[\s\S]*content\s+jsonb/i);
    expect(sql).not.toMatch(/dashboard_lesson_summaries[\s\S]*math_blocks\s+jsonb/i);
    expect(sql).not.toMatch(/tutorial_video_summaries[\s\S]*transcript\s+text/i);
    expect(sql).not.toMatch(/tutorial_video_summaries[\s\S]*video_url\s+text/i);
  });

  it("adds idempotent refresh, queue, cron, and database-change enqueue plumbing", () => {
    const sql = migrationSql();

    [
      "refresh_dashboard_folder_summary",
      "refresh_dashboard_binder_summary",
      "refresh_lesson_search_excerpt",
      "refresh_admin_binder_summary",
      "refresh_all_dashboard_summaries",
      "refresh_all_admin_summaries",
      "refresh_tutorial_video_summary",
      "refresh_all_tutorial_video_summaries",
      "cleanup_stale_summary_refresh_jobs",
      "enqueue_summary_refresh_job",
      "process_summary_refresh_queue",
    ].forEach((functionName) => {
      expect(sql).toContain(`public.${functionName}`);
    });

    expect(sql).toContain("create extension if not exists pg_cron");
    expect(sql).toContain("create extension if not exists pgmq");
    expect(sql).toContain("pgmq.create");
    expect(sql).toContain("pgmq.send");
    expect(sql).toContain("pgmq.read");
    expect(sql).toContain("pgmq.archive");
    expect(sql).toContain("cron.schedule");
    expect(sql).toContain("bindernotes-process-summary-refresh-queue");
    expect(sql).toContain("bindernotes-nightly-dashboard-summary-repair");
    expect(sql).toContain("create trigger binders_summary_refresh_enqueue");
    expect(sql).toContain("create trigger binder_lessons_summary_refresh_enqueue");
    expect(sql).toContain("create trigger folders_summary_refresh_enqueue");
    expect(sql).toContain("create trigger folder_binders_summary_refresh_enqueue");
    expect(sql).toContain("create trigger tutorial_entries_summary_refresh_enqueue");

    expectedJobTypes.forEach((jobType) => {
      expect(sql).toContain(jobType);
    });
  });

  it("dedupes only active queue jobs and allows completed or failed refreshes to be requeued", () => {
    const sql = migrationSql();

    expect(sql).toContain("dedupe_key");
    expect(sql).toContain("on conflict (dedupe_key) do update set");
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain("attempts = 0");
    expect(sql).toContain("where public.summary_refresh_job_dedupe.status in ('completed', 'failed')");
    expect(sql).toContain("if inserted_key is not null then");
    expect(sql).toContain("perform pgmq.send('binder_summary_refresh', job_payload)");
  });

  it("protects summaries with RLS and keeps admin summaries admin-only", () => {
    const sql = migrationSql();

    expect(sql).toContain("alter table public.dashboard_folder_summaries enable row level security");
    expect(sql).toContain("alter table public.dashboard_binder_summaries enable row level security");
    expect(sql).toContain("alter table public.dashboard_lesson_summaries enable row level security");
    expect(sql).toContain("alter table public.admin_binder_summaries enable row level security");
    expect(sql).toContain("using (public.is_admin())");
    expect(sql).toContain("public.owns_published_or_enrolled(binder_id)");
    expect(sql).toContain("status = 'published' or public.is_admin()");
    expect(sql).toContain("owner_id = auth.uid() or public.is_admin()");
  });

  it("uses lightweight dashboard selects for menu pages", () => {
    expect(DASHBOARD_LESSON_SUMMARY_SELECT).not.toContain("content");
    expect(DASHBOARD_LESSON_SUMMARY_SELECT).not.toContain("math_blocks");
    expect(DASHBOARD_NOTE_SUMMARY_SELECT).not.toContain("content");
    expect(DASHBOARD_NOTE_SUMMARY_SELECT).not.toContain("math_blocks");
  });

  it("keeps the dashboard full-lesson fallback explicit and trackable during rollout", () => {
    const source = binderServiceSource();
    const summaryReadIndex = source.indexOf('.from("dashboard_lesson_summaries")');
    const fallbackReadIndex = source.indexOf('.from("binder_lessons")', summaryReadIndex);

    expect(summaryReadIndex).toBeGreaterThan(-1);
    expect(fallbackReadIndex).toBeGreaterThan(summaryReadIndex);
    expect(source).toContain("dashboard_summary_fallback");
    expect(source).toContain("missing_summary_rows");
    expect(source).toContain("summary_query_failed");
    expect(source).toContain("DASHBOARD_NOTE_SUMMARY_SELECT");
  });

  it("adds a read-only health-check report for missing, stale, drifted, and failed summary work", () => {
    const sql = healthCheckSql();

    [
      "missing_dashboard_folder_summary",
      "missing_dashboard_binder_summary",
      "missing_dashboard_lesson_summary",
      "missing_admin_binder_summary",
      "missing_tutorial_video_summary",
      "dashboard_binder_document_count_drift",
      "admin_binder_document_count_drift",
      "queued_summary_refresh_job",
      "failed_summary_refresh_job",
    ].forEach((finding) => {
      expect(sql).toContain(finding);
    });
    expect(sql).toContain("from public.summary_refresh_job_dedupe");
    expect(sql).toContain("from public.tutorial_video_summaries");
    expect(sql).not.toContain("learner_notes.content");
  });
});
