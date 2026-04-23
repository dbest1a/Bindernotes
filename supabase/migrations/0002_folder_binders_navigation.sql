create table if not exists public.folder_binders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  binder_id uuid not null references public.binders(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, folder_id, binder_id)
);

create index if not exists folder_binders_owner_folder_idx
  on public.folder_binders(owner_id, folder_id);

create index if not exists folder_binders_owner_binder_idx
  on public.folder_binders(owner_id, binder_id);

insert into public.folder_binders (owner_id, folder_id, binder_id)
select distinct owner_id, folder_id, binder_id
from public.learner_notes
where folder_id is not null
on conflict (owner_id, folder_id, binder_id) do nothing;

alter table public.folder_binders enable row level security;

create policy "folder binders own"
  on public.folder_binders
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
