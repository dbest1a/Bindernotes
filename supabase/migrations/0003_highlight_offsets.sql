alter table public.highlights
  add column if not exists start_offset integer,
  add column if not exists end_offset integer;

alter table public.highlights
  add constraint highlights_offsets_check
  check (
    start_offset is null
    or end_offset is null
    or start_offset <= end_offset
  );

create index if not exists highlights_lesson_offsets_idx
  on public.highlights (lesson_id, start_offset, end_offset);
