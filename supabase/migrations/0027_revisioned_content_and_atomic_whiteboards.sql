alter table public.personal_notes add column revision bigint not null default 0 check (revision >= 0);
alter table public.personal_note_documents add column revision bigint not null default 0 check (revision >= 0);
alter table public.learner_notes add column revision bigint not null default 0 check (revision >= 0);
alter table public.whiteboards add column revision bigint not null default 0 check (revision >= 0);

create table private.content_mutation_receipts (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  operation_id uuid not null,
  entity_kind text not null,
  entity_id text not null,
  request_hash text not null,
  revision bigint not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, operation_id)
);
revoke all on private.content_mutation_receipts from public, anon, authenticated;

create or replace function public.save_personal_content(
  p_kind text, p_record jsonb, p_expected_revision bigint, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); target_table text; permitted text[]; record_id text;
  current_row jsonb; result_row jsonb; prepared jsonb; columns_sql text; update_sql text;
  receipt private.content_mutation_receipts%rowtype; request_hash text;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_operation_id is null
     or jsonb_typeof(p_record) is distinct from 'object' or octet_length(p_record::text) > 10485760 then
    raise exception 'INVALID_CONTENT_SNAPSHOT' using errcode = '22023';
  end if;
  case p_kind
    when 'note' then target_table := 'personal_notes';
      permitted := array['id','owner_id','folder_id','binder_id','document_id','title','content','math_blocks','tags','pinned','archived_at'];
    when 'document' then target_table := 'personal_note_documents';
      permitted := array['id','owner_id','binder_id','title','content','math_blocks','tags','pinned','archived_at'];
    when 'learner-note' then target_table := 'learner_notes';
      permitted := array['id','owner_id','binder_id','lesson_id','folder_id','title','content','math_blocks','pinned'];
    else raise exception 'INVALID_CONTENT_KIND' using errcode = '22023';
  end case;
  if exists (select 1 from jsonb_object_keys(p_record) k where not k = any(permitted))
     or (p_record ? 'owner_id' and p_record ->> 'owner_id' is distinct from actor::text) then
    raise exception 'INVALID_CONTENT_FIELDS' using errcode = '22023';
  end if;
  record_id := p_record ->> 'id';
  if record_id is null or length(record_id) > 200 then raise exception 'INVALID_CONTENT_ID' using errcode = '22023'; end if;
  if p_kind <> 'learner-note' then perform record_id::uuid; end if;
  if p_record ? 'content' and (jsonb_typeof(p_record->'content') is distinct from 'object'
      or p_record->'content'->>'type' is distinct from 'doc') then
    raise exception 'INVALID_DOCUMENT' using errcode = '22023';
  end if;
  if p_record ? 'math_blocks' and jsonb_typeof(p_record->'math_blocks') is distinct from 'array' then
    raise exception 'INVALID_MATH_BLOCKS' using errcode = '22023';
  end if;
  -- Serialize both the entity and retry identifier. Locks are transaction-scoped.
  perform pg_advisory_xact_lock(hashtextextended(actor::text || p_operation_id::text, 2701));
  perform pg_advisory_xact_lock(hashtextextended(target_table || ':' || record_id, 2702));
  execute format('select to_jsonb(t) from public.%I t where id::text = $1 for update', target_table)
    into current_row using record_id;
  if current_row is not null and current_row->>'owner_id' is distinct from actor::text then
    raise exception 'CONTENT_NOT_FOUND' using errcode = '42501';
  end if;
  request_hash := md5(p_record::text || p_expected_revision::text);
  select * into receipt from private.content_mutation_receipts where owner_id = actor and operation_id = p_operation_id;
  if found then
    if receipt.entity_kind <> p_kind or receipt.entity_id <> record_id or receipt.request_hash <> request_hash then
      raise exception 'OPERATION_ID_REUSED' using errcode = '22023';
    end if;
    if current_row is not null and (current_row->>'revision')::bigint = receipt.revision then return current_row; end if;
    raise exception 'CONTENT_REVISION_CONFLICT' using errcode = '40001';
  end if;
  if coalesce((current_row->>'revision')::bigint, 0) <> p_expected_revision then
    raise exception 'CONTENT_REVISION_CONFLICT' using errcode = '40001';
  end if;
  prepared := p_record || jsonb_build_object('owner_id',actor,'revision',p_expected_revision+1,'updated_at',now());
  -- Verify all referenced private objects before the SECURITY DEFINER write.
  if p_kind in ('note','document') then
    if prepared->>'binder_id' is not null and not exists (select 1 from public.personal_note_binders
      where id::text=prepared->>'binder_id' and owner_id=actor) then
      raise exception 'PRIVATE_PARENT_OWNERSHIP' using errcode='42501'; end if;
    if prepared->>'folder_id' is not null and not exists (select 1 from public.personal_note_folders
      where id::text=prepared->>'folder_id' and owner_id=actor) then
      raise exception 'PRIVATE_PARENT_OWNERSHIP' using errcode='42501'; end if;
    if prepared->>'document_id' is not null and not exists (select 1 from public.personal_note_documents
      where id::text=prepared->>'document_id' and owner_id=actor) then
      raise exception 'PRIVATE_PARENT_OWNERSHIP' using errcode='42501'; end if;
  else
    if not exists (select 1 from public.binder_lessons l join public.binders b on b.id=l.binder_id
      where l.id=prepared->>'lesson_id' and b.id=prepared->>'binder_id'
        and (b.status='published' or b.owner_id=actor or private.is_admin())) then
      raise exception 'CONTENT_SOURCE_NOT_ACCESSIBLE' using errcode='42501'; end if;
    if prepared->>'folder_id' is not null and not exists (select 1 from public.folders where id=prepared->>'folder_id' and owner_id=actor) then
      raise exception 'PRIVATE_PARENT_OWNERSHIP' using errcode='42501'; end if;
  end if;
  select string_agg(format('%I', k), ', ' order by k),
    string_agg(format('%I=excluded.%I',k,k), ', ' order by k) filter (where k not in ('id','owner_id'))
    into columns_sql, update_sql from jsonb_object_keys(prepared) k;
  execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) on conflict (id) do update set %3$s returning to_jsonb(%1$I)',target_table,columns_sql,update_sql)
    into result_row using prepared;
  insert into private.content_mutation_receipts values(actor,p_operation_id,p_kind,record_id,request_hash,p_expected_revision+1,now());
  return result_row;
