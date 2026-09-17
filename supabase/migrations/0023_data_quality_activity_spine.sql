-- BinderNotes P0 data-quality pass.
--
-- This migration is additive and intentionally non-destructive:
-- - no user data is deleted, truncated, reseeded, or hard-compacted
-- - old whiteboard auto-versions are marked compactable instead of deleted
-- - dashboard summary health is made observable for future refresh workers
-- - lightweight activity tables support recents and continue-studying flows
--
-- Rollback notes:
-- - Drop the new triggers/functions/tables if this feature is withdrawn.
-- - The added metadata columns are nullable/defaulted and can be ignored safely.
-- - Do not drop retention metadata until any future compaction worker is stopped.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

-- ---------------------------------------------------------------------------
-- Whiteboard retention metadata and non-destructive compaction marking.
-- ---------------------------------------------------------------------------

alter table public.whiteboards
  add column if not exists latest_version_id text,
  add column if not exists latest_version_number integer,
  add column if not exists latest_version_created_at timestamptz,
  add column if not exists version_retention_checked_at timestamptz,
  add column if not exists version_compaction_candidate_count integer not null default 0,
  add column if not exists version_payload_bytes_estimate bigint not null default 0;

do $$ begin
  alter table public.whiteboards
    add constraint whiteboards_version_compaction_candidate_count_nonnegative
    check (version_compaction_candidate_count >= 0) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.whiteboards
    add constraint whiteboards_version_payload_bytes_estimate_nonnegative
    check (version_payload_bytes_estimate >= 0) not valid;
exception when duplicate_object then null;
end $$;

alter table public.whiteboard_versions
  add column if not exists version_kind text not null default 'auto',
  add column if not exists retention_status text not null default 'active',
  add column if not exists retained_until timestamptz,
  add column if not exists compacted_at timestamptz,
  add column if not exists compacted_from_version_count integer not null default 0,
  add column if not exists approximate_payload_bytes integer not null default 0;

do $$ begin
  alter table public.whiteboard_versions
    add constraint whiteboard_versions_version_kind_check
    check (version_kind in ('auto', 'draft', 'checkpoint', 'snapshot', 'manual')) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.whiteboard_versions
    add constraint whiteboard_versions_retention_status_check
    check (retention_status in ('active', 'compactable', 'compacted', 'archived')) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.whiteboard_versions
    add constraint whiteboard_versions_compacted_from_count_nonnegative
    check (compacted_from_version_count >= 0) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.whiteboard_versions
    add constraint whiteboard_versions_approximate_payload_bytes_nonnegative
    check (approximate_payload_bytes >= 0) not valid;
exception when duplicate_object then null;
end $$;

create index if not exists whiteboard_versions_retention_scan_idx
  on public.whiteboard_versions(whiteboard_id, retention_status, version_kind, version desc, created_at desc);

create index if not exists whiteboard_versions_compactable_idx
  on public.whiteboard_versions(retention_status, retained_until, created_at)
  where retention_status = 'compactable';

create index if not exists whiteboards_latest_version_idx
  on public.whiteboards(latest_version_id)
  where latest_version_id is not null;

create or replace function private.prepare_whiteboard_version_retention_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  scene_payload jsonb;
  modules_payload jsonb;
  payload_size integer;
begin
  new.created_at := coalesce(new.created_at, now());
  new.version_kind := coalesce(nullif(new.version_kind, ''), 'auto');
  new.retention_status := coalesce(nullif(new.retention_status, ''), 'active');

  scene_payload := coalesce(new.scene, new.scene_json, '{}'::jsonb);
  modules_payload := coalesce(new.modules, new.module_elements, '[]'::jsonb);
  payload_size := octet_length(scene_payload::text) + octet_length(modules_payload::text);

  new.approximate_payload_bytes := greatest(
    coalesce(new.approximate_payload_bytes, 0),
    coalesce(new.scene_size_bytes, 0),
    payload_size
  );

  if new.version_kind in ('checkpoint', 'snapshot', 'manual') then
    new.retention_status := 'active';
    new.retained_until := null;
  elsif new.retained_until is null then
    new.retained_until := new.created_at + interval '30 days';
  end if;

  return new;
