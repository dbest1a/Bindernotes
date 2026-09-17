create table if not exists public.tutorial_entries (
  id text primary key,
  slug text not null unique,
  title text not null,
  audience text not null default 'all' check (audience in ('admin', 'learner', 'all')),
  category text not null check (
    category in (
      'Getting Started',
      'Dashboard',
      'Workspace',
      'Notes',
      'Whiteboard',
      'Math',
      'History',
      'Admin',
      'Settings'
    )
  ),
  route_patterns text[] not null default '{}',
  prompt_route_patterns text[] not null default '{}',
  tags text[] not null default '{}',
  summary text not null default '',
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  video_url text not null default '',
  poster_url text not null default '/tutorials/posters/bindernotes-tutorial-poster.svg',
  steps text[] not null default '{}',
  transcript text not null default '',
  related_feature_link text not null default '/dashboard',
  storage_path text,
  poster_storage_path text,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 1000,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.tutorial_entries
  add column if not exists slug text,
  add column if not exists duration_seconds integer not null default 0,
  add column if not exists video_url text not null default '',
  add column if not exists poster_url text not null default '/tutorials/posters/bindernotes-tutorial-poster.svg',
  add column if not exists published_at timestamptz;

update public.tutorial_entries
set slug = id
where slug is null or slug = '';

alter table public.tutorial_entries
  alter column slug set not null;

alter table public.tutorial_entries
  add constraint tutorial_entries_duration_seconds_nonnegative check (duration_seconds >= 0);

create unique index if not exists tutorial_entries_slug_key
  on public.tutorial_entries (slug);

create index if not exists tutorial_entries_status_sort_idx
  on public.tutorial_entries (status, sort_order, updated_at desc);

create index if not exists tutorial_entries_category_idx
  on public.tutorial_entries (category);

alter table public.tutorial_entries enable row level security;

drop policy if exists "tutorial entries read published or admin" on public.tutorial_entries;
create policy "tutorial entries read published or admin" on public.tutorial_entries
  for select using (status = 'published' or public.is_admin());

drop policy if exists "tutorial entries admin insert" on public.tutorial_entries;
create policy "tutorial entries admin insert" on public.tutorial_entries
  for insert with check (public.is_admin());

drop policy if exists "tutorial entries admin update" on public.tutorial_entries;
create policy "tutorial entries admin update" on public.tutorial_entries
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tutorial entries admin delete" on public.tutorial_entries;
create policy "tutorial entries admin delete" on public.tutorial_entries
  for delete using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tutorial-videos',
  'tutorial-videos',
  true,
  524288000,
  array[
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tutorial-posters',
  'tutorial-posters',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tutorial videos public read" on storage.objects;
create policy "tutorial videos public read" on storage.objects
  for select using (bucket_id = 'tutorial-videos');

drop policy if exists "tutorial posters public read" on storage.objects;
create policy "tutorial posters public read" on storage.objects
  for select using (bucket_id = 'tutorial-posters');

drop policy if exists "tutorial videos admin insert" on storage.objects;
create policy "tutorial videos admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'tutorial-videos' and public.is_admin());

drop policy if exists "tutorial posters admin insert" on storage.objects;
create policy "tutorial posters admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'tutorial-posters' and public.is_admin());

drop policy if exists "tutorial videos admin update" on storage.objects;
create policy "tutorial videos admin update" on storage.objects
  for update to authenticated using (bucket_id = 'tutorial-videos' and public.is_admin())
  with check (bucket_id = 'tutorial-videos' and public.is_admin());

drop policy if exists "tutorial posters admin update" on storage.objects;
create policy "tutorial posters admin update" on storage.objects
  for update to authenticated using (bucket_id = 'tutorial-posters' and public.is_admin())
  with check (bucket_id = 'tutorial-posters' and public.is_admin());

drop policy if exists "tutorial videos admin delete" on storage.objects;
create policy "tutorial videos admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'tutorial-videos' and public.is_admin());

drop policy if exists "tutorial posters admin delete" on storage.objects;
create policy "tutorial posters admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'tutorial-posters' and public.is_admin());
