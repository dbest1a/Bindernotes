-- Supabase Performance Advisor cleanup.
-- Keep RLS behavior equivalent-or-stricter while removing per-row auth initplan
-- work, duplicate permissive SELECT policies, and one duplicate whiteboard index.

-- Profiles.
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles insert own learner" on public.profiles;
create policy "profiles insert own learner"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()) and role = 'learner');

drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles update own safe fields" on public.profiles;
create policy "profiles update own safe fields"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke update on public.profiles from anon, authenticated;
revoke update (id, email, role, created_at) on public.profiles from anon, authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;

-- Binder content.
drop policy if exists "binders read published or admin" on public.binders;
create policy "binders read published or admin"
  on public.binders for select
  to anon, authenticated
  using (
    status = 'published'
    or owner_id = (select auth.uid())
    or (select private.is_admin())
  );

drop policy if exists "admins create binders" on public.binders;
create policy "admins create binders"
  on public.binders for insert
  to authenticated
  with check ((select private.is_admin()) and owner_id = (select auth.uid()));

drop policy if exists "admins update own binders" on public.binders;
create policy "admins update own binders"
  on public.binders for update
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_admin()))
  with check (owner_id = (select auth.uid()) and (select private.is_admin()));

drop policy if exists "admins delete own binders" on public.binders;
create policy "admins delete own binders"
  on public.binders for delete
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_admin()));

drop policy if exists "lessons read visible binders" on public.binder_lessons;
create policy "lessons read visible binders"
  on public.binder_lessons for select
  to anon, authenticated
  using (private.owns_published_or_enrolled(binder_id));

drop policy if exists "admins write lessons" on public.binder_lessons;
drop policy if exists "admins insert lessons" on public.binder_lessons;
create policy "admins insert lessons"
  on public.binder_lessons for insert
  to authenticated
  with check (
    (select private.is_admin())
    and exists (
      select 1
      from public.binders b
      where b.id = binder_lessons.binder_id
        and b.owner_id = (select auth.uid())
    )
  );

drop policy if exists "admins update lessons" on public.binder_lessons;
create policy "admins update lessons"
  on public.binder_lessons for update
  to authenticated
  using (
    (select private.is_admin())
    and exists (
      select 1
      from public.binders b
      where b.id = binder_lessons.binder_id
        and b.owner_id = (select auth.uid())
    )
  )
  with check (
    (select private.is_admin())
    and exists (
      select 1
      from public.binders b
      where b.id = binder_lessons.binder_id
        and b.owner_id = (select auth.uid())
    )
  );

drop policy if exists "admins delete lessons" on public.binder_lessons;
create policy "admins delete lessons"
  on public.binder_lessons for delete
  to authenticated
  using (
    (select private.is_admin())
    and exists (
      select 1
      from public.binders b
      where b.id = binder_lessons.binder_id
        and b.owner_id = (select auth.uid())
    )
  );

drop policy if exists "folders own" on public.folders;
drop policy if exists "system folders readable" on public.folders;
drop policy if exists "folders visible" on public.folders;
create policy "folders visible"
  on public.folders for select
  to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or (
      source = 'system'
      and suite_template_id is not null
      and private.can_read_suite_template(suite_template_id)
    )
    or (select private.is_admin())
  );

drop policy if exists "folders insert own" on public.folders;
create policy "folders insert own"
  on public.folders for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "folders update own" on public.folders;
create policy "folders update own"
  on public.folders for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "folders delete own" on public.folders;
create policy "folders delete own"
  on public.folders for delete
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "folder binders own" on public.folder_binders;
drop policy if exists "system folder binders readable" on public.folder_binders;
drop policy if exists "folder binders visible" on public.folder_binders;
create policy "folder binders visible"
  on public.folder_binders for select
  to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1
      from public.folders f
      where f.id = folder_binders.folder_id
        and f.source = 'system'
        and f.suite_template_id is not null
        and private.can_read_suite_template(f.suite_template_id)
    )
    or (select private.is_admin())
  );

drop policy if exists "folder binders insert own" on public.folder_binders;
create policy "folder binders insert own"
  on public.folder_binders for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "folder binders update own" on public.folder_binders;
