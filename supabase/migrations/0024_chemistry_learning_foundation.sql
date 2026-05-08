-- BinderNotes P0 chemistry learning foundation.
--
-- Additive only:
-- - no existing Supabase data is deleted, truncated, reseeded, or migrated
-- - chemistry attempts and lab runs store compact summaries/checkpoints only
-- - canonical templates are public-readable when published and admin-managed

create table if not exists public.chem_concepts (
  id text primary key,
  slug text not null unique,
  title text not null,
  description text not null default '',
  parent_id text references public.chem_concepts(id) on delete set null,
  status text not null default 'published',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chem_concepts_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.chem_problem_templates (
  id text primary key,
  concept_id text references public.chem_concepts(id) on delete set null,
  title text not null,
  prompt text not null default '',
  equation text not null default '',
  given jsonb not null default '{}'::jsonb,
  target jsonb not null default '{}'::jsonb,
  concept_tags text[] not null default '{}'::text[],
  expected_answer jsonb not null default '{}'::jsonb,
  status text not null default 'published',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chem_problem_templates_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.user_chem_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text references public.binders(id) on delete set null,
  lesson_id text references public.binder_lessons(id) on delete set null,
  concept_id text references public.chem_concepts(id) on delete set null,
  problem_template_id text references public.chem_problem_templates(id) on delete set null,
  final_answer jsonb not null default '{}'::jsonb,
  step_summaries jsonb not null default '[]'::jsonb,
  mistake_tags text[] not null default '{}'::text[],
  concept_tags text[] not null default '{}'::text[],
  score numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_chem_attempts_score_check check (score is null or (score >= 0 and score <= 1))
);

create table if not exists public.user_chem_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  concept_id text not null references public.chem_concepts(id) on delete cascade,
  mastery_score numeric not null default 0,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint user_chem_mastery_unique_user_concept unique (user_id, concept_id),
  constraint user_chem_mastery_score_check check (mastery_score >= 0 and mastery_score <= 1),
  constraint user_chem_mastery_attempt_count_check check (attempt_count >= 0)
);

create table if not exists public.chem_lab_templates (
  id text primary key,
  concept_id text references public.chem_concepts(id) on delete set null,
  title text not null,
  objective text not null default '',
  safety_notes text[] not null default '{}'::text[],
  reagents jsonb not null default '[]'::jsonb,
  simulation_kind text not null default 'acid_base_titration',
  default_state jsonb not null default '{}'::jsonb,
  status text not null default 'published',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chem_lab_templates_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.user_lab_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  binder_id text references public.binders(id) on delete set null,
  lesson_id text references public.binder_lessons(id) on delete set null,
  lab_template_id text references public.chem_lab_templates(id) on delete set null,
  status text not null default 'checkpoint',
  checkpoint jsonb not null default '{}'::jsonb,
  measurement_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_lab_runs_status_check check (status in ('checkpoint', 'submitted', 'reviewed'))
);

create table if not exists public.user_lab_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lab_run_id uuid references public.user_lab_runs(id) on delete cascade,
  lab_template_id text references public.chem_lab_templates(id) on delete set null,
  binder_id text references public.binders(id) on delete set null,
  lesson_id text references public.binder_lessons(id) on delete set null,
  hypothesis text not null default '',
  procedure text not null default '',
  data_table jsonb not null default '[]'::jsonb,
  calculations text not null default '',
  observations text not null default '',
  error_analysis text not null default '',
  conclusion text not null default '',
  teacher_notes text,
  student_notes text,
  final_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chem_concepts_parent_idx on public.chem_concepts(parent_id) where parent_id is not null;
create index if not exists chem_concepts_status_idx on public.chem_concepts(status, slug);
create index if not exists chem_problem_templates_concept_idx on public.chem_problem_templates(concept_id) where concept_id is not null;
create index if not exists chem_problem_templates_status_idx on public.chem_problem_templates(status, concept_id);
create index if not exists chem_lab_templates_concept_idx on public.chem_lab_templates(concept_id) where concept_id is not null;
create index if not exists chem_lab_templates_status_idx on public.chem_lab_templates(status, concept_id);

create index if not exists user_chem_attempts_user_created_idx
  on public.user_chem_attempts(user_id, created_at desc);
create index if not exists user_chem_attempts_user_concept_idx
  on public.user_chem_attempts(user_id, concept_id);
create index if not exists user_chem_attempts_user_template_idx
  on public.user_chem_attempts(user_id, problem_template_id, created_at desc);
create index if not exists user_chem_mastery_user_concept_idx
  on public.user_chem_mastery(user_id, concept_id);
create index if not exists user_lab_runs_user_updated_idx
  on public.user_lab_runs(user_id, updated_at desc);
create index if not exists user_lab_reports_user_updated_idx
  on public.user_lab_reports(user_id, updated_at desc);
