-- Supabase Data API explicit grant compatibility.
--
-- Supabase is moving public-schema Data API exposure to explicit grants.
-- Keep table grants next to the RLS model so PostgREST/supabase-js access is
-- intentional rather than dependent on project-level default privileges.
--
-- Public/anon policy: only published/shared catalog content is granted SELECT.
-- Private account data receives no anon table grants.
-- Authenticated policy: grants match existing RLS policies and client flows.
-- service_role policy: server/admin tooling may read and maintain all app tables.
-- Sequence grants: no public tables currently use serial, bigserial, or identity columns.

grant usage on schema public to anon, authenticated, service_role;

alter table public.admin_binder_summaries enable row level security;
alter table public.binder_lessons enable row level security;
alter table public.binders enable row level security;
alter table public.chem_concepts enable row level security;
alter table public.chem_lab_templates enable row level security;
alter table public.chem_problem_templates enable row level security;
alter table public.comments enable row level security;
alter table public.concept_edges enable row level security;
alter table public.concept_nodes enable row level security;
alter table public.dashboard_binder_summaries enable row level security;
alter table public.dashboard_folder_summaries enable row level security;
alter table public.dashboard_lesson_summaries enable row level security;
alter table public.enrollments enable row level security;
alter table public.folder_binders enable row level security;
alter table public.folders enable row level security;
alter table public.highlights enable row level security;
alter table public.history_argument_chains enable row level security;
alter table public.history_argument_edges enable row level security;
alter table public.history_argument_nodes enable row level security;
alter table public.history_event_templates enable row level security;
alter table public.history_events enable row level security;
alter table public.history_evidence_cards enable row level security;
alter table public.history_myth_check_templates enable row level security;
alter table public.history_myth_checks enable row level security;
alter table public.history_source_templates enable row level security;
alter table public.history_sources enable row level security;
alter table public.learner_notes enable row level security;
alter table public.math_courses enable row level security;
alter table public.math_graph_states enable row level security;
alter table public.math_modules enable row level security;
alter table public.math_topics enable row level security;
alter table public.personal_note_binders enable row level security;
alter table public.personal_note_documents enable row level security;
alter table public.personal_note_folders enable row level security;
alter table public.personal_notes enable row level security;
alter table public.profiles enable row level security;
alter table public.purchases enable row level security;
alter table public.question_attempts enable row level security;
alter table public.question_bank enable row level security;
alter table public.question_choices enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_set_questions enable row level security;
alter table public.quiz_sets enable row level security;
alter table public.seed_versions enable row level security;
alter table public.study_sessions enable row level security;
alter table public.suite_templates enable row level security;
alter table public.summary_refresh_job_dedupe enable row level security;
alter table public.tutorial_entries enable row level security;
alter table public.tutorial_video_summaries enable row level security;
alter table public.user_chem_attempts enable row level security;
alter table public.user_chem_mastery enable row level security;
alter table public.user_lab_reports enable row level security;
alter table public.user_lab_runs enable row level security;
alter table public.user_recent_items enable row level security;
alter table public.whiteboard_assets enable row level security;
alter table public.whiteboard_versions enable row level security;
alter table public.whiteboards enable row level security;
alter table public.workspace_activity_events enable row level security;
alter table public.workspace_preferences enable row level security;
alter table public.workspace_presets enable row level security;

-- Remove legacy browser-role table exposure first, then add the intended
-- privileges back explicitly. service_role is granted below for all tables.
revoke all on all tables in schema public from anon, authenticated;

-- Anon: published/shared read-only content. RLS still filters draft/private rows.
grant select on table public.binder_lessons to anon;
grant select on table public.binders to anon;
grant select on table public.concept_edges to anon;
grant select on table public.concept_nodes to anon;
grant select on table public.dashboard_binder_summaries to anon;
grant select on table public.dashboard_lesson_summaries to anon;
grant select on table public.history_event_templates to anon;
grant select on table public.history_myth_check_templates to anon;
grant select on table public.history_source_templates to anon;
grant select on table public.math_courses to anon;
grant select on table public.math_graph_states to anon;
grant select on table public.math_modules to anon;
grant select on table public.math_topics to anon;
grant select on table public.question_bank to anon;
grant select on table public.question_choices to anon;
grant select on table public.seed_versions to anon;
grant select on table public.suite_templates to anon;
grant select on table public.tutorial_entries to anon;
grant select on table public.tutorial_video_summaries to anon;
grant select on table public.workspace_presets to anon;