create policy "folder binders update own"
  on public.folder_binders for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "folder binders delete own" on public.folder_binders;
create policy "folder binders delete own"
  on public.folder_binders for delete
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "enrollments read own or admin" on public.enrollments;
create policy "enrollments read own or admin"
  on public.enrollments for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "enrollments create own published" on public.enrollments;
create policy "enrollments create own published"
  on public.enrollments for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.binders b
      where b.id = enrollments.binder_id
        and b.status = 'published'
    )
  );

drop policy if exists "learner notes own" on public.learner_notes;
create policy "learner notes own"
  on public.learner_notes for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "comments own" on public.comments;
create policy "comments own"
  on public.comments for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "highlights own" on public.highlights;
create policy "highlights own"
  on public.highlights for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "purchases read own or admin" on public.purchases;
create policy "purchases read own or admin"
  on public.purchases for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "purchases insert own placeholder" on public.purchases;
drop policy if exists "purchases update own" on public.purchases;
drop policy if exists "purchases delete own" on public.purchases;
revoke insert, update, delete on public.purchases from anon, authenticated;
grant select on public.purchases to authenticated;

drop policy if exists "workspace preferences own" on public.workspace_preferences;
create policy "workspace preferences own"
  on public.workspace_preferences for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "concept nodes read visible binder" on public.concept_nodes;
create policy "concept nodes read visible binder"
  on public.concept_nodes for select
  to anon, authenticated
  using (private.owns_published_or_enrolled(binder_id));

drop policy if exists "concept nodes admin write" on public.concept_nodes;
drop policy if exists "concept nodes admin insert" on public.concept_nodes;
create policy "concept nodes admin insert"
  on public.concept_nodes for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "concept nodes admin update" on public.concept_nodes;
create policy "concept nodes admin update"
  on public.concept_nodes for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "concept nodes admin delete" on public.concept_nodes;
create policy "concept nodes admin delete"
  on public.concept_nodes for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "concept edges read visible binder" on public.concept_edges;
create policy "concept edges read visible binder"
  on public.concept_edges for select
  to anon, authenticated
  using (private.owns_published_or_enrolled(binder_id));

drop policy if exists "concept edges admin write" on public.concept_edges;
drop policy if exists "concept edges admin insert" on public.concept_edges;
create policy "concept edges admin insert"
  on public.concept_edges for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "concept edges admin update" on public.concept_edges;
create policy "concept edges admin update"
  on public.concept_edges for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "concept edges admin delete" on public.concept_edges;
create policy "concept edges admin delete"
  on public.concept_edges for delete
  to authenticated
  using ((select private.is_admin()));

-- Personal Notes.
drop policy if exists "personal_notes select own" on public.personal_notes;
create policy "personal_notes select own" on public.personal_notes
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "personal_notes insert own" on public.personal_notes;
create policy "personal_notes insert own" on public.personal_notes
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "personal_notes update own" on public.personal_notes;
create policy "personal_notes update own" on public.personal_notes
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "personal_notes delete own" on public.personal_notes;
create policy "personal_notes delete own" on public.personal_notes
  for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "personal_note_folders select own" on public.personal_note_folders;
create policy "personal_note_folders select own" on public.personal_note_folders
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "personal_note_folders insert own" on public.personal_note_folders;
create policy "personal_note_folders insert own" on public.personal_note_folders
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "personal_note_folders update own" on public.personal_note_folders;
create policy "personal_note_folders update own" on public.personal_note_folders
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "personal_note_folders delete own" on public.personal_note_folders;
create policy "personal_note_folders delete own" on public.personal_note_folders
  for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "personal_note_binders select own" on public.personal_note_binders;
create policy "personal_note_binders select own" on public.personal_note_binders
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "personal_note_binders insert own" on public.personal_note_binders;
create policy "personal_note_binders insert own" on public.personal_note_binders
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "personal_note_binders update own" on public.personal_note_binders;
create policy "personal_note_binders update own" on public.personal_note_binders
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "personal_note_binders delete own" on public.personal_note_binders;
create policy "personal_note_binders delete own" on public.personal_note_binders
  for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "personal_note_documents select own" on public.personal_note_documents;
