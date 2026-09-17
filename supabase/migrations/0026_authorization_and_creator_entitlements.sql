-- Additive remediation. Product entitlements never change profiles.role.
create table public.account_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus', 'studio', 'everything')),
  status text not null default 'inactive' check (status in ('active', 'inactive')),
  valid_until timestamptz,
  source text not null default 'operator',
  updated_at timestamptz not null default now()
);
alter table public.account_entitlements enable row level security;
create policy "entitlements read own" on public.account_entitlements
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.account_entitlements from public, anon, authenticated;
grant select on table public.account_entitlements to authenticated;
grant select, insert, update, delete on table public.account_entitlements to service_role;

create or replace function private.has_creator_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.account_entitlements
    where user_id = (select auth.uid()) and status = 'active'
      and plan in ('studio', 'everything') and (valid_until is null or valid_until > now()));
$$;
revoke all on function private.has_creator_access() from public, anon;
grant execute on function private.has_creator_access() to authenticated, service_role;

-- Policy expressions resolve the private helper at migration time. Its schema
-- stays outside PostgREST exposure; public.is_admin remains uncallable by clients.
alter policy "chem concepts read published" on public.chem_concepts
  using (status = 'published' or (select private.is_admin()));
alter policy "chem concepts admin manage" on public.chem_concepts
  using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy "chem problem templates read published" on public.chem_problem_templates
  using (status = 'published' or (select private.is_admin()));
alter policy "chem problem templates admin manage" on public.chem_problem_templates
  using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy "chem lab templates read published" on public.chem_lab_templates
  using (status = 'published' or (select private.is_admin()));
alter policy "chem lab templates admin manage" on public.chem_lab_templates
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Creators can manage their own materials, never global catalog/seed/operator data.
create policy "creators insert own binders" on public.binders for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.has_creator_access()) and suite_template_id is null);
create policy "creators update own binders" on public.binders for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.has_creator_access()) and suite_template_id is null)
  with check (owner_id = (select auth.uid()) and (select private.has_creator_access()) and suite_template_id is null);
create policy "creators delete own binders" on public.binders for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.has_creator_access()) and suite_template_id is null);
create policy "creators manage own lessons" on public.binder_lessons for all to authenticated
  using (exists (select 1 from public.binders b where b.id = binder_id and b.owner_id = (select auth.uid())
    and b.suite_template_id is null and (select private.has_creator_access())))
  with check (exists (select 1 from public.binders b where b.id = binder_id and b.owner_id = (select auth.uid())
    and b.suite_template_id is null and (select private.has_creator_access())));

-- Ownership must also hold across private foreign-key references. A foreign key
-- alone bypasses RLS visibility checks when validating the referenced row.
create or replace function private.enforce_private_parent_ownership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare parent_owner uuid;
begin
  if tg_table_name = 'question_attempts' then
    select user_id into parent_owner from public.quiz_attempts where id = new.quiz_attempt_id;
    if parent_owner is distinct from new.user_id then
      raise exception 'PRIVATE_PARENT_OWNERSHIP' using errcode = '23514';
    end if;
  elsif tg_table_name = 'user_lab_reports' and new.lab_run_id is not null then
    select user_id into parent_owner from public.user_lab_runs where id = new.lab_run_id;
    if parent_owner is distinct from new.user_id then
      raise exception 'PRIVATE_PARENT_OWNERSHIP' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_private_parent_ownership() from public, anon, authenticated;
create trigger question_attempts_private_parent before insert or update of user_id, quiz_attempt_id
  on public.question_attempts for each row execute function private.enforce_private_parent_ownership();
create trigger lab_reports_private_parent before insert or update of user_id, lab_run_id
  on public.user_lab_reports for each row execute function private.enforce_private_parent_ownership();
notify pgrst, 'reload schema';
