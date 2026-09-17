-- Fail closed on historical conflicts: never silently choose between unequal
-- representations of a student's scene. Reconcile such an environment first.
do $$ begin
  if exists(select 1 from public.whiteboards where scene is distinct from scene_json or modules is distinct from module_elements)
    or exists(select 1 from public.whiteboard_versions where scene is distinct from scene_json or modules is distinct from module_elements) then
    raise exception 'WHITEBOARD_LEGACY_PAYLOAD_CONFLICT: Reconcile differing legacy scene/module copies before applying this migration.';
  end if;
end $$;
drop trigger if exists whiteboards_enforce_payload_limits on public.whiteboards;
drop trigger if exists whiteboard_versions_enforce_payload_limits on public.whiteboard_versions;
drop trigger if exists whiteboard_versions_prepare_retention_metadata on public.whiteboard_versions;
drop trigger if exists whiteboard_versions_mark_compactable on public.whiteboard_versions;
alter table public.whiteboards drop column scene,drop column modules;
alter table public.whiteboard_versions drop column scene,drop column modules;

-- Keep the 50 newest automatic/draft snapshots, plus every explicit manual,
-- checkpoint or snapshot version. Current scene is never touched by pruning.
create or replace function private.prune_whiteboard_versions(p_board_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from public.whiteboards where id=p_board_id for update;
  delete from public.whiteboard_versions stale using (
    select id,row_number() over(order by version desc,created_at desc,id desc) rank
    from public.whiteboard_versions where whiteboard_id=p_board_id
      and version_kind in ('auto','draft') and retention_status in ('active','compactable')
  ) ranked where stale.id=ranked.id and ranked.rank>50;
  update public.whiteboards b set
    latest_version_id=(select id from public.whiteboard_versions where whiteboard_id=b.id order by version desc limit 1),
    latest_version_number=(select max(version) from public.whiteboard_versions where whiteboard_id=b.id),
    latest_version_created_at=(select created_at from public.whiteboard_versions where whiteboard_id=b.id order by version desc limit 1),
    version_retention_checked_at=now(),version_compaction_candidate_count=0,
    version_payload_bytes_estimate=(select coalesce(sum(approximate_payload_bytes),0) from public.whiteboard_versions where whiteboard_id=b.id)
  where b.id=p_board_id;
end $$;
revoke all on function private.prune_whiteboard_versions(text) from public,anon,authenticated;

create or replace function private.mark_whiteboard_versions_compactable()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform private.prune_whiteboard_versions(new.whiteboard_id);
  return null;
end $$;
revoke all on function private.mark_whiteboard_versions_compactable() from public,anon,authenticated;

create or replace function private.prepare_whiteboard_version_retention_metadata()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  new.created_at:=coalesce(new.created_at,now());
  new.version_kind:=coalesce(nullif(new.version_kind,''),'auto');
  new.retention_status:='active';
  new.retained_until:=null;
  new.approximate_payload_bytes:=octet_length(new.scene_json::text)+octet_length(new.module_elements::text);
  return new;
end $$;
revoke all on function private.prepare_whiteboard_version_retention_metadata() from public,anon,authenticated;
create trigger whiteboard_versions_prepare_retention_metadata before insert or update of scene_json,module_elements,version_kind
  on public.whiteboard_versions for each row execute function private.prepare_whiteboard_version_retention_metadata();
create trigger whiteboard_versions_mark_compactable after insert on public.whiteboard_versions
  for each row execute function private.mark_whiteboard_versions_compactable();

create or replace function public.enforce_whiteboard_payload_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scene_payload jsonb;
  modules_payload jsonb;
  computed_scene_size integer;
  computed_object_count integer;
begin
  scene_payload := coalesce(new.scene_json, '{}'::jsonb);
  modules_payload := coalesce(new.module_elements, '[]'::jsonb);
  computed_scene_size := octet_length(scene_payload::text);
  computed_object_count :=
    public.whiteboard_json_array_length(scene_payload -> 'elements')
    + public.whiteboard_json_array_length(modules_payload);

  new.scene_size_bytes := greatest(coalesce(new.scene_size_bytes, 0), computed_scene_size);
  new.object_count := greatest(coalesce(new.object_count, 0), computed_object_count);

  if new.scene_size_bytes > 10485760 then
    raise exception 'WHITEBOARD_SCENE_TOO_LARGE: Whiteboard scene JSON exceeds the 10 MB limit.'
      using errcode = '23514';
  end if;

  if new.asset_size_bytes > 52428800 then
    raise exception 'WHITEBOARD_ASSETS_TOO_LARGE: Whiteboard assets exceed the 50 MB board limit.'
      using errcode = '23514';
  end if;

  if new.object_count > 5000 then
    raise exception 'WHITEBOARD_OBJECT_LIMIT_REACHED: Whiteboard object count exceeds the 5000 object limit.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_whiteboard_version_payload_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scene_payload jsonb;
  computed_scene_size integer;
begin
  scene_payload := coalesce(new.scene_json, '{}'::jsonb);
  computed_scene_size := octet_length(scene_payload::text);
  new.scene_size_bytes := greatest(coalesce(new.scene_size_bytes, 0), computed_scene_size);

  if new.scene_size_bytes > 10485760 then
    raise exception 'WHITEBOARD_VERSION_SCENE_TOO_LARGE: Whiteboard version scene JSON exceeds the 10 MB limit.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.save_whiteboard_snapshot(
  p_board jsonb, p_expected_revision bigint, p_create_version boolean, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); board_id text := p_board->>'id'; current_board public.whiteboards%rowtype;
  saved public.whiteboards%rowtype; request_hash text; receipt private.content_mutation_receipts%rowtype;
  next_version integer; scene_payload jsonb; modules_payload jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_operation_id is null or p_expected_revision is null or p_expected_revision<0 or board_id is null
    or length(board_id)>200 or jsonb_typeof(p_board) is distinct from 'object'
    or p_board->>'owner_id' is distinct from actor::text then
    raise exception 'INVALID_WHITEBOARD_SNAPSHOT' using errcode='22023'; end if;
  scene_payload := p_board->'scene_json'; modules_payload := p_board->'module_elements';
  if jsonb_typeof(scene_payload) is distinct from 'object' or jsonb_typeof(scene_payload->'elements') is distinct from 'array'
    or jsonb_typeof(modules_payload) is distinct from 'array' or octet_length(p_board::text)>15728640 then
    raise exception 'INVALID_WHITEBOARD_PAYLOAD' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || p_operation_id::text,2701));
  perform pg_advisory_xact_lock(hashtextextended('whiteboard:' || board_id,2702));
  select * into current_board from public.whiteboards where id=board_id for update;
  if found and current_board.owner_id <> actor then raise exception 'WHITEBOARD_NOT_FOUND' using errcode='42501'; end if;
  request_hash := md5(p_board::text || p_expected_revision::text || coalesce(p_create_version,false)::text);
  select * into receipt from private.content_mutation_receipts where owner_id=actor and operation_id=p_operation_id;
  if found then
    if receipt.entity_kind<>'whiteboard' or receipt.entity_id<>board_id or receipt.request_hash<>request_hash then
      raise exception 'OPERATION_ID_REUSED' using errcode='22023'; end if;
    if current_board.revision=receipt.revision then return to_jsonb(current_board); end if;
    raise exception 'CONTENT_REVISION_CONFLICT' using errcode='40001';
  end if;
  if coalesce(current_board.revision,0)<>p_expected_revision then raise exception 'CONTENT_REVISION_CONFLICT' using errcode='40001'; end if;
  if nullif(p_board->>'binder_id','') is not null and not exists (select 1 from public.binders
    where id=p_board->>'binder_id' and (status='published' or owner_id=actor or private.is_admin())) then
    raise exception 'CONTENT_SOURCE_NOT_ACCESSIBLE' using errcode='42501'; end if;
  if nullif(p_board->>'lesson_id','') is not null and not exists (select 1 from public.binder_lessons
    where id=p_board->>'lesson_id' and binder_id=p_board->>'binder_id') then
    raise exception 'CONTENT_SOURCE_NOT_ACCESSIBLE' using errcode='42501'; end if;
  insert into public.whiteboards(id,owner_id,binder_id,lesson_id,title,subject,module_context,scene_json,module_elements,
    scene_size_bytes,asset_size_bytes,object_count,archived_at,revision,updated_at)
  values(board_id,actor,nullif(p_board->>'binder_id',''),nullif(p_board->>'lesson_id',''),p_board->>'title',coalesce(p_board->>'subject','Math'),
    coalesce(p_board->>'module_context','math-lab'),scene_payload,modules_payload,
    octet_length(scene_payload::text),coalesce((p_board->>'asset_size_bytes')::integer,0),
    jsonb_array_length(scene_payload->'elements')+jsonb_array_length(modules_payload),(p_board->>'archived_at')::timestamptz,p_expected_revision+1,now())
  on conflict(id) do update set title=excluded.title,subject=excluded.subject,binder_id=excluded.binder_id,lesson_id=excluded.lesson_id,
    module_context=excluded.module_context,scene_json=excluded.scene_json,module_elements=excluded.module_elements,
    scene_size_bytes=excluded.scene_size_bytes,asset_size_bytes=excluded.asset_size_bytes,
    object_count=excluded.object_count,archived_at=excluded.archived_at,revision=excluded.revision,updated_at=excluded.updated_at
  returning * into saved;
  if coalesce(p_create_version,false) then
    select coalesce(max(version),0)+1 into next_version from public.whiteboard_versions where whiteboard_id=board_id;
    insert into public.whiteboard_versions(whiteboard_id,owner_id,version,scene_json,module_elements,scene_size_bytes,created_by)
      values(board_id,actor,next_version,scene_payload,modules_payload,saved.scene_size_bytes,actor);
    select * into saved from public.whiteboards where id=board_id;
  end if;
  insert into private.content_mutation_receipts values(actor,p_operation_id,'whiteboard',board_id,request_hash,p_expected_revision+1,now());
  return to_jsonb(saved);