create policy "personal_note_documents select own" on public.personal_note_documents
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "personal_note_documents insert own" on public.personal_note_documents;
create policy "personal_note_documents insert own" on public.personal_note_documents
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "personal_note_documents update own" on public.personal_note_documents;
create policy "personal_note_documents update own" on public.personal_note_documents
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "personal_note_documents delete own" on public.personal_note_documents;
create policy "personal_note_documents delete own" on public.personal_note_documents
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Suite, seed, workspace, history templates.
drop policy if exists "suite templates readable when published" on public.suite_templates;
create policy "suite templates readable when published"
  on public.suite_templates for select
  to anon, authenticated
  using (status = 'published' or (select private.is_admin()));

drop policy if exists "suite templates admin write" on public.suite_templates;
drop policy if exists "suite templates admin insert" on public.suite_templates;
create policy "suite templates admin insert"
  on public.suite_templates for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "suite templates admin update" on public.suite_templates;
create policy "suite templates admin update"
  on public.suite_templates for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "suite templates admin delete" on public.suite_templates;
create policy "suite templates admin delete"
  on public.suite_templates for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "seed versions readable when suite published" on public.seed_versions;
create policy "seed versions readable when suite published"
  on public.seed_versions for select
  to anon, authenticated
  using (private.can_read_suite_template(suite_template_id));

drop policy if exists "seed versions admin only" on public.seed_versions;
drop policy if exists "seed versions admin write" on public.seed_versions;
drop policy if exists "seed versions admin insert" on public.seed_versions;
create policy "seed versions admin insert"
  on public.seed_versions for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "seed versions admin update" on public.seed_versions;
create policy "seed versions admin update"
  on public.seed_versions for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "seed versions admin delete" on public.seed_versions;
create policy "seed versions admin delete"
  on public.seed_versions for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "workspace presets readable when suite published" on public.workspace_presets;
create policy "workspace presets readable when suite published"
  on public.workspace_presets for select
  to anon, authenticated
  using (private.can_read_suite_template(suite_template_id));

drop policy if exists "workspace presets admin write" on public.workspace_presets;
drop policy if exists "workspace presets admin insert" on public.workspace_presets;
create policy "workspace presets admin insert"
  on public.workspace_presets for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "workspace presets admin update" on public.workspace_presets;
create policy "workspace presets admin update"
  on public.workspace_presets for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "workspace presets admin delete" on public.workspace_presets;
create policy "workspace presets admin delete"
  on public.workspace_presets for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "history event templates readable with visible binder" on public.history_event_templates;
create policy "history event templates readable with visible binder"
  on public.history_event_templates for select
  to anon, authenticated
  using (private.owns_published_or_enrolled(binder_id));

drop policy if exists "history event templates admin write" on public.history_event_templates;
drop policy if exists "history event templates admin insert" on public.history_event_templates;
create policy "history event templates admin insert"
  on public.history_event_templates for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "history event templates admin update" on public.history_event_templates;
create policy "history event templates admin update"
  on public.history_event_templates for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "history event templates admin delete" on public.history_event_templates;
create policy "history event templates admin delete"
  on public.history_event_templates for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "history source templates readable with visible binder" on public.history_source_templates;
create policy "history source templates readable with visible binder"
  on public.history_source_templates for select
  to anon, authenticated
  using (private.owns_published_or_enrolled(binder_id));

drop policy if exists "history source templates admin write" on public.history_source_templates;
drop policy if exists "history source templates admin insert" on public.history_source_templates;
create policy "history source templates admin insert"
  on public.history_source_templates for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "history source templates admin update" on public.history_source_templates;
create policy "history source templates admin update"
  on public.history_source_templates for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "history source templates admin delete" on public.history_source_templates;
create policy "history source templates admin delete"
  on public.history_source_templates for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "history myth templates readable with visible binder" on public.history_myth_check_templates;
create policy "history myth templates readable with visible binder"
  on public.history_myth_check_templates for select
  to anon, authenticated
  using (private.owns_published_or_enrolled(binder_id));

drop policy if exists "history myth templates admin write" on public.history_myth_check_templates;
drop policy if exists "history myth templates admin insert" on public.history_myth_check_templates;
create policy "history myth templates admin insert"
  on public.history_myth_check_templates for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "history myth templates admin update" on public.history_myth_check_templates;
