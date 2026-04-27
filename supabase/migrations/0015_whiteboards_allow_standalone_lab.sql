alter table public.whiteboards
  drop constraint if exists whiteboards_binder_id_fkey;

alter table public.whiteboards
  drop constraint if exists whiteboards_lesson_id_fkey;

alter table public.whiteboards
  alter column binder_id drop not null;

