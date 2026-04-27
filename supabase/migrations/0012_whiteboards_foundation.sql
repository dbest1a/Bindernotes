create table if not exists public.whiteboards (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text references public.binder_lessons(id) on delete cascade,
  title text not null,
  subject text not null default 'Math',
  module_context text not null default 'lesson' check (module_context in ('binder', 'lesson', 'math-lab')),
  scene_json jsonb not null default '{}'::jsonb,
  module_elements jsonb not null default '[]'::jsonb,
  thumbnail_path text,
  scene_size_bytes integer not null default 0,
  asset_size_bytes integer not null default 0,
  object_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.whiteboard_versions (
  id text primary key default gen_random_uuid()::text,
  whiteboard_id text not null references public.whiteboards(id) on delete cascade,
  version integer not null,
  scene_json jsonb not null default '{}'::jsonb,
  module_elements jsonb not null default '[]'::jsonb,
  scene_size_bytes integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (whiteboard_id, version)
);

create table if not exists public.whiteboard_assets (
  id text primary key default gen_random_uuid()::text,
  whiteboard_id text not null references public.whiteboards(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes integer not null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create index if not exists whiteboards_owner_binder_lesson_idx
  on public.whiteboards(owner_id, binder_id, lesson_id, updated_at desc)
  where archived_at is null;

create index if not exists whiteboard_versions_board_version_idx
  on public.whiteboard_versions(whiteboard_id, version desc);

create index if not exists whiteboard_assets_board_idx
  on public.whiteboard_assets(whiteboard_id, created_at desc);

alter table public.whiteboards enable row level security;
alter table public.whiteboard_versions enable row level security;
alter table public.whiteboard_assets enable row level security;

drop policy if exists "whiteboards select own" on public.whiteboards;
drop policy if exists "whiteboards insert own" on public.whiteboards;
drop policy if exists "whiteboards update own" on public.whiteboards;
drop policy if exists "whiteboards delete own" on public.whiteboards;

create policy "whiteboards select own"
  on public.whiteboards for select
  using (owner_id = auth.uid());

create policy "whiteboards insert own"
  on public.whiteboards for insert
  with check (owner_id = auth.uid());

create policy "whiteboards update own"
  on public.whiteboards for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "whiteboards delete own"
  on public.whiteboards for delete
  using (owner_id = auth.uid());

drop policy if exists "whiteboard versions select own" on public.whiteboard_versions;
drop policy if exists "whiteboard versions insert own" on public.whiteboard_versions;

create policy "whiteboard versions select own"
  on public.whiteboard_versions for select
  using (
    exists (
      select 1
      from public.whiteboards
      where whiteboards.id = whiteboard_versions.whiteboard_id
        and whiteboards.owner_id = auth.uid()
    )
  );

create policy "whiteboard versions insert own"
  on public.whiteboard_versions for insert
  with check (
    exists (
      select 1
      from public.whiteboards
      where whiteboards.id = whiteboard_versions.whiteboard_id
        and whiteboards.owner_id = auth.uid()
    )
  );

drop policy if exists "whiteboard assets select own" on public.whiteboard_assets;
drop policy if exists "whiteboard assets insert own" on public.whiteboard_assets;
drop policy if exists "whiteboard assets delete own" on public.whiteboard_assets;

create policy "whiteboard assets select own"
  on public.whiteboard_assets for select
  using (
    exists (
      select 1
      from public.whiteboards
      where whiteboards.id = whiteboard_assets.whiteboard_id
        and whiteboards.owner_id = auth.uid()
    )
  );

create policy "whiteboard assets insert own"
  on public.whiteboard_assets for insert
  with check (
    exists (
      select 1
      from public.whiteboards
      where whiteboards.id = whiteboard_assets.whiteboard_id
        and whiteboards.owner_id = auth.uid()
    )
  );

create policy "whiteboard assets delete own"
  on public.whiteboard_assets for delete
  using (
    exists (
      select 1
      from public.whiteboards
      where whiteboards.id = whiteboard_assets.whiteboard_id
        and whiteboards.owner_id = auth.uid()
    )
  );
