create table if not exists public.suite_templates (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique,
  title text not null,
  subject text not null,
  description text not null default '',
  folder_title text not null,
  history_mode boolean not null default false,
  default_preset_id text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seed_versions (
  id text primary key default gen_random_uuid()::text,
  suite_template_id text not null references public.suite_templates(id) on delete cascade,
  version text not null,
  checksum text not null,
  seeded_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'current' check (status in ('pending', 'current', 'failed')),
  unique (suite_template_id, version)
);

create table if not exists public.workspace_presets (
  id text primary key default gen_random_uuid()::text,
  suite_template_id text not null references public.suite_templates(id) on delete cascade,
  preset_id text not null,
  breakpoint text not null check (breakpoint in ('desktop', 'tablet', 'mobile')),
  layout_json jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (suite_template_id, preset_id, breakpoint)
);

alter table public.binders
  add column if not exists suite_template_id text references public.suite_templates(id) on delete set null;

alter table public.highlights
  add column if not exists document_id text,
  add column if not exists source_version_id text,
  add column if not exists selected_text text,
  add column if not exists prefix_text text,
  add column if not exists suffix_text text,
  add column if not exists selector_json jsonb,
  add column if not exists status text not null default 'active',
  add column if not exists reanchor_confidence numeric(4,3),
  add column if not exists updated_at timestamptz not null default now();

alter table public.highlights
  drop constraint if exists highlights_status_check;

alter table public.highlights
  add constraint highlights_status_check
  check (status in ('active', 'needs_review', 'deleted'));

create table if not exists public.history_event_templates (
  id text primary key default gen_random_uuid()::text,
  suite_template_id text not null references public.suite_templates(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text references public.binder_lessons(id) on delete cascade,
  title text not null,
  summary text not null default '',
  significance text not null default '',
  location_label text,
  location_lat double precision,
  location_lng double precision,
  date_label text not null,
  sort_year integer not null,
  sort_month integer,
  sort_day integer,
  era text not null default 'ce' check (era in ('bce', 'ce')),
  precision text not null default 'year' check (precision in ('year', 'month', 'day', 'season', 'approximate')),
  approximate boolean not null default false,
  themes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history_source_templates (
  id text primary key default gen_random_uuid()::text,
  suite_template_id text not null references public.suite_templates(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text references public.binder_lessons(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('primary', 'secondary')),
  author text,
  date_label text not null,
  audience text,
  purpose text,
  point_of_view text,
  context_note text,
  reliability_note text,
  citation_url text,
  quote_text text,
  claim_supports text,
  claim_challenges text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history_myth_check_templates (
  id text primary key default gen_random_uuid()::text,
  suite_template_id text not null references public.suite_templates(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text references public.binder_lessons(id) on delete cascade,
  myth_text text not null,
  corrected_claim text not null,
  status text not null check (status in ('myth', 'oversimplification', 'contested', 'evidence_supported')),
  explanation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history_events (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text references public.binder_lessons(id) on delete cascade,
  template_event_id text references public.history_event_templates(id) on delete set null,
  title text not null,
  summary text not null default '',
  significance text not null default '',
  location_label text,
  location_lat double precision,
  location_lng double precision,
  date_label text not null,
  sort_year integer not null,
  sort_month integer,
  sort_day integer,
  era text not null default 'ce' check (era in ('bce', 'ce')),
  precision text not null default 'year' check (precision in ('year', 'month', 'day', 'season', 'approximate')),
  approximate boolean not null default false,
  themes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history_sources (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text references public.binder_lessons(id) on delete cascade,
  template_source_id text references public.history_source_templates(id) on delete set null,
  title text not null,
  source_type text not null check (source_type in ('primary', 'secondary')),
  author text,
  date_label text not null,
  audience text,
  purpose text,
  point_of_view text,
  context_note text,
  reliability_note text,
  citation_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history_evidence_cards (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text references public.binder_lessons(id) on delete cascade,
  source_id text references public.history_sources(id) on delete set null,
  highlight_id text references public.highlights(id) on delete set null,
  quote_text text,
  paraphrase text,
  claim_supports text,
  claim_challenges text,
  evidence_strength text not null default 'supported' check (evidence_strength in ('emerging', 'supported', 'strong')),
  source_snapshot_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history_argument_chains (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text references public.binder_lessons(id) on delete cascade,
  prompt text not null default '',
  thesis text not null default '',
  context text not null default '',
  counterargument text not null default '',
  conclusion text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history_argument_nodes (
  id text primary key default gen_random_uuid()::text,
  chain_id text not null references public.history_argument_chains(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  node_type text not null check (node_type in ('prompt', 'thesis', 'context', 'cause', 'effect', 'counterargument', 'conclusion', 'evidence')),
  title text not null default '',
  body text not null default '',
  sort_order integer not null default 0,
  event_id text references public.history_events(id) on delete set null,
  source_id text references public.history_sources(id) on delete set null,
  evidence_id text references public.history_evidence_cards(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history_argument_edges (
  id text primary key default gen_random_uuid()::text,
  chain_id text not null references public.history_argument_chains(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  from_node_id text not null references public.history_argument_nodes(id) on delete cascade,
  to_node_id text not null references public.history_argument_nodes(id) on delete cascade,
  relation_type text not null check (relation_type in ('caused', 'triggered', 'contributed_to', 'responded_to', 'contradicted', 'supported', 'weakened', 'strengthened', 'continued', 'changed')),
  strength integer not null default 3 check (strength between 1 and 5),
  explanation text not null default '',
  source_id text references public.history_sources(id) on delete set null,
  evidence_id text references public.history_evidence_cards(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history_myth_checks (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  lesson_id text references public.binder_lessons(id) on delete cascade,
  template_myth_check_id text references public.history_myth_check_templates(id) on delete set null,
  myth_text text not null,
  corrected_claim text not null,
  status text not null check (status in ('myth', 'oversimplification', 'contested', 'evidence_supported')),
  explanation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists binders_suite_template_id_idx on public.binders(suite_template_id);
create index if not exists workspace_presets_suite_breakpoint_idx on public.workspace_presets(suite_template_id, breakpoint);
create index if not exists seed_versions_suite_status_idx on public.seed_versions(suite_template_id, status);
create index if not exists highlights_owner_scope_idx on public.highlights(owner_id, binder_id, lesson_id, status);
create index if not exists highlights_selector_status_idx on public.highlights(lesson_id, status, start_offset, end_offset);
create index if not exists history_event_templates_binder_idx on public.history_event_templates(binder_id, sort_year, sort_month, sort_day);
create index if not exists history_source_templates_binder_idx on public.history_source_templates(binder_id, lesson_id);
create index if not exists history_myth_check_templates_binder_idx on public.history_myth_check_templates(binder_id, lesson_id);
create index if not exists history_events_owner_binder_idx on public.history_events(owner_id, binder_id, sort_year, sort_month, sort_day);
create index if not exists history_sources_owner_binder_idx on public.history_sources(owner_id, binder_id);
create index if not exists history_evidence_owner_binder_idx on public.history_evidence_cards(owner_id, binder_id);
create index if not exists history_argument_chains_owner_binder_idx on public.history_argument_chains(owner_id, binder_id);
create index if not exists history_argument_nodes_chain_idx on public.history_argument_nodes(chain_id, sort_order);
create index if not exists history_argument_edges_chain_idx on public.history_argument_edges(chain_id);
create index if not exists history_myth_checks_owner_binder_idx on public.history_myth_checks(owner_id, binder_id);

create or replace function public.can_read_suite_template(target_suite_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.suite_templates
    where id = target_suite_id
      and (status = 'published' or public.is_admin())
  );
$$;

alter table public.suite_templates enable row level security;
alter table public.seed_versions enable row level security;
alter table public.workspace_presets enable row level security;
alter table public.history_event_templates enable row level security;
alter table public.history_source_templates enable row level security;
alter table public.history_myth_check_templates enable row level security;
alter table public.history_events enable row level security;
alter table public.history_sources enable row level security;
alter table public.history_evidence_cards enable row level security;
alter table public.history_argument_chains enable row level security;
alter table public.history_argument_nodes enable row level security;
alter table public.history_argument_edges enable row level security;
alter table public.history_myth_checks enable row level security;

create policy "suite templates readable when published"
  on public.suite_templates
  for select
  using (status = 'published' or public.is_admin());

create policy "suite templates admin write"
  on public.suite_templates
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "seed versions admin only"
  on public.seed_versions
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "workspace presets readable when suite published"
  on public.workspace_presets
  for select
  using (public.can_read_suite_template(suite_template_id));

create policy "workspace presets admin write"
  on public.workspace_presets
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "history event templates readable with visible binder"
  on public.history_event_templates
  for select
  using (public.owns_published_or_enrolled(binder_id));

create policy "history event templates admin write"
  on public.history_event_templates
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "history source templates readable with visible binder"
  on public.history_source_templates
  for select
  using (public.owns_published_or_enrolled(binder_id));

create policy "history source templates admin write"
  on public.history_source_templates
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "history myth templates readable with visible binder"
  on public.history_myth_check_templates
  for select
  using (public.owns_published_or_enrolled(binder_id));

create policy "history myth templates admin write"
  on public.history_myth_check_templates
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "history events own"
  on public.history_events
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "history sources own"
  on public.history_sources
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "history evidence cards own"
  on public.history_evidence_cards
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "history argument chains own"
  on public.history_argument_chains
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "history argument nodes own"
  on public.history_argument_nodes
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "history argument edges own"
  on public.history_argument_edges
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "history myth checks own"
  on public.history_myth_checks
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
