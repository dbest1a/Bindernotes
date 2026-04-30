-- Security hardening for client-facing Supabase tables.
-- The browser can hold the anon key, so sensitive roles, entitlements, and
-- publish state must be protected by database privileges and RLS.

alter table public.profiles enable row level security;

drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles insert own learner" on public.profiles;
create policy "profiles insert own learner"
  on public.profiles for insert
  with check (id = auth.uid() and role = 'learner');

drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles update own safe fields" on public.profiles;
create policy "profiles update own safe fields"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from anon, authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;

-- Payment/entitlement state is server/webhook controlled only.
alter table public.purchases enable row level security;

drop policy if exists "purchases insert own placeholder" on public.purchases;
drop policy if exists "purchases update own" on public.purchases;
drop policy if exists "purchases delete own" on public.purchases;

revoke insert, update, delete on public.purchases from anon, authenticated;
grant select on public.purchases to authenticated;

-- Learners may keep private drafts, but published/global questions are admin controlled.
alter table public.question_bank enable row level security;
alter table public.question_choices enable row level security;

drop policy if exists "questions insert own" on public.question_bank;
drop policy if exists "questions insert own drafts" on public.question_bank;
drop policy if exists "questions update own" on public.question_bank;
drop policy if exists "questions update own drafts" on public.question_bank;
drop policy if exists "questions delete own" on public.question_bank;
drop policy if exists "questions delete own drafts" on public.question_bank;

create policy "questions insert own drafts"
  on public.question_bank for insert
  with check (
    public.is_admin()
    or (created_by = auth.uid() and status = 'draft')
  );

create policy "questions update own drafts"
  on public.question_bank for update
  using (
    public.is_admin()
    or (created_by = auth.uid() and status = 'draft')
  )
  with check (
    public.is_admin()
    or (created_by = auth.uid() and status = 'draft')
  );

create policy "questions delete own drafts"
  on public.question_bank for delete
  using (
    public.is_admin()
    or (created_by = auth.uid() and status = 'draft')
  );

drop policy if exists "choices write through owned question" on public.question_choices;
drop policy if exists "choices write through owned draft question" on public.question_choices;
create policy "choices write through owned draft question"
  on public.question_choices for all
  using (
    exists (
      select 1 from public.question_bank q
      where q.id = question_id
        and (
          public.is_admin()
          or (q.created_by = auth.uid() and q.status = 'draft')
        )
    )
  )
  with check (
    exists (
      select 1 from public.question_bank q
      where q.id = question_id
        and (
          public.is_admin()
          or (q.created_by = auth.uid() and q.status = 'draft')
        )
    )
  );

-- Whiteboard storage limits must hold even for direct Supabase writes.
alter table public.whiteboards enable row level security;
alter table public.whiteboard_versions enable row level security;
alter table public.whiteboard_assets enable row level security;

do $$ begin
  alter table public.whiteboards
    add constraint whiteboards_scene_size_limit
    check (scene_size_bytes >= 0 and scene_size_bytes <= 10485760) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.whiteboards
    add constraint whiteboards_asset_size_limit
    check (asset_size_bytes >= 0 and asset_size_bytes <= 52428800) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.whiteboards
    add constraint whiteboards_object_count_limit
    check (object_count >= 0 and object_count <= 5000) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.whiteboard_versions
    add constraint whiteboard_versions_scene_size_limit
    check (scene_size_bytes >= 0 and scene_size_bytes <= 10485760) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.whiteboard_assets
    add constraint whiteboard_assets_file_size_limit
    check (size_bytes >= 0 and size_bytes <= 5242880) not valid;
exception when duplicate_object then null;
end $$;

create or replace function public.whiteboard_json_array_length(value jsonb)
returns integer
language sql
immutable
set search_path = public
as $$
  select case when jsonb_typeof(value) = 'array' then jsonb_array_length(value) else 0 end;
$$;

create or replace function public.enforce_whiteboard_payload_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scene_payload jsonb;
  modules_payload jsonb;
  computed_scene_size integer;
  computed_object_count integer;