create policy "history myth templates admin update"
  on public.history_myth_check_templates for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "history myth templates admin delete" on public.history_myth_check_templates;
create policy "history myth templates admin delete"
  on public.history_myth_check_templates for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "history events own" on public.history_events;
create policy "history events own"
  on public.history_events for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "history sources own" on public.history_sources;
create policy "history sources own"
  on public.history_sources for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "history evidence cards own" on public.history_evidence_cards;
create policy "history evidence cards own"
  on public.history_evidence_cards for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "history argument chains own" on public.history_argument_chains;
create policy "history argument chains own"
  on public.history_argument_chains for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "history argument nodes own" on public.history_argument_nodes;
create policy "history argument nodes own"
  on public.history_argument_nodes for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "history argument edges own" on public.history_argument_edges;
create policy "history argument edges own"
  on public.history_argument_edges for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "history myth checks own" on public.history_myth_checks;
create policy "history myth checks own"
  on public.history_myth_checks for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Math, graph, question bank, and quiz policies.
drop policy if exists "math courses readable" on public.math_courses;
create policy "math courses readable"
  on public.math_courses for select
  to anon, authenticated
  using (true);

drop policy if exists "admins write math courses" on public.math_courses;
drop policy if exists "admins insert math courses" on public.math_courses;
create policy "admins insert math courses"
  on public.math_courses for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "admins update math courses" on public.math_courses;
create policy "admins update math courses"
  on public.math_courses for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "admins delete math courses" on public.math_courses;
create policy "admins delete math courses"
  on public.math_courses for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "math topics readable" on public.math_topics;
create policy "math topics readable"
  on public.math_topics for select
  to anon, authenticated
  using (true);

drop policy if exists "admins write math topics" on public.math_topics;
drop policy if exists "admins insert math topics" on public.math_topics;
create policy "admins insert math topics"
  on public.math_topics for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "admins update math topics" on public.math_topics;
create policy "admins update math topics"
  on public.math_topics for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "admins delete math topics" on public.math_topics;
create policy "admins delete math topics"
  on public.math_topics for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "published math modules readable" on public.math_modules;
create policy "published math modules readable"
  on public.math_modules for select
  to anon, authenticated
  using (visibility = 'published' or (select private.is_admin()));

drop policy if exists "admins write math modules" on public.math_modules;
drop policy if exists "admins insert math modules" on public.math_modules;
create policy "admins insert math modules"
  on public.math_modules for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "admins update math modules" on public.math_modules;
create policy "admins update math modules"
  on public.math_modules for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "admins delete math modules" on public.math_modules;
create policy "admins delete math modules"
  on public.math_modules for delete
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "graph states readable by owner or public template" on public.math_graph_states;
create policy "graph states readable by owner or public template"
  on public.math_graph_states for select
  to anon, authenticated
  using (
    user_id = (select auth.uid())
    or user_id is null
    or (select private.is_admin())
  );

drop policy if exists "graph states insert own" on public.math_graph_states;
create policy "graph states insert own"
  on public.math_graph_states for insert
  to authenticated
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "graph states update own" on public.math_graph_states;
create policy "graph states update own"
  on public.math_graph_states for update
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "graph states delete own" on public.math_graph_states;
create policy "graph states delete own"
  on public.math_graph_states for delete
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "questions readable when published or owned" on public.question_bank;
create policy "questions readable when published or owned"
  on public.question_bank for select
  to anon, authenticated
  using (
    status = 'published'
    or created_by = (select auth.uid())
    or (select private.is_admin())
  );

drop policy if exists "questions insert own" on public.question_bank;
drop policy if exists "questions insert own drafts" on public.question_bank;
create policy "questions insert own drafts"
  on public.question_bank for insert
  to authenticated
  with check (
    (select private.is_admin())
    or (created_by = (select auth.uid()) and status = 'draft')
  );

drop policy if exists "questions update own" on public.question_bank;
drop policy if exists "questions update own drafts" on public.question_bank;
create policy "questions update own drafts"
  on public.question_bank for update
  to authenticated
  using (
    (select private.is_admin())
    or (created_by = (select auth.uid()) and status = 'draft')
  )
  with check (
    (select private.is_admin())
    or (created_by = (select auth.uid()) and status = 'draft')
  );

