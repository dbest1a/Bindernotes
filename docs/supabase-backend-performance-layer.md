# Supabase Backend Performance Layer

This local-first pass makes menu pages lighter by moving count, excerpt, and health calculations out of React and into Supabase summaries.

## What Each Supabase Tool Does

- Data API: reads the new summary tables from the normal Supabase client. Dashboard and admin menu pages can ask for small rows instead of full lesson or note JSON.
- Queues: stores refresh jobs in `pgmq` so content changes do not force expensive summary work inside the user request path.
- Database Webhooks: implemented as database-change triggers that enqueue summary jobs when binders, lessons, folders, folder links, or tutorial records change. No private content is sent to third parties.
- Cron: processes queued summary refresh jobs every 10 minutes and runs a nightly full repair pass.
- Vault: intentionally unused in this pass. No new server-side secret is needed, and browser-facing Supabase env vars should not be moved into Vault.

## Summary Data Added

- `dashboard_folder_summaries`: folder card counts for the owning user.
- `dashboard_binder_summaries`: lightweight binder card data and document counts.
- `dashboard_lesson_summaries`: lesson titles, order, short text excerpts, and word counts without storing full JSON content.
- `admin_binder_summaries`: admin-only document counts, word counts, preview counts, empty counts, and content health status.
- `tutorial_video_summaries`: thumbnail, duration, title, and status fields for tutorial/video lists.

## Queue Jobs

- `rebuild_dashboard_folder_summary`
- `rebuild_dashboard_binder_summary`
- `rebuild_lesson_search_excerpt`
- `rebuild_admin_binder_summary`
- `refresh_all_dashboard_summaries`
- `refresh_all_admin_summaries`
- `refresh_tutorial_video_summary`
- `refresh_all_tutorial_video_summaries`
- `process_tutorial_video_thumbnail`
- `validate_binder_content`

Queue insertions use a dedupe key so rapid updates do not spam duplicate pending jobs.

## Cron Jobs

- `bindernotes-process-summary-refresh-queue`: runs every 10 minutes and processes queued jobs.
- `bindernotes-nightly-dashboard-summary-repair`: runs nightly and refreshes dashboard, admin, and tutorial summaries.

## Frontend Read Reduction

`getDashboard` now asks for:

- `dashboard_lesson_summaries` instead of `binder_lessons.select("*")` for menu/search data.
- metadata-only `learner_notes` fields instead of full note JSON.

If summary rows are not available yet, the code falls back to the old full lesson read so the app does not break during rollout.

## Privacy/RLS

- Dashboard folder summaries are visible only to the folder owner or admins.
- Dashboard lesson summaries use the existing `owns_published_or_enrolled` binder visibility rule.
- Admin binder summaries are admin-only.
- Tutorial summaries are visible when published or when the user is an admin.
- Private note content is not copied into any summary table.

## Local Setup Note

The Supabase CLI was not available in this workspace, so the migration was added but not applied locally from this machine. Apply `supabase/migrations/0018_backend_performance_layer.sql` through the project migration flow before relying on the summaries in a real environment.
