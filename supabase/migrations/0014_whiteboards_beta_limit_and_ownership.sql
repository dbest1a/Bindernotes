alter table public.whiteboards
  add column if not exists scene jsonb;

update public.whiteboards
set scene = scene_json
where scene is null;

alter table public.whiteboards
  alter column scene set default '{}'::jsonb,
  alter column scene set not null;

alter table public.whiteboards
  add column if not exists modules jsonb;

update public.whiteboards
set modules = module_elements
where modules is null;

alter table public.whiteboards
  alter column modules set default '[]'::jsonb,
  alter column modules set not null;

alter table public.whiteboard_versions
  add column if not exists scene jsonb;

update public.whiteboard_versions
set scene = scene_json
where scene is null;

alter table public.whiteboard_versions
  alter column scene set default '{}'::jsonb,
  alter column scene set not null;

alter table public.whiteboard_versions
  add column if not exists modules jsonb;

update public.whiteboard_versions
set modules = module_elements
where modules is null;

alter table public.whiteboard_versions
  alter column modules set default '[]'::jsonb,
  alter column modules set not null;

alter table public.whiteboard_versions
  add column if not exists owner_id uuid;

update public.whiteboard_versions versions
set owner_id = boards.owner_id
from public.whiteboards boards
where versions.whiteboard_id = boards.id
  and versions.owner_id is null;

alter table public.whiteboard_versions
  alter column owner_id set not null;

alter table public.whiteboard_assets
  add column if not exists owner_id uuid;

update public.whiteboard_assets assets
set owner_id = boards.owner_id
from public.whiteboards boards
where assets.whiteboard_id = boards.id
  and assets.owner_id is null;

alter table public.whiteboard_assets
  alter column owner_id set not null;

create index if not exists whiteboards_owner_active_idx
  on public.whiteboards(owner_id, updated_at desc)
  where archived_at is null;

create index if not exists whiteboard_versions_owner_board_idx
  on public.whiteboard_versions(owner_id, whiteboard_id, created_at desc);

create index if not exists whiteboard_assets_owner_board_idx
  on public.whiteboard_assets(owner_id, whiteboard_id, created_at desc);

create or replace function public.enforce_whiteboard_active_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count integer;
begin
  if new.archived_at is not null then
    return new;
  end if;

  select count(*)
    into active_count
    from public.whiteboards
   where owner_id = new.owner_id
     and archived_at is null
     and id <> new.id;

  if active_count >= 3 then
    raise exception 'WHITEBOARD_LIMIT_REACHED: You can save up to 3 whiteboards in this beta. Archive one to create another.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists whiteboards_enforce_active_limit on public.whiteboards;
create trigger whiteboards_enforce_active_limit
before insert or update of owner_id, archived_at on public.whiteboards
for each row
execute function public.enforce_whiteboard_active_limit();

alter table public.whiteboards enable row level security;
alter table public.whiteboard_versions enable row level security;
alter table public.whiteboard_assets enable row level security;

drop policy if exists "whiteboards delete own" on public.whiteboards;

drop policy if exists "whiteboard versions select own" on public.whiteboard_versions;
drop policy if exists "whiteboard versions insert own" on public.whiteboard_versions;

create policy "whiteboard versions select own"
  on public.whiteboard_versions for select
  using (owner_id = auth.uid());

create policy "whiteboard versions insert own"
  on public.whiteboard_versions for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.whiteboards
      where whiteboards.id = whiteboard_versions.whiteboard_id
        and whiteboards.owner_id = auth.uid()
    )
  );

drop policy if exists "whiteboard assets select own" on public.whiteboard_assets;
drop policy if exists "whiteboard assets insert own" on public.whiteboard_assets;
drop policy if exists "whiteboard assets delete own" on public.whiteboard_assets;

create policy "whiteboard assets select own"
  on public.whiteboard_assets for select
  using (owner_id = auth.uid());

create policy "whiteboard assets insert own"
  on public.whiteboard_assets for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.whiteboards
      where whiteboards.id = whiteboard_assets.whiteboard_id
        and whiteboards.owner_id = auth.uid()
    )
  );

create policy "whiteboard assets delete own"
  on public.whiteboard_assets for delete
  using (owner_id = auth.uid());
