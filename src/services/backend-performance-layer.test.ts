import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DASHBOARD_LESSON_SUMMARY_SELECT,
  DASHBOARD_NOTE_SUMMARY_SELECT,
} from "@/services/binder-service";

const migrationSql = () =>
  readFileSync(new URL("../../supabase/migrations/0018_backend_performance_layer.sql", import.meta.url), "utf8");

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
    expect(sql).toContain("cron.schedule");
    expect(sql).toContain("create trigger binders_summary_refresh_enqueue");
    expect(sql).toContain("create trigger binder_lessons_summary_refresh_enqueue");
    expect(sql).toContain("create trigger tutorial_entries_summary_refresh_enqueue");
  });

  it("protects summaries with RLS and keeps admin summaries admin-only", () => {
    const sql = migrationSql();

    expect(sql).toContain("alter table public.dashboard_folder_summaries enable row level security");
    expect(sql).toContain("alter table public.dashboard_binder_summaries enable row level security");
    expect(sql).toContain("alter table public.dashboard_lesson_summaries enable row level security");
    expect(sql).toContain("alter table public.admin_binder_summaries enable row level security");
    expect(sql).toContain("using (public.is_admin())");
    expect(sql).toContain("public.owns_published_or_enrolled(binder_id)");
  });

  it("uses lightweight dashboard selects for menu pages", () => {
    expect(DASHBOARD_LESSON_SUMMARY_SELECT).not.toContain("content");
    expect(DASHBOARD_LESSON_SUMMARY_SELECT).not.toContain("math_blocks");
    expect(DASHBOARD_NOTE_SUMMARY_SELECT).not.toContain("content");
    expect(DASHBOARD_NOTE_SUMMARY_SELECT).not.toContain("math_blocks");
  });
});
