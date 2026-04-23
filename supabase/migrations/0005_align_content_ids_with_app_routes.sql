drop table if exists public.folder_binders cascade;
drop table if exists public.highlights cascade;
drop table if exists public.comments cascade;
drop table if exists public.learner_notes cascade;
drop table if exists public.binder_lessons cascade;
drop table if exists public.enrollments cascade;
drop table if exists public.purchases cascade;
drop table if exists public.concept_edges cascade;
drop table if exists public.concept_nodes cascade;
drop table if exists public.workspace_preferences cascade;
drop table if exists public.binders cascade;
drop table if exists public.folders cascade;

create table public.binders (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text not null default '',
  subject text not null default 'General',
  level text not null default 'Foundations',
  status public.publish_status not null default 'draft',
  price_cents integer not null default 0 check (price_cents >= 0),
  cover_url text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.binder_lessons (
  id text primary key default gen_random_uuid()::text,
  binder_id text not null references public.binders(id) on delete cascade,
  title text not null,
  order_index integer not null default 1,
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  math_blocks jsonb not null default '[]'::jsonb,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.folders (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default 'teal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrollments (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, binder_id)
);

create table public.learner_notes (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text not null references public.binder_lessons(id) on delete cascade,
  folder_id text references public.folders(id) on delete set null,
  title text not null default 'Private lesson notes',
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  math_blocks jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, lesson_id)
);

create table public.comments (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text not null references public.binder_lessons(id) on delete cascade,
  anchor_text text,
  body text not null,
  parent_id text references public.comments(id) on delete cascade,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.highlights (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text not null references public.binder_lessons(id) on delete cascade,
  anchor_text text not null,
  color text not null default 'yellow' check (color in ('yellow', 'blue', 'green', 'pink', 'orange')),
  note_id text references public.learner_notes(id) on delete set null,
  start_offset integer,
  end_offset integer,
  created_at timestamptz not null default now(),
  constraint highlights_offsets_check check (
    start_offset is null
    or end_offset is null
    or start_offset <= end_offset
  )
);

create table public.purchases (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text references public.binders(id) on delete set null,
  stripe_checkout_session_id text,
  stripe_customer_id text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  status public.purchase_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.concept_nodes (
  id text primary key default gen_random_uuid()::text,
  binder_id text not null references public.binders(id) on delete cascade,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.concept_edges (
  id text primary key default gen_random_uuid()::text,
  binder_id text not null references public.binders(id) on delete cascade,
  source_id text not null references public.concept_nodes(id) on delete cascade,
  target_id text not null references public.concept_nodes(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);

create table public.workspace_preferences (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  preferences jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, binder_id)
);

create table public.folder_binders (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  folder_id text not null references public.folders(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, folder_id, binder_id)
);

create index binders_owner_id_idx on public.binders(owner_id);
create index binders_published_idx on public.binders(status) where status = 'published';
create index binder_lessons_binder_order_idx on public.binder_lessons(binder_id, order_index);
create index learner_notes_owner_binder_idx on public.learner_notes(owner_id, binder_id);
create index comments_lesson_idx on public.comments(lesson_id, created_at desc);
create index highlights_lesson_idx on public.highlights(lesson_id, created_at desc);
create index highlights_lesson_offsets_idx on public.highlights(lesson_id, start_offset, end_offset);
create index enrollments_user_binder_idx on public.enrollments(user_id, binder_id);
create index workspace_preferences_user_binder_idx on public.workspace_preferences(user_id, binder_id);
create index folder_binders_owner_folder_idx on public.folder_binders(owner_id, folder_id);
create index folder_binders_owner_binder_idx on public.folder_binders(owner_id, binder_id);

create or replace function public.owns_published_or_enrolled(target_binder_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.binders
    where id::text = target_binder_id::text and status = 'published'
  )
  or exists (
    select 1 from public.enrollments
    where user_id = auth.uid() and binder_id::text = target_binder_id::text
  )
  or public.is_admin();
$$;

create or replace function public.owns_published_or_enrolled(target_binder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.owns_published_or_enrolled(target_binder_id::text);
$$;

alter table public.binders enable row level security;
alter table public.binder_lessons enable row level security;
alter table public.folders enable row level security;
alter table public.enrollments enable row level security;
alter table public.learner_notes enable row level security;
alter table public.comments enable row level security;
alter table public.highlights enable row level security;
alter table public.purchases enable row level security;
alter table public.concept_nodes enable row level security;
alter table public.concept_edges enable row level security;
alter table public.workspace_preferences enable row level security;
alter table public.folder_binders enable row level security;

create policy "binders read published or admin" on public.binders
  for select using (status = 'published' or owner_id = auth.uid() or public.is_admin());
create policy "admins create binders" on public.binders
  for insert with check (public.is_admin() and owner_id = auth.uid());
create policy "admins update own binders" on public.binders
  for update using (owner_id = auth.uid() and public.is_admin()) with check (owner_id = auth.uid() and public.is_admin());
create policy "admins delete own binders" on public.binders
  for delete using (owner_id = auth.uid() and public.is_admin());

create policy "lessons read visible binders" on public.binder_lessons
  for select using (public.owns_published_or_enrolled(binder_id));
create policy "admins write lessons" on public.binder_lessons
  for all using (
    exists (select 1 from public.binders where id = binder_id and owner_id = auth.uid() and public.is_admin())
  ) with check (
    exists (select 1 from public.binders where id = binder_id and owner_id = auth.uid() and public.is_admin())
  );

create policy "folders own" on public.folders
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "enrollments read own or admin" on public.enrollments
  for select using (user_id = auth.uid() or public.is_admin());
create policy "enrollments create own published" on public.enrollments
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.binders where id = binder_id and status = 'published')
  );

create policy "learner notes own" on public.learner_notes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "comments own" on public.comments
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "highlights own" on public.highlights
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "purchases read own or admin" on public.purchases
  for select using (user_id = auth.uid() or public.is_admin());
create policy "purchases insert own placeholder" on public.purchases
  for insert with check (user_id = auth.uid());

create policy "concept nodes read visible binder" on public.concept_nodes
  for select using (public.owns_published_or_enrolled(binder_id));
create policy "concept nodes admin write" on public.concept_nodes
  for all using (public.is_admin()) with check (public.is_admin());

create policy "concept edges read visible binder" on public.concept_edges
  for select using (public.owns_published_or_enrolled(binder_id));
create policy "concept edges admin write" on public.concept_edges
  for all using (public.is_admin()) with check (public.is_admin());

create policy "workspace preferences own" on public.workspace_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "folder binders own"
  on public.folder_binders
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
