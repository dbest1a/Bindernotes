-- Lock client privileges for profile roles and purchase/entitlement state.
-- This is intentionally narrow: do not let browser roles mutate admin roles or
-- payment state, while preserving safe profile edits and purchase reads.

alter table public.profiles enable row level security;

drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles update own safe fields" on public.profiles;
create policy "profiles update own safe fields"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from anon, authenticated;
revoke update (id, email, role, created_at) on public.profiles from anon, authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;

alter table public.purchases enable row level security;

drop policy if exists "purchases insert own placeholder" on public.purchases;
drop policy if exists "purchases update own" on public.purchases;
drop policy if exists "purchases delete own" on public.purchases;

revoke insert, update, delete on public.purchases from anon, authenticated;
grant select on public.purchases to authenticated;

notify pgrst, 'reload schema';
