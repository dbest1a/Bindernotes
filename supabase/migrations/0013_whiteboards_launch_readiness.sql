create or replace function public.set_whiteboard_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists whiteboards_set_updated_at on public.whiteboards;
create trigger whiteboards_set_updated_at
before update on public.whiteboards
for each row
execute function public.set_whiteboard_updated_at();

alter table public.whiteboards enable row level security;
alter table public.whiteboard_versions enable row level security;
alter table public.whiteboard_assets enable row level security;

drop policy if exists "whiteboards delete own" on public.whiteboards;

create index if not exists whiteboards_owner_updated_idx
  on public.whiteboards(owner_id, updated_at desc)
  where archived_at is null;

create index if not exists whiteboard_versions_owner_created_idx
  on public.whiteboard_versions(created_by, created_at desc);