end;
$$;

drop trigger if exists whiteboard_versions_prepare_retention_metadata on public.whiteboard_versions;
create trigger whiteboard_versions_prepare_retention_metadata
before insert or update of scene_json, scene, module_elements, modules, scene_size_bytes, version_kind, retention_status, retained_until
on public.whiteboard_versions
for each row
execute function private.prepare_whiteboard_version_retention_metadata();

-- Replace the older hard-prune trigger with non-destructive retention marking.
drop trigger if exists whiteboard_versions_prune_history on public.whiteboard_versions;
drop function if exists public.prune_whiteboard_version_history();

create or replace function private.mark_whiteboard_versions_compactable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  compactable_count integer;
  payload_total bigint;
begin
  with ranked_auto_versions as (
    select id,
      row_number() over (
        partition by whiteboard_id
        order by version desc, created_at desc, id desc
      ) as version_rank
    from public.whiteboard_versions
    where whiteboard_id = new.whiteboard_id
      and version_kind = 'auto'
      and retention_status = 'active'
      and created_at < now() - interval '7 days'
  )
  update public.whiteboard_versions stale
  set retention_status = 'compactable',
      retained_until = coalesce(stale.retained_until, now() + interval '14 days'),
      compacted_from_version_count = greatest(stale.compacted_from_version_count, 1)
  from ranked_auto_versions ranked
  where stale.id = ranked.id
    and ranked.version_rank > 50;

  select
    count(*) filter (where retention_status = 'compactable'),
    coalesce(sum(approximate_payload_bytes), 0)
  into compactable_count, payload_total
  from public.whiteboard_versions
  where whiteboard_id = new.whiteboard_id;

  update public.whiteboards
  set latest_version_id = new.id,
      latest_version_number = new.version,
      latest_version_created_at = new.created_at,
      version_retention_checked_at = now(),
      version_compaction_candidate_count = coalesce(compactable_count, 0),
      version_payload_bytes_estimate = coalesce(payload_total, 0)
  where id = new.whiteboard_id
    and (
      latest_version_number is null
      or new.version >= latest_version_number
      or latest_version_created_at is null
      or new.created_at >= latest_version_created_at
    );

  return null;
end;
$$;

drop trigger if exists whiteboard_versions_mark_compactable on public.whiteboard_versions;
create trigger whiteboard_versions_mark_compactable
after insert on public.whiteboard_versions
for each row
execute function private.mark_whiteboard_versions_compactable();

revoke execute on function private.prepare_whiteboard_version_retention_metadata() from public, anon, authenticated;
revoke execute on function private.mark_whiteboard_versions_compactable() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Safe high-confidence FK/query indexes.
-- ---------------------------------------------------------------------------

create index if not exists comments_owner_updated_idx on public.comments(owner_id, updated_at desc);
create index if not exists comments_binder_updated_idx on public.comments(binder_id, updated_at desc);
create index if not exists comments_parent_idx on public.comments(parent_id) where parent_id is not null;

create index if not exists highlights_binder_updated_idx on public.highlights(binder_id, updated_at desc);
create index if not exists highlights_note_idx on public.highlights(note_id) where note_id is not null;

create index if not exists learner_notes_binder_idx on public.learner_notes(binder_id);
create index if not exists learner_notes_folder_idx on public.learner_notes(folder_id) where folder_id is not null;

create index if not exists dashboard_folder_summaries_owner_updated_idx
  on public.dashboard_folder_summaries(owner_id, updated_at desc);
create index if not exists dashboard_binder_summaries_folder_idx
  on public.dashboard_binder_summaries(folder_id) where folder_id is not null;
create index if not exists admin_binder_summaries_owner_updated_idx
  on public.admin_binder_summaries(owner_id, last_updated_at desc);

create index if not exists enrollments_binder_idx on public.enrollments(binder_id);
create index if not exists folder_binders_binder_idx on public.folder_binders(binder_id);
create index if not exists folders_suite_template_idx on public.folders(suite_template_id)
  where suite_template_id is not null;
