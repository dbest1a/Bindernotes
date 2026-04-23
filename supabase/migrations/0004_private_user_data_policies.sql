create policy "profiles insert own" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "comments read visible binder" on public.comments;
drop policy if exists "comments create own visible binder" on public.comments;
drop policy if exists "comments update own" on public.comments;
drop policy if exists "comments delete own or admin" on public.comments;

create policy "comments own" on public.comments
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