drop policy if exists "questions delete own" on public.question_bank;
drop policy if exists "questions delete own drafts" on public.question_bank;
create policy "questions delete own drafts"
  on public.question_bank for delete
  to authenticated
  using (
    (select private.is_admin())
    or (created_by = (select auth.uid()) and status = 'draft')
  );

drop policy if exists "choices readable through visible question" on public.question_choices;
create policy "choices readable through visible question"
  on public.question_choices for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.question_bank q
      where q.id = question_choices.question_id
        and (
          q.status = 'published'
          or q.created_by = (select auth.uid())
          or (select private.is_admin())
        )
    )
  );

drop policy if exists "choices write through owned question" on public.question_choices;
drop policy if exists "choices write through owned draft question" on public.question_choices;
drop policy if exists "choices insert through owned draft question" on public.question_choices;
create policy "choices insert through owned draft question"
  on public.question_choices for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.question_bank q
      where q.id = question_choices.question_id
        and (
          (select private.is_admin())
          or (q.created_by = (select auth.uid()) and q.status = 'draft')
        )
    )
  );

drop policy if exists "choices update through owned draft question" on public.question_choices;
create policy "choices update through owned draft question"
  on public.question_choices for update
  to authenticated
  using (
    exists (
      select 1
      from public.question_bank q
      where q.id = question_choices.question_id
        and (
          (select private.is_admin())
          or (q.created_by = (select auth.uid()) and q.status = 'draft')
        )
    )
  )
  with check (
    exists (
      select 1
      from public.question_bank q
      where q.id = question_choices.question_id
        and (
          (select private.is_admin())
          or (q.created_by = (select auth.uid()) and q.status = 'draft')
        )
    )
  );

drop policy if exists "choices delete through owned draft question" on public.question_choices;
create policy "choices delete through owned draft question"
  on public.question_choices for delete
  to authenticated
  using (
    exists (
      select 1
      from public.question_bank q
      where q.id = question_choices.question_id
        and (
          (select private.is_admin())
          or (q.created_by = (select auth.uid()) and q.status = 'draft')
        )
    )
  );

drop policy if exists "quiz sets read own" on public.quiz_sets;
create policy "quiz sets read own"
  on public.quiz_sets for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "quiz sets write own" on public.quiz_sets;
drop policy if exists "quiz sets insert own" on public.quiz_sets;
create policy "quiz sets insert own"
  on public.quiz_sets for insert
  to authenticated
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "quiz sets update own" on public.quiz_sets;
create policy "quiz sets update own"
  on public.quiz_sets for update
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "quiz sets delete own" on public.quiz_sets;
create policy "quiz sets delete own"
  on public.quiz_sets for delete
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "quiz set questions read own quiz" on public.quiz_set_questions;
create policy "quiz set questions read own quiz"
  on public.quiz_set_questions for select
  to authenticated
  using (
    exists (
      select 1
      from public.quiz_sets qs
      where qs.id = quiz_set_questions.quiz_set_id
        and (qs.user_id = (select auth.uid()) or (select private.is_admin()))
    )
  );

drop policy if exists "quiz set questions write own quiz" on public.quiz_set_questions;
drop policy if exists "quiz set questions insert own quiz" on public.quiz_set_questions;
create policy "quiz set questions insert own quiz"
  on public.quiz_set_questions for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.quiz_sets qs
      where qs.id = quiz_set_questions.quiz_set_id
        and (qs.user_id = (select auth.uid()) or (select private.is_admin()))
    )
  );

drop policy if exists "quiz set questions update own quiz" on public.quiz_set_questions;
create policy "quiz set questions update own quiz"
  on public.quiz_set_questions for update
  to authenticated
  using (
    exists (
      select 1
      from public.quiz_sets qs
      where qs.id = quiz_set_questions.quiz_set_id
        and (qs.user_id = (select auth.uid()) or (select private.is_admin()))
    )
  )
  with check (
    exists (
      select 1
      from public.quiz_sets qs
      where qs.id = quiz_set_questions.quiz_set_id
        and (qs.user_id = (select auth.uid()) or (select private.is_admin()))
    )
  );

