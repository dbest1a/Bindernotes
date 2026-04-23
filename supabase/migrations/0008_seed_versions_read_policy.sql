drop policy if exists "seed versions admin only" on public.seed_versions;
drop policy if exists "seed versions readable when suite published" on public.seed_versions;
drop policy if exists "seed versions admin write" on public.seed_versions;

create policy "seed versions readable when suite published"
  on public.seed_versions
  for select
  using (public.can_read_suite_template(suite_template_id));

create policy "seed versions admin write"
  on public.seed_versions
  for all
  using (public.is_admin())
  with check (public.is_admin());
