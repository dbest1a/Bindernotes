create table if not exists public.math_courses (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique,
  title text not null,
  description text,
  order_index integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.math_topics (
  id text primary key default gen_random_uuid()::text,
  course_id text not null references public.math_courses(id) on delete cascade,
  parent_topic_id text references public.math_topics(id) on delete set null,
  slug text not null,
  title text not null,
  description text,
  order_index integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);

create table if not exists public.math_modules (
  id text primary key default gen_random_uuid()::text,
  course_id text not null references public.math_courses(id) on delete cascade,
  topic_id text references public.math_topics(id) on delete set null,
  slug text not null unique,
  title text not null,
  description text,
  difficulty text not null default 'foundational' check (difficulty in ('foundational', 'intermediate', 'advanced', 'applied')),
  calculator_mode text not null default 'none' check (calculator_mode in ('none', '2d', '3d')),
  module_json jsonb not null default '{}'::jsonb,
  visibility text not null default 'draft' check (visibility in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.math_graph_states (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references public.profiles(id) on delete cascade,
  module_id text references public.math_modules(id) on delete set null,
  note_id text references public.learner_notes(id) on delete set null,
  calculator_mode text not null check (calculator_mode in ('2d', '3d')),
  title text not null,
  desmos_state jsonb not null,
  expressions jsonb,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_bank (
  id text primary key default gen_random_uuid()::text,
  course_id text references public.math_courses(id) on delete set null,
  topic_id text references public.math_topics(id) on delete set null,
  module_id text references public.math_modules(id) on delete set null,
  note_id text references public.learner_notes(id) on delete set null,
  graph_state_id text references public.math_graph_states(id) on delete set null,
  type text not null check (
    type in (
      'multiple_choice',
      'multiple_select',
      'true_false',
      'short_answer',
      'numeric',
      'free_response',
      'fill_blank',
      'matching',
      'step_ordering'
    )
  ),
  title text,
  prompt_markdown text not null,
  prompt_latex text,
  answer_json jsonb not null default '{}'::jsonb,
  explanation_markdown text,
  explanation_latex text,
  difficulty text not null default 'foundational' check (difficulty in ('foundational', 'intermediate', 'advanced', 'applied')),
  calculator_allowed boolean not null default false,
  estimated_time_seconds integer,
  source_type text not null default 'manual' check (source_type in ('manual', 'imported', 'module_seed')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.math_graph_states
  add column if not exists question_id text references public.question_bank(id) on delete set null;

create table if not exists public.question_choices (
  id text primary key default gen_random_uuid()::text,
  question_id text not null references public.question_bank(id) on delete cascade,
  choice_text text not null,
  choice_latex text,
  is_correct boolean not null default false,
  order_index integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_sets (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references public.profiles(id) on delete cascade,
  course_id text references public.math_courses(id) on delete set null,
  topic_id text references public.math_topics(id) on delete set null,
  module_id text references public.math_modules(id) on delete set null,
  title text not null,
  description text,
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_set_questions (
  id text primary key default gen_random_uuid()::text,
  quiz_set_id text not null references public.quiz_sets(id) on delete cascade,
  question_id text not null references public.question_bank(id) on delete cascade,
  order_index integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_set_id, question_id)
);

create table if not exists public.quiz_attempts (
  id text primary key default gen_random_uuid()::text,
  quiz_set_id text not null references public.quiz_sets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score numeric,
  total_points numeric,
  metadata_json jsonb
);

create table if not exists public.question_attempts (
  id text primary key default gen_random_uuid()::text,
  quiz_attempt_id text not null references public.quiz_attempts(id) on delete cascade,
  question_id text not null references public.question_bank(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  submitted_answer_json jsonb not null default '{}'::jsonb,
  is_correct boolean,
  points_awarded numeric,
  feedback_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists math_topics_course_order_idx on public.math_topics(course_id, order_index);
create index if not exists math_modules_course_topic_idx on public.math_modules(course_id, topic_id) where visibility = 'published';
create index if not exists math_graph_states_user_module_idx on public.math_graph_states(user_id, module_id, updated_at desc);
create index if not exists question_bank_course_topic_idx on public.question_bank(course_id, topic_id, status);
create index if not exists question_bank_module_idx on public.question_bank(module_id, status);
create index if not exists question_bank_note_idx on public.question_bank(note_id, status);
create index if not exists question_choices_question_order_idx on public.question_choices(question_id, order_index);
create index if not exists quiz_sets_user_idx on public.quiz_sets(user_id, updated_at desc);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts(user_id, started_at desc);
create index if not exists question_attempts_attempt_idx on public.question_attempts(quiz_attempt_id, created_at);

alter table public.math_courses enable row level security;
alter table public.math_topics enable row level security;
alter table public.math_modules enable row level security;
alter table public.math_graph_states enable row level security;
alter table public.question_bank enable row level security;
alter table public.question_choices enable row level security;
alter table public.quiz_sets enable row level security;
alter table public.quiz_set_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.question_attempts enable row level security;

do $$ begin
  create policy "math courses readable" on public.math_courses
    for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "admins write math courses" on public.math_courses
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "math topics readable" on public.math_topics
    for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "admins write math topics" on public.math_topics
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "published math modules readable" on public.math_modules
    for select using (visibility = 'published' or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "admins write math modules" on public.math_modules
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "graph states readable by owner or public template" on public.math_graph_states
    for select using (
      user_id = auth.uid()
      or user_id is null
      or public.is_admin()
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "graph states insert own" on public.math_graph_states
    for insert with check (user_id = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "graph states update own" on public.math_graph_states
    for update using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "graph states delete own" on public.math_graph_states
    for delete using (user_id = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "questions readable when published or owned" on public.question_bank
    for select using (
      status = 'published'
      or created_by = auth.uid()
      or public.is_admin()
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "questions insert own" on public.question_bank
    for insert with check (created_by = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "questions update own" on public.question_bank
    for update using (created_by = auth.uid() or public.is_admin())
    with check (created_by = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "questions delete own" on public.question_bank
    for delete using (created_by = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "choices readable through visible question" on public.question_choices
    for select using (
      exists (
        select 1 from public.question_bank q
        where q.id = question_id
          and (q.status = 'published' or q.created_by = auth.uid() or public.is_admin())
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "choices write through owned question" on public.question_choices
    for all using (
      exists (
        select 1 from public.question_bank q
        where q.id = question_id
          and (q.created_by = auth.uid() or public.is_admin())
      )
    ) with check (
      exists (
        select 1 from public.question_bank q
        where q.id = question_id
          and (q.created_by = auth.uid() or public.is_admin())
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "quiz sets read own" on public.quiz_sets
    for select using (user_id = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "quiz sets write own" on public.quiz_sets
    for all using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "quiz set questions read own quiz" on public.quiz_set_questions
    for select using (
      exists (
        select 1 from public.quiz_sets qs
        where qs.id = quiz_set_id and (qs.user_id = auth.uid() or public.is_admin())
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "quiz set questions write own quiz" on public.quiz_set_questions
    for all using (
      exists (
        select 1 from public.quiz_sets qs
        where qs.id = quiz_set_id and (qs.user_id = auth.uid() or public.is_admin())
      )
    ) with check (
      exists (
        select 1 from public.quiz_sets qs
        where qs.id = quiz_set_id and (qs.user_id = auth.uid() or public.is_admin())
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "quiz attempts read own" on public.quiz_attempts
    for select using (user_id = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "quiz attempts write own" on public.quiz_attempts
    for all using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "question attempts read own" on public.question_attempts
    for select using (user_id = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "question attempts write own" on public.question_attempts
    for all using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());
exception when duplicate_object then null;
end $$;