create index if not exists workspace_preferences_binder_idx on public.workspace_preferences(binder_id);

create index if not exists history_events_binder_idx on public.history_events(binder_id);
create index if not exists history_events_lesson_idx on public.history_events(lesson_id) where lesson_id is not null;
create index if not exists history_events_template_event_idx on public.history_events(template_event_id)
  where template_event_id is not null;

create index if not exists history_sources_binder_idx on public.history_sources(binder_id);
create index if not exists history_sources_lesson_idx on public.history_sources(lesson_id) where lesson_id is not null;
create index if not exists history_sources_template_source_idx on public.history_sources(template_source_id)
  where template_source_id is not null;

create index if not exists history_evidence_cards_binder_idx on public.history_evidence_cards(binder_id);
create index if not exists history_evidence_cards_lesson_idx on public.history_evidence_cards(lesson_id)
  where lesson_id is not null;
create index if not exists history_evidence_cards_source_idx on public.history_evidence_cards(source_id)
  where source_id is not null;
create index if not exists history_evidence_cards_highlight_idx on public.history_evidence_cards(highlight_id)
  where highlight_id is not null;

create index if not exists history_myth_checks_binder_idx on public.history_myth_checks(binder_id);
create index if not exists history_myth_checks_lesson_idx on public.history_myth_checks(lesson_id)
  where lesson_id is not null;
create index if not exists history_myth_checks_template_idx on public.history_myth_checks(template_myth_check_id)
  where template_myth_check_id is not null;

create index if not exists history_argument_chains_binder_idx on public.history_argument_chains(binder_id);
create index if not exists history_argument_chains_lesson_idx on public.history_argument_chains(lesson_id)
  where lesson_id is not null;

create index if not exists history_argument_nodes_owner_idx on public.history_argument_nodes(owner_id);
create index if not exists history_argument_nodes_event_idx on public.history_argument_nodes(event_id)
  where event_id is not null;
create index if not exists history_argument_nodes_source_idx on public.history_argument_nodes(source_id)
  where source_id is not null;
create index if not exists history_argument_nodes_evidence_idx on public.history_argument_nodes(evidence_id)
  where evidence_id is not null;

create index if not exists history_argument_edges_owner_idx on public.history_argument_edges(owner_id);
create index if not exists history_argument_edges_from_node_idx on public.history_argument_edges(from_node_id);
create index if not exists history_argument_edges_to_node_idx on public.history_argument_edges(to_node_id);
create index if not exists history_argument_edges_source_idx on public.history_argument_edges(source_id)
  where source_id is not null;
create index if not exists history_argument_edges_evidence_idx on public.history_argument_edges(evidence_id)
  where evidence_id is not null;

-- ---------------------------------------------------------------------------
-- Student activity spine.
-- ---------------------------------------------------------------------------

create table if not exists public.user_recent_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null,
  item_id text not null,
  binder_id text references public.binders(id) on delete set null,
  folder_id text references public.folders(id) on delete set null,
  lesson_id text references public.binder_lessons(id) on delete set null,
  title_snapshot text,
  last_opened_at timestamptz not null default now(),
  open_count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_recent_items_item_type_check
    check (item_type in ('folder', 'binder', 'lesson', 'personal_note', 'personal_document', 'whiteboard')),
  constraint user_recent_items_open_count_positive check (open_count >= 1),
  constraint user_recent_items_unique_user_item unique (user_id, item_type, item_id)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text references public.binders(id) on delete set null,
  lesson_id text references public.binder_lessons(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_duration_nonnegative
    check (duration_seconds is null or duration_seconds >= 0)
);

create table if not exists public.workspace_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text references public.binders(id) on delete set null,
  lesson_id text references public.binder_lessons(id) on delete set null,
  module_id text not null,
  event_type text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint workspace_activity_events_module_id_nonempty check (length(trim(module_id)) > 0),
  constraint workspace_activity_events_event_type_nonempty check (length(trim(event_type)) > 0)
);

