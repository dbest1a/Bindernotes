create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin', 'learner');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.publish_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.purchase_status as enum ('pending', 'paid', 'refunded', 'comped');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role public.app_role not null default 'learner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.binders (
  id uuid primary key default gen_random_uuid(),
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

create table if not exists public.binder_lessons (
  id uuid primary key default gen_random_uuid(),
  binder_id uuid not null references public.binders(id) on delete cascade,
  title text not null,
  order_index integer not null default 1,
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  math_blocks jsonb not null default '[]'::jsonb,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default 'teal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  binder_id uuid not null references public.binders(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, binder_id)
);

create table if not exists public.learner_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id uuid not null references public.binders(id) on delete cascade,
  lesson_id uuid not null references public.binder_lessons(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null default 'Private lesson notes',
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  math_blocks jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, lesson_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id uuid not null references public.binders(id) on delete cascade,
  lesson_id uuid not null references public.binder_lessons(id) on delete cascade,
  anchor_text text,
  body text not null,
  parent_id uuid references public.comments(id) on delete cascade,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id uuid not null references public.binders(id) on delete cascade,
  lesson_id uuid not null references public.binder_lessons(id) on delete cascade,
  anchor_text text not null,
  color text not null default 'yellow' check (color in ('yellow', 'green', 'pink')),
  note_id uuid references public.learner_notes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  binder_id uuid references public.binders(id) on delete set null,
  stripe_checkout_session_id text,
  stripe_customer_id text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  status public.purchase_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.concept_nodes (
  id uuid primary key default gen_random_uuid(),
  binder_id uuid not null references public.binders(id) on delete cascade,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.concept_edges (
  id uuid primary key default gen_random_uuid(),
  binder_id uuid not null references public.binders(id) on delete cascade,
  source_id uuid not null references public.concept_nodes(id) on delete cascade,
  target_id uuid not null references public.concept_nodes(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  binder_id uuid not null references public.binders(id) on delete cascade,
  preferences jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, binder_id)
);

create index if not exists binders_owner_id_idx on public.binders(owner_id);
create index if not exists binders_published_idx on public.binders(status) where status = 'published';
create index if not exists binder_lessons_binder_order_idx on public.binder_lessons(binder_id, order_index);
create index if not exists learner_notes_owner_binder_idx on public.learner_notes(owner_id, binder_id);
create index if not exists comments_lesson_idx on public.comments(lesson_id, created_at desc);
create index if not exists highlights_lesson_idx on public.highlights(lesson_id, created_at desc);
create index if not exists enrollments_user_binder_idx on public.enrollments(user_id, binder_id);
create index if not exists workspace_preferences_user_binder_idx on public.workspace_preferences(user_id, binder_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.owns_published_or_enrolled(target_binder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.binders
    where id = target_binder_id and status = 'published'
  )
  or exists (
    select 1 from public.enrollments
    where user_id = auth.uid() and binder_id = target_binder_id
  )
  or public.is_admin();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    'learner'
  )
  on conflict (id) do nothing;

  insert into public.folders (owner_id, name, color)
  values (new.id, 'Course notes', 'teal'), (new.id, 'Problem sets', 'violet')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
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

create policy "profiles read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

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

create policy "comments read visible binder" on public.comments
  for select using (public.owns_published_or_enrolled(binder_id));
create policy "comments create own visible binder" on public.comments
  for insert with check (owner_id = auth.uid() and public.owns_published_or_enrolled(binder_id));
create policy "comments update own" on public.comments
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "comments delete own or admin" on public.comments
  for delete using (owner_id = auth.uid() or public.is_admin());

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