begin
  scene_payload := coalesce(new.scene, new.scene_json, '{}'::jsonb);
  modules_payload := coalesce(new.modules, new.module_elements, '[]'::jsonb);
  computed_scene_size := octet_length(scene_payload::text);
  computed_object_count :=
    public.whiteboard_json_array_length(scene_payload -> 'elements')
    + public.whiteboard_json_array_length(modules_payload);

  new.scene_size_bytes := greatest(coalesce(new.scene_size_bytes, 0), computed_scene_size);
  new.object_count := greatest(coalesce(new.object_count, 0), computed_object_count);

  if new.scene_size_bytes > 10485760 then
    raise exception 'WHITEBOARD_SCENE_TOO_LARGE: Whiteboard scene JSON exceeds the 10 MB limit.'
      using errcode = '23514';
  end if;

  if new.asset_size_bytes > 52428800 then
    raise exception 'WHITEBOARD_ASSETS_TOO_LARGE: Whiteboard assets exceed the 50 MB board limit.'
      using errcode = '23514';
  end if;

  if new.object_count > 5000 then
    raise exception 'WHITEBOARD_OBJECT_LIMIT_REACHED: Whiteboard object count exceeds the 5000 object limit.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists whiteboards_enforce_payload_limits on public.whiteboards;
create trigger whiteboards_enforce_payload_limits
before insert or update of scene_json, scene, module_elements, modules, scene_size_bytes, object_count, asset_size_bytes
on public.whiteboards
for each row
execute function public.enforce_whiteboard_payload_limits();

create or replace function public.enforce_whiteboard_version_payload_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scene_payload jsonb;
  computed_scene_size integer;
begin
  scene_payload := coalesce(new.scene, new.scene_json, '{}'::jsonb);
  computed_scene_size := octet_length(scene_payload::text);
  new.scene_size_bytes := greatest(coalesce(new.scene_size_bytes, 0), computed_scene_size);

  if new.scene_size_bytes > 10485760 then
    raise exception 'WHITEBOARD_VERSION_SCENE_TOO_LARGE: Whiteboard version scene JSON exceeds the 10 MB limit.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists whiteboard_versions_enforce_payload_limits on public.whiteboard_versions;
create trigger whiteboard_versions_enforce_payload_limits
before insert or update of scene_json, scene, scene_size_bytes
on public.whiteboard_versions
for each row
execute function public.enforce_whiteboard_version_payload_limits();

create or replace function public.prune_whiteboard_version_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.whiteboard_versions stale
  where stale.whiteboard_id = new.whiteboard_id
    and stale.id in (
      select id
      from public.whiteboard_versions
      where whiteboard_id = new.whiteboard_id
      order by version desc, created_at desc
      offset 10
    );

  return null;
end;
$$;

drop trigger if exists whiteboard_versions_prune_history on public.whiteboard_versions;
create trigger whiteboard_versions_prune_history
after insert on public.whiteboard_versions
for each row
execute function public.prune_whiteboard_version_history();