alter table public.user_recent_items enable row level security;
alter table public.study_sessions enable row level security;
alter table public.workspace_activity_events enable row level security;

drop policy if exists "user recent items select own" on public.user_recent_items;
create policy "user recent items select own"
  on public.user_recent_items for select
  using (user_id = (select auth.uid()));

drop policy if exists "user recent items insert own" on public.user_recent_items;
create policy "user recent items insert own"
  on public.user_recent_items for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "user recent items update own" on public.user_recent_items;
create policy "user recent items update own"
  on public.user_recent_items for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "user recent items delete own" on public.user_recent_items;
create policy "user recent items delete own"
  on public.user_recent_items for delete
  using (user_id = (select auth.uid()));

drop policy if exists "study sessions select own" on public.study_sessions;
create policy "study sessions select own"
  on public.study_sessions for select
  using (user_id = (select auth.uid()));

drop policy if exists "study sessions insert own" on public.study_sessions;
create policy "study sessions insert own"
  on public.study_sessions for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "study sessions update own" on public.study_sessions;
create policy "study sessions update own"
  on public.study_sessions for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "workspace activity events select own" on public.workspace_activity_events;
create policy "workspace activity events select own"
  on public.workspace_activity_events for select
  using (user_id = (select auth.uid()));

drop policy if exists "workspace activity events insert own" on public.workspace_activity_events;
create policy "workspace activity events insert own"
  on public.workspace_activity_events for insert
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.user_recent_items to authenticated;
grant select, insert, update on public.study_sessions to authenticated;
grant select, insert on public.workspace_activity_events to authenticated;

create index if not exists user_recent_items_user_opened_idx
  on public.user_recent_items(user_id, last_opened_at desc);
create index if not exists user_recent_items_user_binder_opened_idx
  on public.user_recent_items(user_id, binder_id, last_opened_at desc)
  where binder_id is not null;
create index if not exists user_recent_items_lesson_idx
  on public.user_recent_items(lesson_id)
  where lesson_id is not null;

create index if not exists study_sessions_user_started_idx
  on public.study_sessions(user_id, started_at desc);
create index if not exists study_sessions_binder_started_idx
  on public.study_sessions(binder_id, started_at desc)
  where binder_id is not null;
create index if not exists study_sessions_lesson_started_idx
  on public.study_sessions(lesson_id, started_at desc)
  where lesson_id is not null;

create index if not exists workspace_activity_events_user_created_idx
  on public.workspace_activity_events(user_id, created_at desc);
create index if not exists workspace_activity_events_binder_lesson_created_idx
  on public.workspace_activity_events(binder_id, lesson_id, created_at desc)
  where binder_id is not null;
create index if not exists workspace_activity_events_module_created_idx
  on public.workspace_activity_events(user_id, module_id, created_at desc);

create or replace function private.set_activity_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_recent_items_set_updated_at on public.user_recent_items;
create trigger user_recent_items_set_updated_at
before update on public.user_recent_items
for each row
execute function private.set_activity_updated_at();

drop trigger if exists study_sessions_set_updated_at on public.study_sessions;
create trigger study_sessions_set_updated_at
before update on public.study_sessions
for each row
execute function private.set_activity_updated_at();

revoke execute on function private.set_activity_updated_at() from public, anon, authenticated;