drop policy if exists "quiz set questions delete own quiz" on public.quiz_set_questions;
create policy "quiz set questions delete own quiz"
  on public.quiz_set_questions for delete
  to authenticated
  using (
    exists (
      select 1
      from public.quiz_sets qs
      where qs.id = quiz_set_questions.quiz_set_id
        and (qs.user_id = (select auth.uid()) or (select private.is_admin()))
    )
  );

drop policy if exists "quiz attempts read own" on public.quiz_attempts;
create policy "quiz attempts read own"
  on public.quiz_attempts for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "quiz attempts write own" on public.quiz_attempts;
drop policy if exists "quiz attempts insert own" on public.quiz_attempts;
create policy "quiz attempts insert own"
  on public.quiz_attempts for insert
  to authenticated
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "quiz attempts update own" on public.quiz_attempts;
create policy "quiz attempts update own"
  on public.quiz_attempts for update
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "quiz attempts delete own" on public.quiz_attempts;
create policy "quiz attempts delete own"
  on public.quiz_attempts for delete
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "question attempts read own" on public.question_attempts;
create policy "question attempts read own"
  on public.question_attempts for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "question attempts write own" on public.question_attempts;
drop policy if exists "question attempts insert own" on public.question_attempts;
create policy "question attempts insert own"
  on public.question_attempts for insert
  to authenticated
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "question attempts update own" on public.question_attempts;
create policy "question attempts update own"
  on public.question_attempts for update
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "question attempts delete own" on public.question_attempts;
create policy "question attempts delete own"
  on public.question_attempts for delete
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Whiteboards.
drop policy if exists "whiteboards select own" on public.whiteboards;
create policy "whiteboards select own"
  on public.whiteboards for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "whiteboards insert own" on public.whiteboards;
create policy "whiteboards insert own"
  on public.whiteboards for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "whiteboards update own" on public.whiteboards;
create policy "whiteboards update own"
  on public.whiteboards for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "whiteboard versions select own" on public.whiteboard_versions;
create policy "whiteboard versions select own"
  on public.whiteboard_versions for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "whiteboard versions insert own" on public.whiteboard_versions;
create policy "whiteboard versions insert own"
  on public.whiteboard_versions for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.whiteboards w
      where w.id = whiteboard_versions.whiteboard_id
        and w.owner_id = (select auth.uid())
    )
  );

drop policy if exists "whiteboard assets select own" on public.whiteboard_assets;
create policy "whiteboard assets select own"
  on public.whiteboard_assets for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "whiteboard assets insert own" on public.whiteboard_assets;
create policy "whiteboard assets insert own"
  on public.whiteboard_assets for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.whiteboards w
      where w.id = whiteboard_assets.whiteboard_id
        and w.owner_id = (select auth.uid())
    )
  );

drop policy if exists "whiteboard assets delete own" on public.whiteboard_assets;
create policy "whiteboard assets delete own"
  on public.whiteboard_assets for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Dashboard summaries.
drop policy if exists "dashboard folder summaries owner read" on public.dashboard_folder_summaries;
create policy "dashboard folder summaries owner read"
  on public.dashboard_folder_summaries for select
  to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "dashboard binder summaries visible read" on public.dashboard_binder_summaries;
create policy "dashboard binder summaries visible read"
  on public.dashboard_binder_summaries for select
  to anon, authenticated
  using (
    status = 'published'
    or owner_id = (select auth.uid())
    or (select private.is_admin())
  );

-- Drop the duplicate whiteboards index only if it is still definition-equivalent
-- to the older owner/updated partial index.
do $$
declare
  active_def text;
  updated_def text;
begin
  select replace(pg_get_indexdef(c.oid), 'whiteboards_owner_active_idx', '<index>')
    into active_def
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'whiteboards_owner_active_idx';

  select replace(pg_get_indexdef(c.oid), 'whiteboards_owner_updated_idx', '<index>')
    into updated_def
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'whiteboards_owner_updated_idx';

  if active_def is not null and active_def = updated_def then
    execute 'drop index if exists public.whiteboards_owner_active_idx';
  end if;
end $$;

notify pgrst, 'reload schema';