-- Supabase security lints: do not expose trigger/background SECURITY DEFINER
-- helpers through PostgREST RPC. These are invoked by triggers or trusted
-- server jobs, not directly by browser clients.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_whiteboard_active_limit() from public, anon, authenticated;
revoke execute on function public.enforce_whiteboard_payload_limits() from public, anon, authenticated;
revoke execute on function public.enforce_whiteboard_version_payload_limits() from public, anon, authenticated;
revoke execute on function public.prune_whiteboard_version_history() from public, anon, authenticated;
revoke execute on function public.enqueue_binder_summary_refresh() from public, anon, authenticated;
revoke execute on function public.enqueue_lesson_summary_refresh() from public, anon, authenticated;
revoke execute on function public.enqueue_folder_row_summary_refresh() from public, anon, authenticated;
revoke execute on function public.enqueue_folder_binder_summary_refresh() from public, anon, authenticated;
revoke execute on function public.enqueue_tutorial_summary_refresh() from public, anon, authenticated;
revoke execute on function public.refresh_lesson_search_excerpt(text) from public, anon, authenticated;
revoke execute on function public.refresh_dashboard_binder_summary(text) from public, anon, authenticated;
revoke execute on function public.refresh_dashboard_folder_summary(text) from public, anon, authenticated;
revoke execute on function public.refresh_admin_binder_summary(text) from public, anon, authenticated;
revoke execute on function public.refresh_tutorial_video_summary(text) from public, anon, authenticated;
revoke execute on function public.refresh_all_dashboard_summaries() from public, anon, authenticated;
revoke execute on function public.refresh_all_admin_summaries() from public, anon, authenticated;
revoke execute on function public.refresh_all_tutorial_video_summaries() from public, anon, authenticated;
revoke execute on function public.cleanup_stale_summary_refresh_jobs(interval) from public, anon, authenticated;
revoke execute on function public.enqueue_summary_refresh_job(text, text, text, uuid, integer) from public, anon, authenticated;
revoke execute on function public.process_summary_refresh_queue(integer) from public, anon, authenticated;

grant execute on function public.cleanup_stale_summary_refresh_jobs(interval) to service_role;
grant execute on function public.enqueue_summary_refresh_job(text, text, text, uuid, integer) to service_role;
grant execute on function public.process_summary_refresh_queue(integer) to service_role;
grant execute on function public.refresh_lesson_search_excerpt(text) to service_role;
grant execute on function public.refresh_dashboard_binder_summary(text) to service_role;
grant execute on function public.refresh_dashboard_folder_summary(text) to service_role;
grant execute on function public.refresh_admin_binder_summary(text) to service_role;
grant execute on function public.refresh_tutorial_video_summary(text) to service_role;
grant execute on function public.refresh_all_dashboard_summaries() to service_role;
grant execute on function public.refresh_all_admin_summaries() to service_role;
grant execute on function public.refresh_all_tutorial_video_summaries() to service_role;

-- RLS helper functions remain executable because existing policies call them.
-- Keep them SECURITY DEFINER with a pinned search_path; a later private-schema
-- helper migration can remove the remaining RPC linter noise without changing
-- policy behavior.
alter function public.is_admin() set search_path = public;
alter function public.owns_published_or_enrolled(text) set search_path = public;
alter function public.owns_published_or_enrolled(uuid) set search_path = public;
alter function public.can_read_suite_template(text) set search_path = public;

-- Fix mutable search_path lints on utility functions.
create or replace function public.set_personal_notes_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.bn_word_count(input text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(trim(coalesce(input, '')), '') is null then 0
    else cardinality(regexp_split_to_array(trim(input), '\s+'))
  end;
$$;

create or replace function public.bn_jsonb_plain_text(value jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  item jsonb;
  pair record;
  result text := '';
begin
  if value is null then
    return '';
  end if;

  case jsonb_typeof(value)
    when 'string' then
      return coalesce(value #>> '{}', '');
    when 'number' then
      return value::text;
    when 'boolean' then
      return value::text;
    when 'array' then
      for item in select jsonb_array_elements(value)
      loop
        result := trim(result || ' ' || public.bn_jsonb_plain_text(item));
      end loop;
      return result;
    when 'object' then
      if value ? 'text' then
        result := trim(result || ' ' || coalesce(value ->> 'text', ''));
      end if;
      if value ? 'content' then
        result := trim(result || ' ' || public.bn_jsonb_plain_text(value -> 'content'));
      end if;
      for pair in select key, val from jsonb_each(value) as entry(key, val)
      loop
        if pair.key not in ('text', 'content') then
          result := trim(result || ' ' || public.bn_jsonb_plain_text(pair.val));
        end if;
      end loop;
      return result;
    else
      return '';
  end case;
end;
$$;

-- Public buckets can still serve public object URLs without broad SELECT
-- policies that allow clients to list every object in the bucket.
drop policy if exists "tutorial videos public read" on storage.objects;
drop policy if exists "tutorial posters public read" on storage.objects;
