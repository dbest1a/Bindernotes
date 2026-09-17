# Supabase Data API Grants Audit

BinderNotes uses Supabase client libraries and PostgREST-backed table access, so public-schema tables need explicit role grants in addition to RLS policies.

This audit is local-only. It does not apply migrations or mutate Supabase data.

## Future Table Checklist

Every new `public` table should ship with:

- `create table public.<table_name> (...)`
- `alter table public.<table_name> enable row level security;`
- least-privilege `grant ... on table public.<table_name> to ...;`
- RLS policies for each intended operation and role
- sequence grants only when the table uses `serial`, `bigserial`, or identity columns
- a short comment explaining anon, authenticated, and service_role access intent

Run `npm.cmd run verify:supabase-grants` after editing migrations.

## Inventory

All audited public tables currently use UUID/text primary keys and `gen_random_uuid()` defaults where generated IDs are needed. No public table currently uses `serial`, `bigserial`, or identity-backed sequences.

| Table | Created in | RLS/policy model | Anon | Authenticated | Service role | Sequence | Data API use |
| --- | --- | --- | --- | --- | --- | --- | --- |
| public.admin_binder_summaries | 0018_backend_performance_layer.sql | admin/internal summary | none | select | select/insert/update/delete | none | not currently direct |
| public.binder_lessons | 0001_binder_notes_phase1.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.binders | 0001_binder_notes_phase1.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.chem_concepts | 0024_chemistry_learning_foundation.sql | authenticated catalog/admin | none | select/insert/update/delete | select/insert/update/delete | none | not currently direct |
| public.chem_lab_templates | 0024_chemistry_learning_foundation.sql | authenticated catalog/admin | none | select/insert/update/delete | select/insert/update/delete | none | not currently direct |
| public.chem_problem_templates | 0024_chemistry_learning_foundation.sql | authenticated catalog/admin | none | select/insert/update/delete | select/insert/update/delete | none | not currently direct |
| public.comments | 0001_binder_notes_phase1.sql | private user-owned | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.concept_edges | 0001_binder_notes_phase1.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.concept_nodes | 0001_binder_notes_phase1.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.dashboard_binder_summaries | 0018_backend_performance_layer.sql | public/shared summary via RLS | select | select | select/insert/update/delete | none | not currently direct |
| public.dashboard_folder_summaries | 0018_backend_performance_layer.sql | private owner summary | none | select | select/insert/update/delete | none | not currently direct |
| public.dashboard_lesson_summaries | 0018_backend_performance_layer.sql | public/shared summary via RLS | select | select | select/insert/update/delete | none | yes |
| public.enrollments | 0001_binder_notes_phase1.sql | enrollment own/admin | none | select/insert | select/insert/update/delete | none | not currently direct |
| public.folder_binders | 0005_align_content_ids_with_app_routes.sql | private user-owned | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.folders | 0001_binder_notes_phase1.sql | private user-owned | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.highlights | 0001_binder_notes_phase1.sql | private user-owned | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.history_argument_chains | 0006_history_suite_foundation.sql | private user-owned history | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.history_argument_edges | 0006_history_suite_foundation.sql | private user-owned history | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.history_argument_nodes | 0006_history_suite_foundation.sql | private user-owned history | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.history_event_templates | 0006_history_suite_foundation.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.history_events | 0006_history_suite_foundation.sql | private user-owned history | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.history_evidence_cards | 0006_history_suite_foundation.sql | private user-owned history | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.history_myth_check_templates | 0006_history_suite_foundation.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.history_myth_checks | 0006_history_suite_foundation.sql | private user-owned history | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.history_source_templates | 0006_history_suite_foundation.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.history_sources | 0006_history_suite_foundation.sql | private user-owned history | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.learner_notes | 0001_binder_notes_phase1.sql | private user-owned | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.math_courses | 0011_math_learning_infrastructure.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.math_graph_states | 0011_math_learning_infrastructure.sql | public template or owner graph state | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.math_modules | 0011_math_learning_infrastructure.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.math_topics | 0011_math_learning_infrastructure.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.personal_note_binders | 0016_personal_notes_workspace.sql | private user-owned | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.personal_note_documents | 0016_personal_notes_workspace.sql | private user-owned | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.personal_note_folders | 0016_personal_notes_workspace.sql | private user-owned | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.personal_notes | 0016_personal_notes_workspace.sql | private user-owned | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.profiles | 0001_binder_notes_phase1.sql | profile own/admin | none | select/insert + column update | select/insert/update/delete | none | yes |
| public.purchases | 0001_binder_notes_phase1.sql | private entitlement read only | none | select | select/insert/update/delete | none | not currently direct |
| public.question_attempts | 0011_math_learning_infrastructure.sql | private user activity/study | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.question_bank | 0011_math_learning_infrastructure.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.question_choices | 0011_math_learning_infrastructure.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.quiz_attempts | 0011_math_learning_infrastructure.sql | private user activity/study | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.quiz_set_questions | 0011_math_learning_infrastructure.sql | private user activity/study | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.quiz_sets | 0011_math_learning_infrastructure.sql | private user activity/study | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.seed_versions | 0006_history_suite_foundation.sql | public/shared seed metadata via RLS | select | select | select/insert/update/delete | none | yes |
| public.study_sessions | 0023_data_quality_activity_spine.sql | private user activity/study | none | select/insert/update | select/insert/update/delete | none | not currently direct |
| public.suite_templates | 0006_history_suite_foundation.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.summary_refresh_job_dedupe | 0018_backend_performance_layer.sql | admin/internal summary | none | select | select/insert/update/delete | none | not currently direct |
| public.tutorial_entries | 0017_tutorial_video_library.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.tutorial_video_summaries | 0018_backend_performance_layer.sql | public/shared summary via RLS | select | select | select/insert/update/delete | none | not currently direct |
| public.user_chem_attempts | 0024_chemistry_learning_foundation.sql | private user activity/study | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.user_chem_mastery | 0024_chemistry_learning_foundation.sql | private user activity/study | none | select/insert/update/delete | select/insert/update/delete | none | not currently direct |
| public.user_lab_reports | 0024_chemistry_learning_foundation.sql | private user activity/study | none | select/insert/update/delete | select/insert/update/delete | none | not currently direct |
| public.user_lab_runs | 0024_chemistry_learning_foundation.sql | private user activity/study | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.user_recent_items | 0023_data_quality_activity_spine.sql | private user activity/study | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.whiteboard_assets | 0012_whiteboards_foundation.sql | private user-owned | none | select/insert/delete | select/insert/update/delete | none | not currently direct |
| public.whiteboard_versions | 0012_whiteboards_foundation.sql | private user-owned | none | select/insert | select/insert/update/delete | none | yes |
| public.whiteboards | 0012_whiteboards_foundation.sql | private user-owned | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.workspace_activity_events | 0023_data_quality_activity_spine.sql | private user activity/study | none | select/insert | select/insert/update/delete | none | yes |
| public.workspace_preferences | 0001_binder_notes_phase1.sql | private user-owned | none | select/insert/update/delete | select/insert/update/delete | none | yes |
| public.workspace_presets | 0006_history_suite_foundation.sql | public/shared read via RLS | select | select/insert/update/delete | select/insert/update/delete | none | yes |