end;
$$;
revoke all on function public.save_personal_content(text,jsonb,bigint,uuid) from public, anon;
grant execute on function public.save_personal_content(text,jsonb,bigint,uuid) to authenticated;
-- Old clients cannot bypass compare-and-swap. Coordinated client deployment required.
revoke insert, update on public.personal_notes,public.personal_note_documents,public.learner_notes from authenticated;
grant insert(id,owner_id,folder_id,binder_id,document_id,title,content,math_blocks,tags,pinned,archived_at)
  on public.personal_notes to authenticated;
grant insert(id,owner_id,binder_id,title,content,math_blocks,tags,pinned,archived_at)
  on public.personal_note_documents to authenticated;
grant insert(id,owner_id,binder_id,lesson_id,folder_id,title,content,math_blocks,pinned)
  on public.learner_notes to authenticated;
grant update(pinned,archived_at,folder_id,binder_id,document_id) on public.personal_notes to authenticated;
grant update(pinned,archived_at,binder_id) on public.personal_note_documents to authenticated;
grant update(pinned,folder_id) on public.learner_notes to authenticated;

create or replace function private.advance_content_metadata_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.revision = old.revision then new.revision := old.revision+1; end if;
  return new;
end;
$$;
revoke all on function private.advance_content_metadata_revision() from public,anon,authenticated;
create trigger personal_notes_metadata_revision before update on public.personal_notes
  for each row execute function private.advance_content_metadata_revision();
create trigger personal_documents_metadata_revision before update on public.personal_note_documents
  for each row execute function private.advance_content_metadata_revision();
create trigger learner_notes_metadata_revision before update on public.learner_notes
  for each row execute function private.advance_content_metadata_revision();

create or replace function private.check_personal_parent_ownership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb := to_jsonb(new); row_owner uuid := new.owner_id;
begin
  if tg_table_name <> 'learner_notes' then
    if row_data->>'binder_id' is not null and not exists(select 1 from public.personal_note_binders
      where id::text=row_data->>'binder_id' and owner_id=row_owner) then
      raise exception 'PRIVATE_PARENT_OWNERSHIP' using errcode='23514'; end if;
    if row_data->>'folder_id' is not null and not exists(select 1 from public.personal_note_folders
      where id::text=row_data->>'folder_id' and owner_id=row_owner) then
      raise exception 'PRIVATE_PARENT_OWNERSHIP' using errcode='23514'; end if;
    if row_data->>'document_id' is not null and not exists(select 1 from public.personal_note_documents
      where id::text=row_data->>'document_id' and owner_id=row_owner) then
      raise exception 'PRIVATE_PARENT_OWNERSHIP' using errcode='23514'; end if;
  elsif row_data->>'folder_id' is not null and not exists(select 1 from public.folders
    where id=row_data->>'folder_id' and owner_id=row_owner) then
    raise exception 'PRIVATE_PARENT_OWNERSHIP' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.check_personal_parent_ownership() from public,anon,authenticated;
create trigger personal_notes_private_parent before insert or update on public.personal_notes
  for each row execute function private.check_personal_parent_ownership();
create trigger personal_documents_private_parent before insert or update on public.personal_note_documents
  for each row execute function private.check_personal_parent_ownership();
create trigger learner_notes_private_parent before insert or update on public.learner_notes
  for each row execute function private.check_personal_parent_ownership();