end;
$$;
create trigger whiteboards_enforce_payload_limits before insert or update of scene_json,module_elements,scene_size_bytes,object_count,asset_size_bytes
  on public.whiteboards for each row execute function public.enforce_whiteboard_payload_limits();
create trigger whiteboard_versions_enforce_payload_limits before insert or update of scene_json,scene_size_bytes
  on public.whiteboard_versions for each row execute function public.enforce_whiteboard_version_payload_limits();

create or replace function public.restore_whiteboard_version(p_board_id text,p_version_id text,p_expected_revision bigint,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare board public.whiteboards; version public.whiteboard_versions; payload jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation_id::text,2701));
  perform pg_advisory_xact_lock(hashtextextended('whiteboard:'||p_board_id,2702));
  select * into board from public.whiteboards where id=p_board_id and owner_id=auth.uid() for update;
  if not found then raise exception 'WHITEBOARD_NOT_FOUND' using errcode='42501'; end if;
  select * into version from public.whiteboard_versions where id=p_version_id and whiteboard_id=board.id and owner_id=auth.uid();
  if not found then raise exception 'WHITEBOARD_VERSION_NOT_FOUND' using errcode='42501'; end if;
  -- An explicitly chosen recovery point becomes a retained manual checkpoint.
  update public.whiteboard_versions set version_kind='manual' where id=version.id;
  payload:=jsonb_build_object('id',board.id,'owner_id',board.owner_id,'binder_id',board.binder_id,'lesson_id',board.lesson_id,
    'title',board.title,'subject',board.subject,'module_context',board.module_context,'scene_json',version.scene_json,
    'module_elements',version.module_elements,'asset_size_bytes',board.asset_size_bytes,'archived_at',board.archived_at);
  return public.save_whiteboard_snapshot(payload,p_expected_revision,true,p_operation_id);
end $$;
revoke all on function public.restore_whiteboard_version(text,text,bigint,uuid) from public,anon;
grant execute on function public.restore_whiteboard_version(text,text,bigint,uuid) to authenticated;
-- Apply the documented policy to existing history. Equality was checked before
-- dropping compatibility columns; neither current nor retained payload changes.
do $$ declare board_id text; begin
  for board_id in select id from public.whiteboards loop perform private.prune_whiteboard_versions(board_id); end loop;
end $$;
notify pgrst,'reload schema';
