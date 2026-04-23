alter table public.folders
  add column if not exists source text not null default 'user',
  add column if not exists suite_template_id text references public.suite_templates(id) on delete set null;

alter table public.folders
  drop constraint if exists folders_source_check;

alter table public.folders
  add constraint folders_source_check
  check (source in ('user', 'system'));

create index if not exists folders_source_suite_idx
  on public.folders(source, suite_template_id);

create index if not exists folder_binders_folder_binder_idx
  on public.folder_binders(folder_id, binder_id);

drop policy if exists "system folders readable" on public.folders;
create policy "system folders readable"
  on public.folders
  for select
  using (
    owner_id = auth.uid()
    or (
      source = 'system'
      and suite_template_id is not null
      and public.can_read_suite_template(suite_template_id)
    )
    or public.is_admin()
  );

drop policy if exists "system folder binders readable" on public.folder_binders;
create policy "system folder binders readable"
  on public.folder_binders
  for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.folders
      where folders.id = folder_binders.folder_id
        and folders.source = 'system'
        and folders.suite_template_id is not null
        and public.can_read_suite_template(folders.suite_template_id)
    )
    or public.is_admin()
  );