create or replace function public.record_user_recent_item(
  p_user_id uuid,
  p_item_type text,
  p_item_id text,
  p_binder_id text default null,
  p_folder_id text default null,
  p_lesson_id text default null,
  p_title_snapshot text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_user_id <> (select auth.uid()) then
    raise exception 'Activity user_id must match the signed-in user.'
      using errcode = '42501';
  end if;

  insert into public.user_recent_items (
    user_id,
    item_type,
    item_id,
    binder_id,
    folder_id,
    lesson_id,
    title_snapshot,
    last_opened_at,
    open_count,
    metadata
  )
  values (
    p_user_id,
    p_item_type,
    p_item_id,
    p_binder_id,
    p_folder_id,
    p_lesson_id,
    nullif(left(coalesce(p_title_snapshot, ''), 180), ''),
    now(),
    1,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, item_type, item_id)
  do update set
    binder_id = excluded.binder_id,
    folder_id = excluded.folder_id,
    lesson_id = excluded.lesson_id,
    title_snapshot = coalesce(excluded.title_snapshot, public.user_recent_items.title_snapshot),
    last_opened_at = now(),
    open_count = public.user_recent_items.open_count + 1,
    metadata = excluded.metadata,
    updated_at = now();
end;
$$;

revoke execute on function public.record_user_recent_item(uuid, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.record_user_recent_item(uuid, text, text, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard summary health/staleness observability.
-- ---------------------------------------------------------------------------

alter table public.dashboard_folder_summaries
  add column if not exists summary_status text not null default 'fresh',
  add column if not exists last_refreshed_at timestamptz,
  add column if not exists stale_after timestamptz,
  add column if not exists refresh_error_code text,
  add column if not exists refresh_error_message text,
  add column if not exists refresh_attempts integer not null default 0,
  add column if not exists source_updated_at timestamptz;

alter table public.dashboard_binder_summaries
  add column if not exists summary_status text not null default 'fresh',
  add column if not exists last_refreshed_at timestamptz,
  add column if not exists stale_after timestamptz,
  add column if not exists refresh_error_code text,
  add column if not exists refresh_error_message text,
  add column if not exists refresh_attempts integer not null default 0,
  add column if not exists source_updated_at timestamptz;

alter table public.dashboard_lesson_summaries
  add column if not exists summary_status text not null default 'fresh',
  add column if not exists last_refreshed_at timestamptz,
  add column if not exists stale_after timestamptz,
  add column if not exists refresh_error_code text,
  add column if not exists refresh_error_message text,
  add column if not exists refresh_attempts integer not null default 0,
  add column if not exists source_updated_at timestamptz;

alter table public.admin_binder_summaries
  add column if not exists summary_status text not null default 'fresh',
  add column if not exists last_refreshed_at timestamptz,
  add column if not exists stale_after timestamptz,
  add column if not exists refresh_error_code text,
  add column if not exists refresh_error_message text,
  add column if not exists refresh_attempts integer not null default 0,
  add column if not exists source_updated_at timestamptz;

do $$ begin
  alter table public.dashboard_folder_summaries
    add constraint dashboard_folder_summaries_summary_status_check
    check (summary_status in ('fresh', 'stale', 'refreshing', 'failed')) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.dashboard_binder_summaries
    add constraint dashboard_binder_summaries_summary_status_check
    check (summary_status in ('fresh', 'stale', 'refreshing', 'failed')) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.dashboard_lesson_summaries
    add constraint dashboard_lesson_summaries_summary_status_check
    check (summary_status in ('fresh', 'stale', 'refreshing', 'failed')) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.admin_binder_summaries
    add constraint admin_binder_summaries_summary_status_check
    check (summary_status in ('fresh', 'stale', 'refreshing', 'failed')) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.dashboard_folder_summaries
    add constraint dashboard_folder_summaries_refresh_attempts_nonnegative
    check (refresh_attempts >= 0) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.dashboard_binder_summaries
    add constraint dashboard_binder_summaries_refresh_attempts_nonnegative
    check (refresh_attempts >= 0) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.dashboard_lesson_summaries
    add constraint dashboard_lesson_summaries_refresh_attempts_nonnegative
    check (refresh_attempts >= 0) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.admin_binder_summaries
    add constraint admin_binder_summaries_refresh_attempts_nonnegative
    check (refresh_attempts >= 0) not valid;
exception when duplicate_object then null;
end $$;

create index if not exists dashboard_folder_summaries_health_idx
  on public.dashboard_folder_summaries(summary_status, stale_after);
create index if not exists dashboard_binder_summaries_health_idx
  on public.dashboard_binder_summaries(summary_status, stale_after);
create index if not exists dashboard_lesson_summaries_health_idx
  on public.dashboard_lesson_summaries(summary_status, stale_after);
create index if not exists admin_binder_summaries_health_idx
  on public.admin_binder_summaries(summary_status, stale_after);
