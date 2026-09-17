-- Supabase Security Advisor lint cleanup.
-- This migration removes direct browser RPC access to internal SECURITY DEFINER
-- functions, moves RLS helper execution to a non-exposed schema, pins mutable
-- function search paths, and removes broad public storage listing policies.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function private.owns_published_or_enrolled(target_binder_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.binders
    where id::text = target_binder_id::text
      and status = 'published'
  )
  or exists (
    select 1
    from public.enrollments
    where user_id = (select auth.uid())
      and binder_id::text = target_binder_id::text
  )
  or private.is_admin();
$$;

create or replace function private.owns_published_or_enrolled(target_binder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.owns_published_or_enrolled(target_binder_id::text);
$$;

create or replace function private.can_read_suite_template(target_suite_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.suite_templates
    where id = target_suite_id
      and (status = 'published' or private.is_admin())
  );
$$;

revoke execute on function private.is_admin() from public;
revoke execute on function private.owns_published_or_enrolled(text) from public;
revoke execute on function private.owns_published_or_enrolled(uuid) from public;
revoke execute on function private.can_read_suite_template(text) from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.owns_published_or_enrolled(text) to anon, authenticated, service_role;
grant execute on function private.owns_published_or_enrolled(uuid) to anon, authenticated, service_role;
grant execute on function private.can_read_suite_template(text) to anon, authenticated, service_role;

do $$
declare
  policy_row record;
  next_qual text;
  next_check text;
  statement text;
begin
  for policy_row in
    select
      p.polname,
      n.nspname,
      c.relname,
      pg_get_expr(p.polqual, p.polrelid) as qual,
      pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%public.is_admin()%'
       or coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%public.owns_published_or_enrolled(%'
       or coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%public.can_read_suite_template(%'
       or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%public.is_admin()%'
       or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%public.owns_published_or_enrolled(%'
       or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%public.can_read_suite_template(%'
  loop
    next_qual := replace(
      replace(
        replace(policy_row.qual, 'public.is_admin()', 'private.is_admin()'),
        'public.owns_published_or_enrolled(',
        'private.owns_published_or_enrolled('
      ),
      'public.can_read_suite_template(',
      'private.can_read_suite_template('
    );
    next_check := replace(
      replace(
        replace(policy_row.check_expr, 'public.is_admin()', 'private.is_admin()'),
        'public.owns_published_or_enrolled(',
        'private.owns_published_or_enrolled('
      ),
      'public.can_read_suite_template(',
      'private.can_read_suite_template('
    );

    statement := format('alter policy %I on %I.%I', policy_row.polname, policy_row.nspname, policy_row.relname);
    if next_qual is not null then
      statement := statement || format(' using (%s)', next_qual);
    end if;
    if next_check is not null then
      statement := statement || format(' with check (%s)', next_check);
    end if;
    execute statement;
  end loop;
end;
$$;

alter function public.bn_word_count(text) set search_path = public, pg_temp;
alter function public.set_personal_notes_updated_at() set search_path = public, pg_temp;
alter function public.bn_jsonb_plain_text(jsonb) set search_path = public, pg_temp;

alter function public.is_admin() set search_path = public, pg_temp;
alter function public.owns_published_or_enrolled(text) set search_path = public, pg_temp;
alter function public.can_read_suite_template(text) set search_path = public, pg_temp;

do $$
begin
  if to_regprocedure('public.owns_published_or_enrolled(uuid)') is not null then
    execute 'alter function public.owns_published_or_enrolled(uuid) set search_path = public, pg_temp';
  end if;
end;
$$;

revoke execute on function public.can_read_suite_template(text) from public;
revoke execute on function public.can_read_suite_template(text) from anon;
revoke execute on function public.can_read_suite_template(text) from authenticated;

revoke execute on function public.cleanup_stale_summary_refresh_jobs(interval) from public;
revoke execute on function public.cleanup_stale_summary_refresh_jobs(interval) from anon;
revoke execute on function public.cleanup_stale_summary_refresh_jobs(interval) from authenticated;

revoke execute on function public.enforce_whiteboard_active_limit() from public;
revoke execute on function public.enforce_whiteboard_active_limit() from anon;
revoke execute on function public.enforce_whiteboard_active_limit() from authenticated;

revoke execute on function public.enqueue_binder_summary_refresh() from public;
revoke execute on function public.enqueue_binder_summary_refresh() from anon;
revoke execute on function public.enqueue_binder_summary_refresh() from authenticated;

revoke execute on function public.enqueue_folder_binder_summary_refresh() from public;
revoke execute on function public.enqueue_folder_binder_summary_refresh() from anon;
revoke execute on function public.enqueue_folder_binder_summary_refresh() from authenticated;

revoke execute on function public.enqueue_folder_row_summary_refresh() from public;
revoke execute on function public.enqueue_folder_row_summary_refresh() from anon;
revoke execute on function public.enqueue_folder_row_summary_refresh() from authenticated;

revoke execute on function public.enqueue_lesson_summary_refresh() from public;
revoke execute on function public.enqueue_lesson_summary_refresh() from anon;
revoke execute on function public.enqueue_lesson_summary_refresh() from authenticated;

revoke execute on function public.enqueue_summary_refresh_job(text, text, text, uuid, integer) from public;
revoke execute on function public.enqueue_summary_refresh_job(text, text, text, uuid, integer) from anon;
revoke execute on function public.enqueue_summary_refresh_job(text, text, text, uuid, integer) from authenticated;

revoke execute on function public.enqueue_tutorial_summary_refresh() from public;
revoke execute on function public.enqueue_tutorial_summary_refresh() from anon;
revoke execute on function public.enqueue_tutorial_summary_refresh() from authenticated;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_admin() from authenticated;

revoke execute on function public.owns_published_or_enrolled(text) from public;
revoke execute on function public.owns_published_or_enrolled(text) from anon;
revoke execute on function public.owns_published_or_enrolled(text) from authenticated;

do $$
begin
  if to_regprocedure('public.owns_published_or_enrolled(uuid)') is not null then
    execute 'revoke execute on function public.owns_published_or_enrolled(uuid) from public';
    execute 'revoke execute on function public.owns_published_or_enrolled(uuid) from anon';
    execute 'revoke execute on function public.owns_published_or_enrolled(uuid) from authenticated';
  end if;
end;
$$;

revoke execute on function public.process_summary_refresh_queue(integer) from public;
revoke execute on function public.process_summary_refresh_queue(integer) from anon;
revoke execute on function public.process_summary_refresh_queue(integer) from authenticated;

revoke execute on function public.refresh_admin_binder_summary(text) from public;
revoke execute on function public.refresh_admin_binder_summary(text) from anon;
revoke execute on function public.refresh_admin_binder_summary(text) from authenticated;

revoke execute on function public.refresh_all_admin_summaries() from public;
revoke execute on function public.refresh_all_admin_summaries() from anon;
revoke execute on function public.refresh_all_admin_summaries() from authenticated;

revoke execute on function public.refresh_all_dashboard_summaries() from public;
revoke execute on function public.refresh_all_dashboard_summaries() from anon;
revoke execute on function public.refresh_all_dashboard_summaries() from authenticated;

revoke execute on function public.refresh_all_tutorial_video_summaries() from public;
revoke execute on function public.refresh_all_tutorial_video_summaries() from anon;
revoke execute on function public.refresh_all_tutorial_video_summaries() from authenticated;

revoke execute on function public.refresh_dashboard_binder_summary(text) from public;
revoke execute on function public.refresh_dashboard_binder_summary(text) from anon;
revoke execute on function public.refresh_dashboard_binder_summary(text) from authenticated;

revoke execute on function public.refresh_dashboard_folder_summary(text) from public;
revoke execute on function public.refresh_dashboard_folder_summary(text) from anon;
revoke execute on function public.refresh_dashboard_folder_summary(text) from authenticated;

revoke execute on function public.refresh_lesson_search_excerpt(text) from public;
revoke execute on function public.refresh_lesson_search_excerpt(text) from anon;
revoke execute on function public.refresh_lesson_search_excerpt(text) from authenticated;

revoke execute on function public.refresh_tutorial_video_summary(text) from public;
revoke execute on function public.refresh_tutorial_video_summary(text) from anon;
revoke execute on function public.refresh_tutorial_video_summary(text) from authenticated;

grant execute on function public.handle_new_user() to supabase_auth_admin;

grant execute on function public.cleanup_stale_summary_refresh_jobs(interval) to service_role;
grant execute on function public.enqueue_summary_refresh_job(text, text, text, uuid, integer) to service_role;
grant execute on function public.process_summary_refresh_queue(integer) to service_role;
grant execute on function public.refresh_admin_binder_summary(text) to service_role;
grant execute on function public.refresh_all_admin_summaries() to service_role;
grant execute on function public.refresh_all_dashboard_summaries() to service_role;
grant execute on function public.refresh_all_tutorial_video_summaries() to service_role;
grant execute on function public.refresh_dashboard_binder_summary(text) to service_role;
grant execute on function public.refresh_dashboard_folder_summary(text) to service_role;
grant execute on function public.refresh_lesson_search_excerpt(text) to service_role;
grant execute on function public.refresh_tutorial_video_summary(text) to service_role;

drop policy if exists "tutorial posters public read" on storage.objects;
drop policy if exists "tutorial videos public read" on storage.objects;
