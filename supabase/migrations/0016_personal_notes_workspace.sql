create table if not exists public.personal_note_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default 'teal',
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_note_binders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  folder_id uuid references public.personal_note_folders(id) on delete set null,
  title text not null,
  description text,
  color text,
  pinned boolean not null default false,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_note_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id uuid not null references public.personal_note_binders(id) on delete cascade,
  title text not null,
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  math_blocks jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'::text[],
  pinned boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  folder_id uuid references public.personal_note_folders(id) on delete set null,
  binder_id uuid references public.personal_note_binders(id) on delete set null,
  document_id uuid references public.personal_note_documents(id) on delete set null,
  title text not null,
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  math_blocks jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'::text[],
  pinned boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_note_folders_owner_sort_idx
  on public.personal_note_folders(owner_id, sort_order, updated_at desc);

create index if not exists personal_note_binders_owner_folder_idx
  on public.personal_note_binders(owner_id, folder_id, pinned desc, sort_order, updated_at desc);

create index if not exists personal_note_documents_owner_binder_idx
  on public.personal_note_documents(owner_id, binder_id, pinned desc, updated_at desc)
  where archived_at is null;

create index if not exists personal_notes_owner_folder_idx
  on public.personal_notes(owner_id, folder_id, pinned desc, updated_at desc)
  where archived_at is null;

create or replace function public.set_personal_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_personal_note_folders_updated_at on public.personal_note_folders;
create trigger set_personal_note_folders_updated_at
  before update on public.personal_note_folders
  for each row execute function public.set_personal_notes_updated_at();

drop trigger if exists set_personal_note_binders_updated_at on public.personal_note_binders;
create trigger set_personal_note_binders_updated_at
  before update on public.personal_note_binders
  for each row execute function public.set_personal_notes_updated_at();

drop trigger if exists set_personal_note_documents_updated_at on public.personal_note_documents;
create trigger set_personal_note_documents_updated_at
  before update on public.personal_note_documents
  for each row execute function public.set_personal_notes_updated_at();

drop trigger if exists set_personal_notes_updated_at on public.personal_notes;
create trigger set_personal_notes_updated_at
  before update on public.personal_notes
  for each row execute function public.set_personal_notes_updated_at();

alter table public.personal_notes enable row level security;
alter table public.personal_note_binders enable row level security;
alter table public.personal_note_documents enable row level security;
alter table public.personal_note_folders enable row level security;

drop policy if exists "personal_notes own" on public.personal_notes;
drop policy if exists "personal_note_binders own" on public.personal_note_binders;
drop policy if exists "personal_note_documents own" on public.personal_note_documents;
drop policy if exists "personal_note_folders own" on public.personal_note_folders;

drop policy if exists "personal_notes select own" on public.personal_notes;
drop policy if exists "personal_notes insert own" on public.personal_notes;
drop policy if exists "personal_notes update own" on public.personal_notes;
drop policy if exists "personal_notes delete own" on public.personal_notes;

drop policy if exists "personal_note_binders select own" on public.personal_note_binders;
drop policy if exists "personal_note_binders insert own" on public.personal_note_binders;
drop policy if exists "personal_note_binders update own" on public.personal_note_binders;
drop policy if exists "personal_note_binders delete own" on public.personal_note_binders;

drop policy if exists "personal_note_documents select own" on public.personal_note_documents;
drop policy if exists "personal_note_documents insert own" on public.personal_note_documents;
drop policy if exists "personal_note_documents update own" on public.personal_note_documents;
drop policy if exists "personal_note_documents delete own" on public.personal_note_documents;

drop policy if exists "personal_note_folders select own" on public.personal_note_folders;
drop policy if exists "personal_note_folders insert own" on public.personal_note_folders;
drop policy if exists "personal_note_folders update own" on public.personal_note_folders;
drop policy if exists "personal_note_folders delete own" on public.personal_note_folders;

create policy "personal_notes select own" on public.personal_notes
  for select using (owner_id = auth.uid());
create policy "personal_notes insert own" on public.personal_notes
  for insert with check (owner_id = auth.uid());
create policy "personal_notes update own" on public.personal_notes
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "personal_notes delete own" on public.personal_notes
  for delete using (owner_id = auth.uid());

create policy "personal_note_binders select own" on public.personal_note_binders
  for select using (owner_id = auth.uid());
create policy "personal_note_binders insert own" on public.personal_note_binders
  for insert with check (owner_id = auth.uid());
create policy "personal_note_binders update own" on public.personal_note_binders
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "personal_note_binders delete own" on public.personal_note_binders
  for delete using (owner_id = auth.uid());

create policy "personal_note_documents select own" on public.personal_note_documents
  for select using (owner_id = auth.uid());
create policy "personal_note_documents insert own" on public.personal_note_documents
  for insert with check (owner_id = auth.uid());
create policy "personal_note_documents update own" on public.personal_note_documents
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "personal_note_documents delete own" on public.personal_note_documents
  for delete using (owner_id = auth.uid());

create policy "personal_note_folders select own" on public.personal_note_folders
  for select using (owner_id = auth.uid());
create policy "personal_note_folders insert own" on public.personal_note_folders
  for insert with check (owner_id = auth.uid());
create policy "personal_note_folders update own" on public.personal_note_folders
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "personal_note_folders delete own" on public.personal_note_folders
  for delete using (owner_id = auth.uid());

notify pgrst, 'reload schema';