create table private.whiteboard_quota_usage (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  active_count integer not null default 0 check(active_count >= 0)
);
insert into private.whiteboard_quota_usage(owner_id,active_count)
  select owner_id,count(*) from public.whiteboards where archived_at is null group by owner_id;
revoke all on private.whiteboard_quota_usage from public, anon, authenticated;

create or replace function public.enforce_whiteboard_active_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_owner uuid; board_limit integer := 3; reserved integer;
begin
  if tg_op = 'DELETE' then
    if old.archived_at is null then update private.whiteboard_quota_usage set active_count=active_count-1 where owner_id=old.owner_id; end if;
    return old;
  end if;
  if tg_op='UPDATE' then
    if old.owner_id is distinct from new.owner_id then raise exception 'WHITEBOARD_OWNER_IMMUTABLE' using errcode='23514'; end if;
    if old.archived_at is not null and new.archived_at is not null then return new; end if;
    if old.archived_at is null and new.archived_at is null then return new; end if;
    if new.archived_at is not null then
      update private.whiteboard_quota_usage set active_count=active_count-1 where owner_id=old.owner_id;
      return new;
    end if;
  elsif new.archived_at is not null then return new;
  end if;
  target_owner := new.owner_id;
  select case when plan in ('studio','everything') then 20 else 3 end into board_limit
    from public.account_entitlements where user_id=target_owner and status='active' and (valid_until is null or valid_until>now());
  board_limit := coalesce(board_limit,3);
  insert into private.whiteboard_quota_usage(owner_id) values(target_owner) on conflict do nothing;
  update private.whiteboard_quota_usage set active_count=active_count+1
    where owner_id=target_owner and active_count<board_limit returning active_count into reserved;
  if reserved is null then raise exception 'WHITEBOARD_LIMIT_REACHED' using errcode='23514'; end if;
  return new;
end;
$$;
drop trigger whiteboards_enforce_active_limit on public.whiteboards;
create trigger whiteboards_enforce_active_limit after insert or update of owner_id,archived_at or delete
  on public.whiteboards for each row execute function public.enforce_whiteboard_active_limit();

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
  insert into public.whiteboards(id,owner_id,binder_id,lesson_id,title,subject,module_context,scene_json,scene,module_elements,modules,
    scene_size_bytes,asset_size_bytes,object_count,archived_at,revision,updated_at)
  values(board_id,actor,nullif(p_board->>'binder_id',''),nullif(p_board->>'lesson_id',''),p_board->>'title',coalesce(p_board->>'subject','Math'),
    coalesce(p_board->>'module_context','math-lab'),scene_payload,scene_payload,modules_payload,modules_payload,
    octet_length(scene_payload::text),coalesce((p_board->>'asset_size_bytes')::integer,0),
    jsonb_array_length(scene_payload->'elements')+jsonb_array_length(modules_payload),(p_board->>'archived_at')::timestamptz,p_expected_revision+1,now())
  on conflict(id) do update set title=excluded.title,subject=excluded.subject,binder_id=excluded.binder_id,lesson_id=excluded.lesson_id,
    module_context=excluded.module_context,scene_json=excluded.scene_json,scene=excluded.scene,module_elements=excluded.module_elements,
    modules=excluded.modules,scene_size_bytes=excluded.scene_size_bytes,asset_size_bytes=excluded.asset_size_bytes,
    object_count=excluded.object_count,archived_at=excluded.archived_at,revision=excluded.revision,updated_at=excluded.updated_at
  returning * into saved;
  if coalesce(p_create_version,false) then
    select coalesce(max(version),0)+1 into next_version from public.whiteboard_versions where whiteboard_id=board_id;
    insert into public.whiteboard_versions(whiteboard_id,owner_id,version,scene_json,scene,module_elements,modules,scene_size_bytes,created_by)
      values(board_id,actor,next_version,scene_payload,scene_payload,modules_payload,modules_payload,saved.scene_size_bytes,actor);
    select * into saved from public.whiteboards where id=board_id;
  end if;
  insert into private.content_mutation_receipts values(actor,p_operation_id,'whiteboard',board_id,request_hash,p_expected_revision+1,now());
  return to_jsonb(saved);
end;
$$;
revoke all on function public.save_whiteboard_snapshot(jsonb,bigint,boolean,uuid) from public, anon;
grant execute on function public.save_whiteboard_snapshot(jsonb,bigint,boolean,uuid) to authenticated;
revoke insert, update on public.whiteboards from authenticated;
grant update(archived_at) on public.whiteboards to authenticated;
create trigger whiteboard_metadata_revision before update of archived_at on public.whiteboards
  for each row when(old.archived_at is distinct from new.archived_at)
  execute function private.advance_content_metadata_revision();
revoke insert on public.whiteboard_versions from authenticated;
notify pgrst, 'reload schema';
