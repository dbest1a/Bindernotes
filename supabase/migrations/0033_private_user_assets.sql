-- Historical tutorial policies referenced the public helper revoked in0020.
-- Policy expressions are not guaranteed to short circuit on bucket_id, so these
-- must use the granted private helper even for unrelated private uploads.
alter policy "tutorial videos admin insert" on storage.objects with check(bucket_id='tutorial-videos' and (select private.is_admin()));
alter policy "tutorial videos admin update" on storage.objects using(bucket_id='tutorial-videos' and (select private.is_admin())) with check(bucket_id='tutorial-videos' and (select private.is_admin()));
alter policy "tutorial videos admin delete" on storage.objects using(bucket_id='tutorial-videos' and (select private.is_admin())) ;
alter policy "tutorial posters admin insert" on storage.objects with check(bucket_id='tutorial-posters' and (select private.is_admin()));
alter policy "tutorial posters admin update" on storage.objects using(bucket_id='tutorial-posters' and (select private.is_admin())) with check(bucket_id='tutorial-posters' and (select private.is_admin()));
alter policy "tutorial posters admin delete" on storage.objects using(bucket_id='tutorial-posters' and (select private.is_admin())) ;
create table public.user_assets (
  id uuid primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  bucket_id text not null default 'private-assets' check(bucket_id='private-assets'),
  storage_path text not null unique,
  name text not null check(length(name) between 1 and 200),
  mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg','image/webp')),
  size_bytes bigint not null check(size_bytes between 1 and 52428800),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  import_batch_id uuid,
  status text not null default 'pending' check(status in ('pending','staged','ready','deleting')),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  check(storage_path=owner_id::text||'/'||id::text||case mime_type when 'application/pdf' then '.pdf' when 'image/png' then '.png' when 'image/jpeg' then '.jpg' else '.webp' end)
);
create index user_assets_owner_created on public.user_assets(owner_id,created_at desc,id);
create index user_assets_cleanup on public.user_assets(status,updated_at) where status<>'ready';
alter table public.user_assets enable row level security;
create policy user_assets_owned_read on public.user_assets for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.user_assets from public,anon,authenticated;
grant select on public.user_assets to authenticated;
grant all on public.user_assets to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('private-assets','private-assets',false,52428800,array['application/pdf','image/png','image/jpeg','image/webp'])
  on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function public.reserve_user_asset(p_id uuid,p_name text,p_mime_type text,p_size_bytes bigint,p_sha256 text,p_import_batch_id uuid default null)
returns public.user_assets language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); previous public.user_assets; path text; result public.user_assets;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 200
    or p_mime_type is null or p_mime_type not in ('application/pdf','image/png','image/jpeg','image/webp')
    or p_size_bytes is null or p_size_bytes not between 1 and 52428800
    or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_ASSET' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':assets',3301));
  select * into previous from public.user_assets where id=p_id;
  if found then
    if previous.owner_id<>actor then raise exception 'ASSET_NOT_FOUND' using errcode='42501'; end if;
    if previous.name<>trim(p_name) or previous.mime_type<>p_mime_type or previous.size_bytes<>p_size_bytes or previous.sha256<>p_sha256
      or previous.import_batch_id is distinct from p_import_batch_id or previous.status='deleting' then
      raise exception 'ASSET_RESERVATION_CONFLICT' using errcode='23514'; end if;
    return previous;
  end if;
  if (select coalesce(sum(size_bytes),0) from public.user_assets where owner_id=actor)+p_size_bytes>524288000 then
    raise exception 'ASSET_STORAGE_LIMIT: This account has reached its 500 MiB file allowance.' using errcode='23514'; end if;
  path:=actor::text||'/'||p_id::text||case p_mime_type when 'application/pdf' then '.pdf' when 'image/png' then '.png' when 'image/jpeg' then '.jpg' else '.webp' end;
  insert into public.user_assets(id,owner_id,storage_path,name,mime_type,size_bytes,sha256,import_batch_id)
    values(p_id,actor,path,trim(p_name),p_mime_type,p_size_bytes,p_sha256,p_import_batch_id) returning * into result;
  return result;
end $$;
revoke all on function public.reserve_user_asset(uuid,text,text,bigint,text,uuid) from public,anon;
grant execute on function public.reserve_user_asset(uuid,text,text,bigint,text,uuid) to authenticated;

-- Completion is a trusted boundary: the server streams the private object,
-- checks actual bytes, magic header, size and SHA-256 before calling this RPC.
create function public.complete_user_asset(p_id uuid,p_owner uuid,p_sha256 text,p_size_bytes bigint,p_mime_type text)
returns public.user_assets language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.user_assets;
begin
  select * into item from public.user_assets where id=p_id and owner_id=p_owner for update;
  if not found or item.status='deleting' then raise exception 'ASSET_NOT_FOUND' using errcode='42501'; end if;
  if item.sha256 is distinct from p_sha256 or item.size_bytes is distinct from p_size_bytes or item.mime_type is distinct from p_mime_type then
    raise exception 'ASSET_VERIFICATION_FAILED' using errcode='23514'; end if;
  if not exists(select 1 from storage.objects where bucket_id=item.bucket_id and name=item.storage_path) then
    raise exception 'ASSET_UPLOAD_INCOMPLETE' using errcode='23514'; end if;
  update public.user_assets set status=case when import_batch_id is null then 'ready' else 'staged' end,updated_at=now() where id=p_id returning * into item;
  return item;
end $$;
revoke all on function public.complete_user_asset(uuid,uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.complete_user_asset(uuid,uuid,text,bigint,text) to service_role;

create function public.mark_user_asset_deleting(p_id uuid) returns public.user_assets
language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.user_assets;
begin
  update public.user_assets set status='deleting',updated_at=now() where id=p_id and owner_id=auth.uid() returning * into item;
  if not found then raise exception 'ASSET_NOT_FOUND' using errcode='42501'; end if;
  return item;
end $$;
revoke all on function public.mark_user_asset_deleting(uuid) from public,anon;
grant execute on function public.mark_user_asset_deleting(uuid) to authenticated;

create function public.finish_user_asset_deletion(p_id uuid,p_owner uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.user_assets;
begin
  select * into item from public.user_assets where id=p_id and owner_id=p_owner for update;
  if not found then return; end if;
  if item.status<>'deleting' or exists(select 1 from storage.objects where bucket_id=item.bucket_id and name=item.storage_path) then
    raise exception 'ASSET_DELETE_INCOMPLETE' using errcode='23514'; end if;
  delete from public.user_assets where id=p_id;
end $$;
revoke all on function public.finish_user_asset_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function public.finish_user_asset_deletion(uuid,uuid) to service_role;

create policy private_assets_read on storage.objects for select to authenticated using(bucket_id='private-assets'
  and exists(select 1 from public.user_assets a where a.storage_path=storage.objects.name and a.owner_id=(select auth.uid()) and a.status in ('pending','ready')));
create policy private_assets_insert on storage.objects for insert to authenticated with check(bucket_id='private-assets'
  and exists(select 1 from public.user_assets a where a.storage_path=storage.objects.name and a.owner_id=(select auth.uid()) and a.status='pending'));
-- No object overwrite or direct delete. Failed/deleted objects are removed by
-- trusted cleanup so metadata can never claim deletion while bytes remain.
notify pgrst,'reload schema';
