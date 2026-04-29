-- BinderNotes backend performance layer.
--
-- Tools used in this migration:
-- - Data API: summary tables are regular Postgres tables exposed through Supabase.
-- - Queues: pgmq stores background summary refresh jobs.
-- - Cron: pg_cron processes queued work and periodically repairs summaries.
-- - Database Webhooks: database-change triggers enqueue work when source rows change.
-- - Vault: intentionally unused here because this pass does not need server-side secrets.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pgmq with schema extensions;

create table if not exists public.dashboard_folder_summaries (
  folder_id text primary key references public.folders(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  folder_name text not null,
  folder_color text not null default '#38bdf8',
  binder_count integer not null default 0,
  document_count integer not null default 0,
  note_count integer not null default 0,
  updated_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

create table if not exists public.dashboard_binder_summaries (
  binder_id text primary key references public.binders(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  folder_id text references public.folders(id) on delete set null,
  title text not null,
  subject text not null default '',
  description_excerpt text not null default '',
  status public.publish_status not null,
  cover_url text,
  document_count integer not null default 0,
  note_count integer not null default 0,
  last_document_title text,
  updated_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

create table if not exists public.dashboard_lesson_summaries (
  lesson_id text primary key references public.binder_lessons(id) on delete cascade,
  binder_id text not null references public.binders(id) on delete cascade,
  title text not null,
  order_index integer not null default 0,
  is_preview boolean not null default false,
  plain_text_excerpt text not null default '',
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

create table if not exists public.admin_binder_summaries (
  binder_id text primary key references public.binders(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject text not null default '',
  status public.publish_status not null,
  document_count integer not null default 0,
  preview_document_count integer not null default 0,
  empty_document_count integer not null default 0,
  total_word_count integer not null default 0,
  last_updated_at timestamptz not null default now(),
  content_health_status text not null default 'empty' check (content_health_status in ('empty', 'needs_review', 'ready')),
  refreshed_at timestamptz not null default now()
);

create table if not exists public.tutorial_video_summaries (
  video_id text primary key references public.tutorial_entries(id) on delete cascade,
  title text not null,
  description_excerpt text not null default '',
  thumbnail_url text not null default '/tutorials/posters/bindernotes-tutorial-poster.svg',
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  updated_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

create table if not exists public.summary_refresh_job_dedupe (
  dedupe_key text primary key,
  job_type text not null,
  entity_type text not null,
  entity_id text,
  owner_id uuid,
  payload jsonb not null default '{}'::jsonb,
  priority integer not null default 50,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists binders_owner_updated_idx on public.binders (owner_id, updated_at desc);
create index if not exists binders_status_updated_idx on public.binders (status, updated_at desc);
create index if not exists binder_lessons_updated_idx on public.binder_lessons (updated_at desc);
create index if not exists learner_notes_owner_lesson_idx on public.learner_notes (owner_id, lesson_id);
create index if not exists learner_notes_lesson_idx on public.learner_notes (lesson_id);
create index if not exists folders_owner_updated_idx on public.folders (owner_id, updated_at desc);
create index if not exists folder_binders_folder_binder_idx on public.folder_binders (folder_id, binder_id);
create index if not exists dashboard_binder_summaries_owner_updated_idx
  on public.dashboard_binder_summaries (owner_id, updated_at desc);
create index if not exists dashboard_binder_summaries_status_updated_idx
  on public.dashboard_binder_summaries (status, updated_at desc);
create index if not exists dashboard_lesson_summaries_binder_order_idx
  on public.dashboard_lesson_summaries (binder_id, order_index);
create index if not exists admin_binder_summaries_status_updated_idx
  on public.admin_binder_summaries (status, last_updated_at desc);
create index if not exists tutorial_entries_status_updated_idx
  on public.tutorial_entries (status, updated_at desc);
create index if not exists tutorial_video_summaries_status_updated_idx
  on public.tutorial_video_summaries (status, updated_at desc);
create index if not exists summary_refresh_job_dedupe_status_priority_idx
  on public.summary_refresh_job_dedupe (status, priority, updated_at);

alter table public.dashboard_folder_summaries enable row level security;
alter table public.dashboard_binder_summaries enable row level security;
alter table public.dashboard_lesson_summaries enable row level security;
alter table public.admin_binder_summaries enable row level security;
alter table public.tutorial_video_summaries enable row level security;
alter table public.summary_refresh_job_dedupe enable row level security;

drop policy if exists "dashboard folder summaries owner read" on public.dashboard_folder_summaries;
create policy "dashboard folder summaries owner read" on public.dashboard_folder_summaries
  for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "dashboard binder summaries visible read" on public.dashboard_binder_summaries;
create policy "dashboard binder summaries visible read" on public.dashboard_binder_summaries
  for select using (
    status = 'published'
    or owner_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "dashboard lesson summaries visible read" on public.dashboard_lesson_summaries;
create policy "dashboard lesson summaries visible read" on public.dashboard_lesson_summaries
  for select using (public.owns_published_or_enrolled(binder_id));

drop policy if exists "admin binder summaries admin read" on public.admin_binder_summaries;
create policy "admin binder summaries admin read" on public.admin_binder_summaries
  for select using (public.is_admin());

drop policy if exists "tutorial video summaries read published or admin" on public.tutorial_video_summaries;
create policy "tutorial video summaries read published or admin" on public.tutorial_video_summaries
  for select using (status = 'published' or public.is_admin());

drop policy if exists "summary refresh job dedupe admin read" on public.summary_refresh_job_dedupe;
create policy "summary refresh job dedupe admin read" on public.summary_refresh_job_dedupe
  for select using (public.is_admin());

create or replace function public.bn_jsonb_plain_text(value jsonb)
returns text
language plpgsql
immutable
as $$
declare
  item jsonb;
  pair record;
  result text := '';
begin
  if value is null then
    return '';
  end if;

  case jsonb_typeof(value)
    when 'string' then
      return coalesce(value #>> '{}', '');
    when 'number' then
      return value::text;
    when 'boolean' then
      return value::text;
    when 'array' then
      for item in select jsonb_array_elements(value)
      loop
        result := trim(result || ' ' || public.bn_jsonb_plain_text(item));
      end loop;
      return result;
    when 'object' then
      if value ? 'text' then
        result := trim(result || ' ' || coalesce(value ->> 'text', ''));
      end if;
      if value ? 'content' then
        result := trim(result || ' ' || public.bn_jsonb_plain_text(value -> 'content'));
      end if;
      for pair in select key, val from jsonb_each(value) as entry(key, val)
      loop
        if pair.key not in ('text', 'content') then
          result := trim(result || ' ' || public.bn_jsonb_plain_text(pair.val));
        end if;
      end loop;
      return result;
    else
      return '';
  end case;
end;
$$;

create or replace function public.bn_word_count(input text)
returns integer
language sql
immutable
as $$
  select case
    when nullif(trim(coalesce(input, '')), '') is null then 0
    else cardinality(regexp_split_to_array(trim(input), '\s+'))
  end;
$$;

create or replace function public.refresh_lesson_search_excerpt(target_lesson_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_lesson_id is null then
    return;
  end if;

  if not exists (select 1 from public.binder_lessons where id = target_lesson_id) then
    delete from public.dashboard_lesson_summaries where lesson_id = target_lesson_id;
    return;
  end if;

  with source_lesson as (
    select
      lesson.id,
      lesson.binder_id,
      lesson.title,
      lesson.order_index,
      lesson.is_preview,
      lesson.created_at,
      lesson.updated_at,
      public.bn_jsonb_plain_text(lesson.content) as plain_text
    from public.binder_lessons lesson
    where lesson.id = target_lesson_id
  )
  insert into public.dashboard_lesson_summaries (
    lesson_id,
    binder_id,
    title,
    order_index,
    is_preview,
    plain_text_excerpt,
    word_count,
    created_at,
    updated_at,
    refreshed_at
  )
  select
    id,
    binder_id,
    title,
    order_index,
    is_preview,
    left(regexp_replace(coalesce(plain_text, ''), '\s+', ' ', 'g'), 360),
    public.bn_word_count(plain_text),
    created_at,
    updated_at,
    now()
  from source_lesson
  on conflict (lesson_id) do update set
    binder_id = excluded.binder_id,
    title = excluded.title,
    order_index = excluded.order_index,
    is_preview = excluded.is_preview,
    plain_text_excerpt = excluded.plain_text_excerpt,
    word_count = excluded.word_count,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    refreshed_at = now();
end;
$$;

create or replace function public.refresh_dashboard_binder_summary(target_binder_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_binder_id is null then
    return;
  end if;

  if not exists (select 1 from public.binders where id = target_binder_id) then
    delete from public.dashboard_binder_summaries where binder_id = target_binder_id;
    delete from public.admin_binder_summaries where binder_id = target_binder_id;
    return;
  end if;

  insert into public.dashboard_binder_summaries (
    binder_id,
    owner_id,
    folder_id,
    title,
    subject,
    description_excerpt,
    status,
    cover_url,
    document_count,
    note_count,
    last_document_title,
    updated_at,
    refreshed_at
  )
  select
    binder.id,
    binder.owner_id,
    (
      select link.folder_id
      from public.folder_binders link
      where link.binder_id = binder.id
      order by link.updated_at desc
      limit 1
    ),
    binder.title,
    binder.subject,
    left(coalesce(binder.description, ''), 280),
    binder.status,
    binder.cover_url,
    (
      select count(*)::integer
      from public.binder_lessons lesson
      where lesson.binder_id = binder.id
    ),
    0,
    (
      select lesson.title
      from public.binder_lessons lesson
      where lesson.binder_id = binder.id
      order by lesson.updated_at desc
      limit 1
    ),
    binder.updated_at,
    now()
  from public.binders binder
  where binder.id = target_binder_id
  on conflict (binder_id) do update set
    owner_id = excluded.owner_id,
    folder_id = excluded.folder_id,
    title = excluded.title,
    subject = excluded.subject,
    description_excerpt = excluded.description_excerpt,
    status = excluded.status,
    cover_url = excluded.cover_url,
    document_count = excluded.document_count,
    note_count = excluded.note_count,
    last_document_title = excluded.last_document_title,
    updated_at = excluded.updated_at,
    refreshed_at = now();
end;
$$;

create or replace function public.refresh_dashboard_folder_summary(target_folder_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_folder_id is null then
    return;
  end if;

  if not exists (select 1 from public.folders where id = target_folder_id) then
    delete from public.dashboard_folder_summaries where folder_id = target_folder_id;
    return;
  end if;

  insert into public.dashboard_folder_summaries (
    folder_id,
    owner_id,
    folder_name,
    folder_color,
    binder_count,
    document_count,
    note_count,
    updated_at,
    refreshed_at
  )
  select
    folder.id,
    folder.owner_id,
    folder.name,
    folder.color,
    count(distinct link.binder_id)::integer,
    count(distinct lesson.id)::integer,
    count(distinct note.id)::integer,
    folder.updated_at,
    now()
  from public.folders folder
  left join public.folder_binders link on link.folder_id = folder.id
  left join public.binder_lessons lesson on lesson.binder_id = link.binder_id
  left join public.learner_notes note on note.folder_id = folder.id and note.owner_id = folder.owner_id
  where folder.id = target_folder_id
  group by folder.id
  on conflict (folder_id) do update set
    owner_id = excluded.owner_id,
    folder_name = excluded.folder_name,
    folder_color = excluded.folder_color,
    binder_count = excluded.binder_count,
    document_count = excluded.document_count,
    note_count = excluded.note_count,
    updated_at = excluded.updated_at,
    refreshed_at = now();
end;
$$;

create or replace function public.refresh_admin_binder_summary(target_binder_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_documents integer := 0;
  empty_documents integer := 0;
  total_words integer := 0;
  preview_documents integer := 0;
  health text := 'empty';
begin
  if target_binder_id is null then
    return;
  end if;

  if not exists (select 1 from public.binders where id = target_binder_id) then
    delete from public.admin_binder_summaries where binder_id = target_binder_id;
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where lesson.is_preview)::integer,
    count(*) filter (where coalesce(summary.word_count, 0) = 0)::integer,
    coalesce(sum(coalesce(summary.word_count, 0)), 0)::integer
  into total_documents, preview_documents, empty_documents, total_words
  from public.binder_lessons lesson
  left join public.dashboard_lesson_summaries summary on summary.lesson_id = lesson.id
  where lesson.binder_id = target_binder_id;

  if total_documents = 0 or total_words = 0 then
    health := 'empty';
  elsif empty_documents > 0 or preview_documents = 0 then
    health := 'needs_review';
  else
    health := 'ready';
  end if;

  insert into public.admin_binder_summaries (
    binder_id,
    owner_id,
    title,
    subject,
    status,
    document_count,
    preview_document_count,
    empty_document_count,
    total_word_count,
    last_updated_at,
    content_health_status,
    refreshed_at
  )
  select
    binder.id,
    binder.owner_id,
    binder.title,
    binder.subject,
    binder.status,
    total_documents,
    preview_documents,
    empty_documents,
    total_words,
    binder.updated_at,
    health,
    now()
  from public.binders binder
  where binder.id = target_binder_id
  on conflict (binder_id) do update set
    owner_id = excluded.owner_id,
    title = excluded.title,
    subject = excluded.subject,
    status = excluded.status,
    document_count = excluded.document_count,
    preview_document_count = excluded.preview_document_count,
    empty_document_count = excluded.empty_document_count,
    total_word_count = excluded.total_word_count,
    last_updated_at = excluded.last_updated_at,
    content_health_status = excluded.content_health_status,
    refreshed_at = now();
end;
$$;

create or replace function public.refresh_tutorial_video_summary(target_video_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_video_id is null then
    return;
  end if;

  if not exists (select 1 from public.tutorial_entries where id = target_video_id) then
    delete from public.tutorial_video_summaries where video_id = target_video_id;
    return;
  end if;

  insert into public.tutorial_video_summaries (
    video_id,
    title,
    description_excerpt,
    thumbnail_url,
    duration_seconds,
    status,
    updated_at,
    refreshed_at
  )
  select
    tutorial.id,
    tutorial.title,
    left(coalesce(tutorial.summary, ''), 280),
    coalesce(nullif(tutorial.poster_url, ''), '/tutorials/posters/bindernotes-tutorial-poster.svg'),
    greatest(coalesce(tutorial.duration_seconds, 0), 0),
    tutorial.status,
    tutorial.updated_at,
    now()
  from public.tutorial_entries tutorial
  where tutorial.id = target_video_id
  on conflict (video_id) do update set
    title = excluded.title,
    description_excerpt = excluded.description_excerpt,
    thumbnail_url = excluded.thumbnail_url,
    duration_seconds = excluded.duration_seconds,
    status = excluded.status,
    updated_at = excluded.updated_at,
    refreshed_at = now();
end;
$$;

create or replace function public.refresh_all_dashboard_summaries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lesson_id text;
  binder_id text;
  folder_id text;
begin
  for lesson_id in select id from public.binder_lessons
  loop
    perform public.refresh_lesson_search_excerpt(lesson_id);
  end loop;

  for binder_id in select id from public.binders
  loop
    perform public.refresh_dashboard_binder_summary(binder_id);
  end loop;

  for folder_id in select id from public.folders
  loop
    perform public.refresh_dashboard_folder_summary(folder_id);
  end loop;
end;
$$;

create or replace function public.refresh_all_admin_summaries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  binder_id text;
begin
  for binder_id in select id from public.binders
  loop
    perform public.refresh_admin_binder_summary(binder_id);
  end loop;
end;
$$;

create or replace function public.refresh_all_tutorial_video_summaries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tutorial_id text;
begin
  for tutorial_id in select id from public.tutorial_entries
  loop
    perform public.refresh_tutorial_video_summary(tutorial_id);
  end loop;
end;
$$;

create or replace function public.cleanup_stale_summary_refresh_jobs(retention interval default interval '14 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.summary_refresh_job_dedupe
  where status in ('completed', 'failed')
    and updated_at < now() - retention;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

do $$
begin
  perform pgmq.create('binder_summary_refresh');
exception
  when duplicate_table or duplicate_object then
    null;
end;
$$;

create or replace function public.enqueue_summary_refresh_job(
  target_job_type text,
  target_entity_type text,
  target_entity_id text default null,
  target_owner_id uuid default null,
  target_priority integer default 50
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  dedupe text;
  inserted_key text;
  job_payload jsonb;
begin
  dedupe := concat_ws(':', target_job_type, target_entity_type, coalesce(target_entity_id, 'all'), coalesce(target_owner_id::text, 'system'));
  job_payload := jsonb_build_object(
    'job_type', target_job_type,
    'entity_type', target_entity_type,
    'entity_id', target_entity_id,
    'owner_id', target_owner_id,
    'priority', target_priority,
    'dedupe_key', dedupe,
    'created_at', now()
  );

  insert into public.summary_refresh_job_dedupe (
    dedupe_key,
    job_type,
    entity_type,
    entity_id,
    owner_id,
    payload,
    priority,
    status,
    attempts,
    created_at,
    updated_at
  )
  values (
    dedupe,
    target_job_type,
    target_entity_type,
    target_entity_id,
    target_owner_id,
    job_payload,
    target_priority,
    'pending',
    0,
    now(),
    now()
  )
  on conflict (dedupe_key) do nothing
  returning dedupe_key into inserted_key;

  if inserted_key is not null then
    perform pgmq.send('binder_summary_refresh', job_payload);
  end if;

  return dedupe;
end;
$$;

create or replace function public.process_summary_refresh_queue(max_messages integer default 25)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  queue_message record;
  job jsonb;
  processed_count integer := 0;
begin
  for queue_message in select * from pgmq.read('binder_summary_refresh', 60, max_messages)
  loop
    job := queue_message.message;

    update public.summary_refresh_job_dedupe
    set status = 'processing',
        attempts = attempts + 1,
        updated_at = now()
    where dedupe_key = job ->> 'dedupe_key';

    begin
      case job ->> 'job_type'
        when 'rebuild_dashboard_folder_summary' then
          perform public.refresh_dashboard_folder_summary(job ->> 'entity_id');
        when 'rebuild_dashboard_binder_summary' then
          perform public.refresh_dashboard_binder_summary(job ->> 'entity_id');
        when 'rebuild_lesson_search_excerpt' then
          perform public.refresh_lesson_search_excerpt(job ->> 'entity_id');
        when 'rebuild_admin_binder_summary' then
          perform public.refresh_admin_binder_summary(job ->> 'entity_id');
        when 'refresh_all_dashboard_summaries' then
          perform public.refresh_all_dashboard_summaries();
        when 'refresh_all_admin_summaries' then
          perform public.refresh_all_admin_summaries();
        when 'refresh_tutorial_video_summary' then
          perform public.refresh_tutorial_video_summary(job ->> 'entity_id');
        when 'refresh_all_tutorial_video_summaries' then
          perform public.refresh_all_tutorial_video_summaries();
        when 'process_tutorial_video_thumbnail' then
          perform public.refresh_tutorial_video_summary(job ->> 'entity_id');
        when 'validate_binder_content' then
          perform public.refresh_admin_binder_summary(job ->> 'entity_id');
        else
          raise notice 'Unknown summary refresh job type: %', job ->> 'job_type';
      end case;

      update public.summary_refresh_job_dedupe
      set status = 'completed',
          updated_at = now()
      where dedupe_key = job ->> 'dedupe_key';
      perform pgmq.archive('binder_summary_refresh', queue_message.msg_id);
      processed_count := processed_count + 1;
    exception
      when others then
        update public.summary_refresh_job_dedupe
        set status = 'failed',
            updated_at = now()
        where dedupe_key = job ->> 'dedupe_key';
        perform pgmq.archive('binder_summary_refresh', queue_message.msg_id);
    end;
  end loop;

  return processed_count;
end;
$$;

create or replace function public.enqueue_binder_summary_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_id text;
begin
  affected_id := coalesce(new.id, old.id);
  perform public.enqueue_summary_refresh_job('rebuild_dashboard_binder_summary', 'binder', affected_id, coalesce(new.owner_id, old.owner_id), 30);
  perform public.enqueue_summary_refresh_job('rebuild_admin_binder_summary', 'binder', affected_id, coalesce(new.owner_id, old.owner_id), 35);
  return coalesce(new, old);
end;
$$;

create or replace function public.enqueue_lesson_summary_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_lesson_id text;
  affected_binder_id text;
  binder_owner_id uuid;
begin
  affected_lesson_id := coalesce(new.id, old.id);
  affected_binder_id := coalesce(new.binder_id, old.binder_id);
  select owner_id into binder_owner_id from public.binders where id = affected_binder_id;
  perform public.enqueue_summary_refresh_job('rebuild_lesson_search_excerpt', 'lesson', affected_lesson_id, binder_owner_id, 20);
  perform public.enqueue_summary_refresh_job('rebuild_dashboard_binder_summary', 'binder', affected_binder_id, binder_owner_id, 30);
  perform public.enqueue_summary_refresh_job('rebuild_admin_binder_summary', 'binder', affected_binder_id, binder_owner_id, 35);
  return coalesce(new, old);
end;
$$;

create or replace function public.enqueue_folder_row_summary_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_folder_id text;
  folder_owner_id uuid;
begin
  affected_folder_id := coalesce(new.id, old.id);
  folder_owner_id := coalesce(new.owner_id, old.owner_id);

  perform public.enqueue_summary_refresh_job('rebuild_dashboard_folder_summary', 'folder', affected_folder_id, folder_owner_id, 40);
  return coalesce(new, old);
end;
$$;

create or replace function public.enqueue_folder_binder_summary_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_folder_id text;
  affected_binder_id text;
  folder_owner_id uuid;
begin
  affected_folder_id := coalesce(new.folder_id, old.folder_id);
  affected_binder_id := coalesce(new.binder_id, old.binder_id);
  select owner_id into folder_owner_id from public.folders where id = affected_folder_id;

  perform public.enqueue_summary_refresh_job('rebuild_dashboard_folder_summary', 'folder', affected_folder_id, folder_owner_id, 40);
  if affected_binder_id is not null then
    perform public.enqueue_summary_refresh_job('rebuild_dashboard_binder_summary', 'binder', affected_binder_id, folder_owner_id, 45);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.enqueue_tutorial_summary_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_tutorial_id text;
begin
  affected_tutorial_id := coalesce(new.id, old.id);
  perform public.enqueue_summary_refresh_job('refresh_tutorial_video_summary', 'tutorial_video', affected_tutorial_id, coalesce(new.created_by, old.created_by), 40);
  if coalesce(new.duration_seconds, old.duration_seconds, 0) > 0 then
    perform public.enqueue_summary_refresh_job('process_tutorial_video_thumbnail', 'tutorial_video', affected_tutorial_id, coalesce(new.created_by, old.created_by), 60);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists binders_summary_refresh_enqueue on public.binders;
create trigger binders_summary_refresh_enqueue
  after insert or update or delete on public.binders
  for each row execute function public.enqueue_binder_summary_refresh();

drop trigger if exists binder_lessons_summary_refresh_enqueue on public.binder_lessons;
create trigger binder_lessons_summary_refresh_enqueue
  after insert or update or delete on public.binder_lessons
  for each row execute function public.enqueue_lesson_summary_refresh();

drop trigger if exists folders_summary_refresh_enqueue on public.folders;
create trigger folders_summary_refresh_enqueue
  after insert or update or delete on public.folders
  for each row execute function public.enqueue_folder_row_summary_refresh();

drop trigger if exists folder_binders_summary_refresh_enqueue on public.folder_binders;
create trigger folder_binders_summary_refresh_enqueue
  after insert or update or delete on public.folder_binders
  for each row execute function public.enqueue_folder_binder_summary_refresh();

drop trigger if exists tutorial_entries_summary_refresh_enqueue on public.tutorial_entries;
create trigger tutorial_entries_summary_refresh_enqueue
  after insert or update or delete on public.tutorial_entries
  for each row execute function public.enqueue_tutorial_summary_refresh();

do $$
begin
  perform cron.unschedule('bindernotes-process-summary-refresh-queue');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'bindernotes-process-summary-refresh-queue',
  '*/10 * * * *',
  $$select public.process_summary_refresh_queue(50);$$
);

do $$
begin
  perform cron.unschedule('bindernotes-nightly-dashboard-summary-repair');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'bindernotes-nightly-dashboard-summary-repair',
  '17 3 * * *',
  $$select public.refresh_all_dashboard_summaries(); select public.refresh_all_admin_summaries(); select public.refresh_all_tutorial_video_summaries(); select public.cleanup_stale_summary_refresh_jobs();$$
);

select public.enqueue_summary_refresh_job('refresh_all_dashboard_summaries', 'dashboard', null, null, 80);
select public.enqueue_summary_refresh_job('refresh_all_admin_summaries', 'admin', null, null, 85);
select public.enqueue_summary_refresh_job('refresh_all_tutorial_video_summaries', 'tutorial_video', null, null, 90);