-- Authenticated: user-owned CRUD and admin-managed catalog writes, all RLS-bound.
grant select, insert, update, delete on table public.binder_lessons to authenticated;
grant select, insert, update, delete on table public.binders to authenticated;
grant select, insert, update, delete on table public.chem_concepts to authenticated;
grant select, insert, update, delete on table public.chem_lab_templates to authenticated;
grant select, insert, update, delete on table public.chem_problem_templates to authenticated;
grant select, insert, update, delete on table public.comments to authenticated;
grant select, insert, update, delete on table public.concept_edges to authenticated;
grant select, insert, update, delete on table public.concept_nodes to authenticated;
grant select, insert, update, delete on table public.folder_binders to authenticated;
grant select, insert, update, delete on table public.folders to authenticated;
grant select, insert, update, delete on table public.highlights to authenticated;
grant select, insert, update, delete on table public.history_argument_chains to authenticated;
grant select, insert, update, delete on table public.history_argument_edges to authenticated;
grant select, insert, update, delete on table public.history_argument_nodes to authenticated;
grant select, insert, update, delete on table public.history_event_templates to authenticated;
grant select, insert, update, delete on table public.history_events to authenticated;
grant select, insert, update, delete on table public.history_evidence_cards to authenticated;
grant select, insert, update, delete on table public.history_myth_check_templates to authenticated;
grant select, insert, update, delete on table public.history_myth_checks to authenticated;
grant select, insert, update, delete on table public.history_source_templates to authenticated;
grant select, insert, update, delete on table public.history_sources to authenticated;
grant select, insert, update, delete on table public.learner_notes to authenticated;
grant select, insert, update, delete on table public.math_courses to authenticated;
grant select, insert, update, delete on table public.math_graph_states to authenticated;
grant select, insert, update, delete on table public.math_modules to authenticated;
grant select, insert, update, delete on table public.math_topics to authenticated;
grant select, insert, update, delete on table public.personal_note_binders to authenticated;
grant select, insert, update, delete on table public.personal_note_documents to authenticated;
grant select, insert, update, delete on table public.personal_note_folders to authenticated;
grant select, insert, update, delete on table public.personal_notes to authenticated;
grant select, insert, update, delete on table public.question_attempts to authenticated;
grant select, insert, update, delete on table public.question_bank to authenticated;
grant select, insert, update, delete on table public.question_choices to authenticated;
grant select, insert, update, delete on table public.quiz_attempts to authenticated;
grant select, insert, update, delete on table public.quiz_set_questions to authenticated;
grant select, insert, update, delete on table public.quiz_sets to authenticated;
grant select, insert, update, delete on table public.suite_templates to authenticated;
grant select, insert, update, delete on table public.tutorial_entries to authenticated;
grant select, insert, update, delete on table public.user_chem_attempts to authenticated;
grant select, insert, update, delete on table public.user_chem_mastery to authenticated;
grant select, insert, update, delete on table public.user_lab_reports to authenticated;
grant select, insert, update, delete on table public.user_lab_runs to authenticated;
grant select, insert, update, delete on table public.user_recent_items to authenticated;
grant select, insert, update, delete on table public.whiteboards to authenticated;
grant select, insert, update, delete on table public.workspace_preferences to authenticated;
grant select, insert, update, delete on table public.workspace_presets to authenticated;

grant select, insert on table public.enrollments to authenticated;
grant select, insert on table public.whiteboard_versions to authenticated;
grant select, insert on table public.workspace_activity_events to authenticated;

grant select, insert, update on table public.study_sessions to authenticated;

grant select, insert, delete on table public.whiteboard_assets to authenticated;

grant select on table public.admin_binder_summaries to authenticated;
grant select on table public.dashboard_binder_summaries to authenticated;
grant select on table public.dashboard_folder_summaries to authenticated;
grant select on table public.dashboard_lesson_summaries to authenticated;
grant select on table public.purchases to authenticated;
grant select on table public.seed_versions to authenticated;
grant select on table public.summary_refresh_job_dedupe to authenticated;
grant select on table public.tutorial_video_summaries to authenticated;