create index if not exists user_lab_reports_run_idx
  on public.user_lab_reports(lab_run_id) where lab_run_id is not null;

create or replace function public.set_chemistry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_chem_concepts_updated_at on public.chem_concepts;
create trigger set_chem_concepts_updated_at
  before update on public.chem_concepts
  for each row execute function public.set_chemistry_updated_at();

drop trigger if exists set_chem_problem_templates_updated_at on public.chem_problem_templates;
create trigger set_chem_problem_templates_updated_at
  before update on public.chem_problem_templates
  for each row execute function public.set_chemistry_updated_at();

drop trigger if exists set_user_chem_mastery_updated_at on public.user_chem_mastery;
create trigger set_user_chem_mastery_updated_at
  before update on public.user_chem_mastery
  for each row execute function public.set_chemistry_updated_at();

drop trigger if exists set_chem_lab_templates_updated_at on public.chem_lab_templates;
create trigger set_chem_lab_templates_updated_at
  before update on public.chem_lab_templates
  for each row execute function public.set_chemistry_updated_at();

drop trigger if exists set_user_lab_runs_updated_at on public.user_lab_runs;
create trigger set_user_lab_runs_updated_at
  before update on public.user_lab_runs
  for each row execute function public.set_chemistry_updated_at();

drop trigger if exists set_user_lab_reports_updated_at on public.user_lab_reports;
create trigger set_user_lab_reports_updated_at
  before update on public.user_lab_reports
  for each row execute function public.set_chemistry_updated_at();

alter table public.chem_concepts enable row level security;
alter table public.chem_problem_templates enable row level security;
alter table public.user_chem_attempts enable row level security;
alter table public.user_chem_mastery enable row level security;
alter table public.chem_lab_templates enable row level security;
alter table public.user_lab_runs enable row level security;
alter table public.user_lab_reports enable row level security;

drop policy if exists "chem concepts read published" on public.chem_concepts;
drop policy if exists "chem concepts admin manage" on public.chem_concepts;
drop policy if exists "chem problem templates read published" on public.chem_problem_templates;
drop policy if exists "chem problem templates admin manage" on public.chem_problem_templates;
drop policy if exists "chem lab templates read published" on public.chem_lab_templates;
drop policy if exists "chem lab templates admin manage" on public.chem_lab_templates;

create policy "chem concepts read published" on public.chem_concepts
  for select to authenticated using (status = 'published' or public.is_admin());
create policy "chem concepts admin manage" on public.chem_concepts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "chem problem templates read published" on public.chem_problem_templates
  for select to authenticated using (status = 'published' or public.is_admin());
create policy "chem problem templates admin manage" on public.chem_problem_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "chem lab templates read published" on public.chem_lab_templates
  for select to authenticated using (status = 'published' or public.is_admin());
create policy "chem lab templates admin manage" on public.chem_lab_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "user chem attempts select own" on public.user_chem_attempts;
drop policy if exists "user chem attempts insert own" on public.user_chem_attempts;
drop policy if exists "user chem attempts update own" on public.user_chem_attempts;
drop policy if exists "user chem attempts delete own" on public.user_chem_attempts;
drop policy if exists "user chem mastery select own" on public.user_chem_mastery;
drop policy if exists "user chem mastery insert own" on public.user_chem_mastery;
drop policy if exists "user chem mastery update own" on public.user_chem_mastery;
drop policy if exists "user chem mastery delete own" on public.user_chem_mastery;
drop policy if exists "user lab runs select own" on public.user_lab_runs;
drop policy if exists "user lab runs insert own" on public.user_lab_runs;
drop policy if exists "user lab runs update own" on public.user_lab_runs;
drop policy if exists "user lab runs delete own" on public.user_lab_runs;
drop policy if exists "user lab reports select own" on public.user_lab_reports;
drop policy if exists "user lab reports insert own" on public.user_lab_reports;
drop policy if exists "user lab reports update own" on public.user_lab_reports;
drop policy if exists "user lab reports delete own" on public.user_lab_reports;

create policy "user chem attempts select own" on public.user_chem_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user chem attempts insert own" on public.user_chem_attempts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user chem attempts update own" on public.user_chem_attempts
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user chem attempts delete own" on public.user_chem_attempts
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "user chem mastery select own" on public.user_chem_mastery
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user chem mastery insert own" on public.user_chem_mastery
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user chem mastery update own" on public.user_chem_mastery
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user chem mastery delete own" on public.user_chem_mastery
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "user lab runs select own" on public.user_lab_runs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user lab runs insert own" on public.user_lab_runs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user lab runs update own" on public.user_lab_runs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user lab runs delete own" on public.user_lab_runs
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "user lab reports select own" on public.user_lab_reports
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user lab reports insert own" on public.user_lab_reports
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user lab reports update own" on public.user_lab_reports
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user lab reports delete own" on public.user_lab_reports
  for delete to authenticated using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
