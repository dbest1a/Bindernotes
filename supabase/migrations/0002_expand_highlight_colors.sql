alter table public.highlights
  drop constraint if exists highlights_color_check;

alter table public.highlights
  add constraint highlights_color_check
  check (color in ('yellow', 'blue', 'green', 'pink', 'orange'));