grant select, insert on table public.profiles to authenticated;
grant update (full_name, appearance_settings, updated_at) on public.profiles to authenticated;

-- service_role: explicit full table access for trusted server/admin jobs.
grant select, insert, update, delete on table public.admin_binder_summaries to service_role;
grant select, insert, update, delete on table public.binder_lessons to service_role;
grant select, insert, update, delete on table public.binders to service_role;
grant select, insert, update, delete on table public.chem_concepts to service_role;
grant select, insert, update, delete on table public.chem_lab_templates to service_role;
grant select, insert, update, delete on table public.chem_problem_templates to service_role;
grant select, insert, update, delete on table public.comments to service_role;
grant select, insert, update, delete on table public.concept_edges to service_role;
grant select, insert, update, delete on table public.concept_nodes to service_role;
grant select, insert, update, delete on table public.dashboard_binder_summaries to service_role;
grant select, insert, update, delete on table public.dashboard_folder_summaries to service_role;
grant select, insert, update, delete on table public.dashboard_lesson_summaries to service_role;
grant select, insert, update, delete on table public.enrollments to service_role;
grant select, insert, update, delete on table public.folder_binders to service_role;
grant select, insert, update, delete on table public.folders to service_role;
grant select, insert, update, delete on table public.highlights to service_role;
grant select, insert, update, delete on table public.history_argument_chains to service_role;
grant select, insert, update, delete on table public.history_argument_edges to service_role;
grant select, insert, update, delete on table public.history_argument_nodes to service_role;
grant select, insert, update, delete on table public.history_event_templates to service_role;
grant select, insert, update, delete on table public.history_events to service_role;
grant select, insert, update, delete on table public.history_evidence_cards to service_role;
grant select, insert, update, delete on table public.history_myth_check_templates to service_role;
grant select, insert, update, delete on table public.history_myth_checks to service_role;
grant select, insert, update, delete on table public.history_source_templates to service_role;
grant select, insert, update, delete on table public.history_sources to service_role;
grant select, insert, update, delete on table public.learner_notes to service_role;
grant select, insert, update, delete on table public.math_courses to service_role;
grant select, insert, update, delete on table public.math_graph_states to service_role;
grant select, insert, update, delete on table public.math_modules to service_role;
grant select, insert, update, delete on table public.math_topics to service_role;
grant select, insert, update, delete on table public.personal_note_binders to service_role;
grant select, insert, update, delete on table public.personal_note_documents to service_role;
grant select, insert, update, delete on table public.personal_note_folders to service_role;
grant select, insert, update, delete on table public.personal_notes to service_role;
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.purchases to service_role;
grant select, insert, update, delete on table public.question_attempts to service_role;
grant select, insert, update, delete on table public.question_bank to service_role;
grant select, insert, update, delete on table public.question_choices to service_role;
grant select, insert, update, delete on table public.quiz_attempts to service_role;
grant select, insert, update, delete on table public.quiz_set_questions to service_role;
grant select, insert, update, delete on table public.quiz_sets to service_role;
grant select, insert, update, delete on table public.seed_versions to service_role;
grant select, insert, update, delete on table public.study_sessions to service_role;
grant select, insert, update, delete on table public.suite_templates to service_role;
grant select, insert, update, delete on table public.summary_refresh_job_dedupe to service_role;
grant select, insert, update, delete on table public.tutorial_entries to service_role;
grant select, insert, update, delete on table public.tutorial_video_summaries to service_role;
grant select, insert, update, delete on table public.user_chem_attempts to service_role;
grant select, insert, update, delete on table public.user_chem_mastery to service_role;
grant select, insert, update, delete on table public.user_lab_reports to service_role;
grant select, insert, update, delete on table public.user_lab_runs to service_role;
grant select, insert, update, delete on table public.user_recent_items to service_role;
grant select, insert, update, delete on table public.whiteboard_assets to service_role;
grant select, insert, update, delete on table public.whiteboard_versions to service_role;
grant select, insert, update, delete on table public.whiteboards to service_role;
grant select, insert, update, delete on table public.workspace_activity_events to service_role;
grant select, insert, update, delete on table public.workspace_preferences to service_role;
grant select, insert, update, delete on table public.workspace_presets to service_role;

notify pgrst, 'reload schema';
