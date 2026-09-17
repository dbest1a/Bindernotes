-- Export is one MVCC statement, so the body and its hierarchy cannot come from
-- different pagination instants. RLS remains in force for every source read.
create policy "owners read private lesson copies" on public.binder_lessons for select to authenticated
 using(exists(select 1 from public.binders b where b.id=binder_id and b.owner_id=(select auth.uid())));
-- Documents are checked again at the privileged import boundary, including direct RPC callers.
create function private.archive_document_safe(p_document jsonb) returns boolean
language sql immutable set search_path='' as $$
 with recursive fields(key,value,depth) as (
   select ''::text,p_document,0
   union all
   select child.key,child.value,parent.depth+1 from fields parent
   cross join lateral (
     select e.key,e.value from jsonb_each(case when jsonb_typeof(parent.value)='object' then parent.value else '{}'::jsonb end) e
     union all
     select '',a.value from jsonb_array_elements(case when jsonb_typeof(parent.value)='array' then parent.value else '[]'::jsonb end) a
   ) child where parent.depth<=50
 )
 select coalesce(jsonb_typeof(p_document)='object' and p_document->>'type'='doc',false)
   and (select count(*)<=100000 and coalesce(bool_and(depth<=50
     and key not in('__proto__','constructor','prototype','innerHTML','outerHTML','srcdoc') and key !~* '^on[a-z]'
     and not(lower(key) in('href','src','url') and jsonb_typeof(value)='string'
       and regexp_replace(value#>>'{}','[[:space:][:cntrl:]]','','g') ~* '^(javascript|vbscript|data):')),true) from fields);
$$;
revoke all on function private.archive_document_safe(jsonb) from public,anon,authenticated;

create function private.archive_columns(p_table text) returns text[]
language sql immutable set search_path='' as $$
 select case p_table
 when 'personal_note_folders' then array['id','owner_id','name','color','sort_order','archived_at','created_at','updated_at']
 when 'personal_note_binders' then array['id','owner_id','folder_id','title','description','color','pinned','sort_order','archived_at','created_at','updated_at']
 when 'personal_note_documents' then array['id','owner_id','binder_id','title','content','math_blocks','tags','pinned','archived_at','revision','created_at','updated_at']
 when 'personal_notes' then array['id','owner_id','folder_id','binder_id','document_id','title','content','math_blocks','tags','pinned','archived_at','revision','created_at','updated_at']
 when 'folders' then array['id','owner_id','name','color','sort_order','created_at','updated_at']
 when 'binders' then array['id','owner_id','title','slug','description','subject','level','status','price_cents','cover_url','pinned','created_at','updated_at']
 when 'binder_lessons' then array['id','binder_id','title','order_index','content','math_blocks','is_preview','created_at','updated_at']
 when 'folder_binders' then array['id','owner_id','folder_id','binder_id','sort_order','created_at','updated_at']
 when 'learner_notes' then array['id','owner_id','binder_id','lesson_id','folder_id','title','content','math_blocks','pinned','revision','created_at','updated_at']
 when 'comments' then array['id','owner_id','binder_id','lesson_id','anchor_text','body','parent_id','resolved_at','created_at','updated_at']
 when 'highlights' then array['id','owner_id','binder_id','lesson_id','anchor_text','color','note_id','start_offset','end_offset','document_id','source_version_id','selected_text','prefix_text','suffix_text','selector_json','status','reanchor_confidence','created_at','updated_at']
 when 'whiteboards' then array['id','owner_id','binder_id','lesson_id','title','subject','module_context','scene_json','module_elements','scene_size_bytes','asset_size_bytes','object_count','archived_at','revision','created_at','updated_at']
 when 'whiteboard_versions' then array['id','whiteboard_id','version','scene_json','module_elements','scene_size_bytes','created_at','created_by','version_kind']
 end;
$$;
revoke all on function private.archive_columns(text) from public,anon;
revoke all on function private.archive_columns(text) from authenticated;

create function public.export_portable_workspace() returns jsonb
language plpgsql security invoker stable set search_path='' as $$
declare actor uuid:=auth.uid(); binder_ids text[]; board_ids text[]; result jsonb:='{}'; rows jsonb; table_name text; columns_sql text; permitted text[];
begin
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select array_agg(distinct id) into binder_ids from (
   select id from public.binders where owner_id=actor
   union select binder_id from public.learner_notes where owner_id=actor
   union select binder_id from public.comments where owner_id=actor
   union select binder_id from public.highlights where owner_id=actor
   union select binder_id from public.whiteboards where owner_id=actor and binder_id is not null
   union select binder_id from public.folder_binders where owner_id=actor
   union select payload->'item'->>'binder_id' from public.review_items where owner_id=actor
 ) ids;
 select array_agg(id) into board_ids from public.whiteboards where owner_id=actor;
 foreach table_name in array array['personal_note_folders','personal_note_binders','personal_note_documents','personal_notes','folders','binders','binder_lessons','folder_binders','learner_notes','comments','highlights','whiteboards','whiteboard_versions'] loop
   permitted:=case table_name
 when 'personal_note_folders' then array['id','owner_id','name','color','sort_order','archived_at','created_at','updated_at']
 when 'personal_note_binders' then array['id','owner_id','folder_id','title','description','color','pinned','sort_order','archived_at','created_at','updated_at']
 when 'personal_note_documents' then array['id','owner_id','binder_id','title','content','math_blocks','tags','pinned','archived_at','revision','created_at','updated_at']
 when 'personal_notes' then array['id','owner_id','folder_id','binder_id','document_id','title','content','math_blocks','tags','pinned','archived_at','revision','created_at','updated_at']
 when 'folders' then array['id','owner_id','name','color','sort_order','created_at','updated_at']
 when 'binders' then array['id','owner_id','title','slug','description','subject','level','status','price_cents','cover_url','pinned','created_at','updated_at']
 when 'binder_lessons' then array['id','binder_id','title','order_index','content','math_blocks','is_preview','created_at','updated_at']
 when 'folder_binders' then array['id','owner_id','folder_id','binder_id','sort_order','created_at','updated_at']
 when 'learner_notes' then array['id','owner_id','binder_id','lesson_id','folder_id','title','content','math_blocks','pinned','revision','created_at','updated_at']
 when 'comments' then array['id','owner_id','binder_id','lesson_id','anchor_text','body','parent_id','resolved_at','created_at','updated_at']
 when 'highlights' then array['id','owner_id','binder_id','lesson_id','anchor_text','color','note_id','start_offset','end_offset','document_id','source_version_id','selected_text','prefix_text','suffix_text','selector_json','status','reanchor_confidence','created_at','updated_at']
 when 'whiteboards' then array['id','owner_id','binder_id','lesson_id','title','subject','module_context','scene_json','module_elements','scene_size_bytes','asset_size_bytes','object_count','archived_at','revision','created_at','updated_at']
 when 'whiteboard_versions' then array['id','whiteboard_id','version','scene_json','module_elements','scene_size_bytes','created_at','created_by','version_kind']
 end;
   select string_agg(format('%I',field),',') into columns_sql from unnest(permitted) field;
   execute format('select coalesce(jsonb_agg(to_jsonb(r) order by r.id),''[]''::jsonb) from (select %s from public.%I where %s) r', columns_sql,table_name,
     case when table_name='binders' then 'id=any($2)' when table_name='binder_lessons' then 'binder_id=any($2)'
       when table_name='whiteboard_versions' then 'whiteboard_id=any($3)' else 'owner_id=$1' end)
     into rows using actor,binder_ids,board_ids;
   result:=result||jsonb_build_object(table_name,rows);
 end loop;
 return jsonb_build_object('tables',result,
   'reviews',(select coalesce(jsonb_agg(payload order by id),'[]') from public.review_items where owner_id=actor),
   'reviewEvents',(select coalesce(jsonb_agg(payload order by id),'[]') from public.review_events where owner_id=actor),
   'recallSessions',(select coalesce(jsonb_agg(payload order by id),'[]') from public.review_sessions where owner_id=actor),
   'assets',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from public.user_assets a where owner_id=actor and status='ready' and import_batch_id is null));
end $$;
revoke all on function public.export_portable_workspace() from public,anon;
grant execute on function public.export_portable_workspace() to authenticated;

create table public.workspace_archive_imports (
 owner_id uuid not null references public.profiles(id) on delete cascade, batch_id uuid not null,
 archive_digest text not null check(archive_digest ~ '^[0-9a-f]{64}$'), request_hash text not null,
 counts jsonb not null, recovery_data jsonb not null, created_at timestamptz not null default now(),
 primary key(owner_id,batch_id), unique(owner_id,archive_digest)
);
alter table public.workspace_archive_imports enable row level security;
create policy archive_imports_owned_read on public.workspace_archive_imports for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.workspace_archive_imports from public,anon,authenticated;
grant select on public.workspace_archive_imports to authenticated;
grant all on public.workspace_archive_imports to service_role;

create function public.import_portable_workspace(p_archive jsonb,p_batch_id uuid,p_archive_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); previous public.workspace_archive_imports; request_hash text; table_name text; rows jsonb;
 row_data jsonb; prepared jsonb; permitted text[]; columns_sql text; counts jsonb:='{}'; field text; parent_table text;
 reference_id text; record jsonb; event_rows jsonb; asset jsonb; session jsonb; session_id text; event_offset integer; review_revision integer; expected_type text; promoted_assets integer;
begin
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_batch_id is null or p_archive_digest is null or p_archive_digest !~ '^[0-9a-f]{64}$'
   or jsonb_typeof(p_archive) is distinct from 'object' or p_archive->>'format' is distinct from 'bindernotes-archive'
   or p_archive->>'version' is distinct from '1' or p_archive->>'ownerId' is distinct from actor::text
   or octet_length(p_archive::text)>104857600 then raise exception 'INVALID_ARCHIVE' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_archive) k where k not in('format','version','ownerId','exportedAt','tables','reviews','reviewEvents','recallSessions','assets','localMath','deviceRecovery','sourceProvenance'))
   or jsonb_typeof(p_archive->'tables') is distinct from 'object' then raise exception 'INVALID_ARCHIVE_FIELDS' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':archive:'||p_archive_digest,3401));
 request_hash:=encode(sha256(convert_to(p_archive::text,'UTF8')),'hex');
 select * into previous from public.workspace_archive_imports where owner_id=actor and archive_digest=p_archive_digest;
 if found then
   if previous.batch_id<>p_batch_id or previous.request_hash<>request_hash then raise exception 'ARCHIVE_RETRY_MISMATCH' using errcode='22023'; end if;
   return previous.counts;
 end if;
 if exists(select 1 from jsonb_object_keys(p_archive->'tables') k where private.archive_columns(k) is null) then raise exception 'UNKNOWN_ARCHIVE_TABLE' using errcode='22023'; end if;
 foreach field in array array['reviews','reviewEvents','recallSessions','assets','deviceRecovery','sourceProvenance'] loop
   if jsonb_typeof(p_archive->field) is distinct from 'array' or jsonb_array_length(p_archive->field)>100000 then raise exception 'INVALID_ARCHIVE_COLLECTION' using errcode='22023'; end if;
 end loop;
 if jsonb_typeof(p_archive->'localMath') is distinct from 'object' or p_archive->'localMath'->>'ownerId' is distinct from actor::text then raise exception 'INVALID_ARCHIVE_MATH' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_archive->'reviewEvents') e group by e->>'id' having count(*)>1) then raise exception 'DUPLICATE_ARCHIVE_EVENT' using errcode='22023'; end if;
 -- Every hierarchy insert is in the same transaction. No upsert or existing-record update is permitted.
 foreach table_name in array array['personal_note_folders','personal_note_binders','personal_note_documents','personal_notes','folders','binders','binder_lessons','folder_binders','learner_notes','comments','highlights','whiteboards','whiteboard_versions'] loop
   rows:=p_archive->'tables'->table_name; permitted:=private.archive_columns(table_name);
   if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>10000 then raise exception 'INVALID_ARCHIVE_TABLE' using errcode='22023'; end if;
   if exists(select 1 from jsonb_array_elements(rows) r group by r->>'id' having count(*)>1) then raise exception 'DUPLICATE_ARCHIVE_ID' using errcode='22023'; end if;
   for row_data in select value from jsonb_array_elements(rows) loop
     if jsonb_typeof(row_data) is distinct from 'object' or coalesce(length(row_data->>'id'),0) not between 1 and 200
       or exists(select 1 from jsonb_object_keys(row_data) k where not k=any(permitted))
       or exists(select 1 from unnest(permitted) k where not row_data ? k)
       or octet_length(row_data::text)>15728640 then raise exception 'INVALID_ARCHIVE_ROW' using errcode='22023'; end if;
     if 'owner_id'=any(permitted) and row_data->>'owner_id' is distinct from actor::text then raise exception 'ARCHIVE_OWNER_MISMATCH' using errcode='42501'; end if;
     foreach field in array permitted loop
       if row_data->field='null'::jsonb and field in('folder_id','binder_id','document_id','lesson_id','description','color','sort_order','archived_at','cover_url','created_by','anchor_text','parent_id','resolved_at','note_id','start_offset','end_offset','source_version_id','selected_text','prefix_text','suffix_text','selector_json','reanchor_confidence') then continue; end if;
       expected_type:=case when field in('revision','version','sort_order','order_index','price_cents','scene_size_bytes','asset_size_bytes','object_count','start_offset','end_offset','reanchor_confidence') then 'number'
         when field in('pinned','is_preview') then 'boolean' when field in('tags','math_blocks','module_elements') then 'array'
         when field in('content','scene_json','selector_json') then 'object' else 'string' end;
       if jsonb_typeof(row_data->field) is distinct from expected_type then raise exception 'INVALID_ARCHIVE_FIELD_TYPE' using errcode='22023'; end if;
       if expected_type='string' and length(row_data->>field)>100000 then raise exception 'ARCHIVE_FIELD_TOO_LARGE' using errcode='22023'; end if;
       if field in('created_at','updated_at','archived_at','resolved_at') and not isfinite((row_data->>field)::timestamptz) then raise exception 'INVALID_ARCHIVE_TIME' using errcode='22023'; end if;
     end loop;
     if row_data ? 'content' and (not private.archive_document_safe(row_data->'content') or jsonb_typeof(row_data->'math_blocks') is distinct from 'array') then raise exception 'INVALID_ARCHIVE_CONTENT' using errcode='22023'; end if;
     if table_name='binders' and (row_data->>'status'<>'draft' or row_data->>'price_cents'<>'0') then raise exception 'ARCHIVE_SOURCES_MUST_BE_PRIVATE' using errcode='42501'; end if;
     foreach field in array array['folder_id','binder_id','document_id','lesson_id','whiteboard_id','parent_id','note_id'] loop
       reference_id:=row_data->>field;
       if reference_id is null then continue; end if;
       parent_table:=case field when 'folder_id' then case when table_name like 'personal_%' then 'personal_note_folders' else 'folders' end
         when 'binder_id' then case when table_name like 'personal_%' then 'personal_note_binders' else 'binders' end
         when 'document_id' then case when table_name='highlights' then 'binder_lessons' else 'personal_note_documents' end when 'lesson_id' then 'binder_lessons' when 'whiteboard_id' then 'whiteboards' when 'parent_id' then 'comments' when 'note_id' then 'learner_notes' end;
       if not exists(select 1 from jsonb_array_elements(p_archive->'tables'->parent_table) r where r->>'id'=reference_id) then raise exception 'ARCHIVE_PARENT_MISSING' using errcode='23514'; end if;
     end loop;
     if table_name in('learner_notes','whiteboards','comments','highlights') and row_data->>'lesson_id' is not null and not exists(
       select 1 from jsonb_array_elements(p_archive->'tables'->'binder_lessons') l where l->>'id'=row_data->>'lesson_id' and l->>'binder_id'=row_data->>'binder_id') then raise exception 'ARCHIVE_LESSON_SCOPE_MISMATCH' using errcode='23514'; end if;
     if table_name='whiteboard_versions' and row_data->>'created_by' is distinct from actor::text then raise exception 'ARCHIVE_OWNER_MISMATCH' using errcode='42501'; end if;
     if table_name='comments' and row_data->>'parent_id' is not null and not exists(
       select 1 from jsonb_array_elements(p_archive->'tables'->'comments') p where p->>'id'=row_data->>'parent_id' and p->>'binder_id'=row_data->>'binder_id' and p->>'lesson_id'=row_data->>'lesson_id') then raise exception 'ARCHIVE_COMMENT_SCOPE_MISMATCH' using errcode='23514'; end if;
     prepared:=row_data;
     -- Threads may arrive in any order. Link only these new rows after all comments exist.
     if table_name='comments' then prepared:=prepared||jsonb_build_object('parent_id',null); end if;
     -- Revisions start a new account history; archived state and content timestamps are retained.
     if 'revision'=any(permitted) then prepared:=prepared||jsonb_build_object('revision',0); end if;
     if table_name='whiteboard_versions' then
       prepared:=prepared||jsonb_build_object('owner_id',actor);
     end if;
     select string_agg(format('%I',k),',') into columns_sql from unnest(case when table_name='whiteboard_versions' then array_append(permitted,'owner_id') else permitted end) k;
     execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I,$1)',table_name,columns_sql) using prepared;
   end loop;
   counts:=counts||jsonb_build_object(table_name,jsonb_array_length(rows));
 end loop;
 update public.comments c set parent_id=r->>'parent_id' from jsonb_array_elements(p_archive->'tables'->'comments') r
 where c.id=r->>'id' and c.owner_id=actor and r->>'parent_id' is not null;
 -- Reuse the same validators and transactional history writers as ordinary review saves.
 for record in select value from jsonb_array_elements(p_archive->'reviews') loop
   if exists(select 1 from public.review_items where owner_id=actor and id=record->'item'->>'id') then raise exception 'ARCHIVE_ID_EXISTS' using errcode='23505'; end if;
   select coalesce(jsonb_agg(value),'[]') into event_rows from jsonb_array_elements(p_archive->'reviewEvents') where value->>'item_id'=record->'item'->>'id';
   event_offset:=0; review_revision:=0;
   loop
     perform public.save_review_item(record,review_revision,gen_random_uuid(),(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(event_rows) with ordinality e(value,n) where n>event_offset and n<=event_offset+1000));
     event_offset:=event_offset+1000; review_revision:=review_revision+1;
     exit when event_offset>=jsonb_array_length(event_rows);
   end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_archive->'reviewEvents') e where not exists(select 1 from jsonb_array_elements(p_archive->'reviews') r where r->'item'->>'id'=e->>'item_id')) then raise exception 'ARCHIVE_REVIEW_PARENT_MISSING' using errcode='23514'; end if;
 for session in select value from jsonb_array_elements(p_archive->'recallSessions') loop
   session_id:=jsonb_build_array(session->'scope'->>'binderId',session->'scope'->>'documentId',session->'scope'->>'lessonId',session->>'id')::text;
   if exists(select 1 from public.review_sessions where owner_id=actor and id::jsonb=session_id::jsonb) then raise exception 'ARCHIVE_ID_EXISTS' using errcode='23505'; end if;
   perform public.save_review_session(session_id,session);
 end loop;
 -- Serialize publication with cleanup/deletion. The status is checked after these locks are acquired.
 perform 1 from public.user_assets where owner_id=actor and import_batch_id=p_batch_id for update;
 for asset in select value from jsonb_array_elements(p_archive->'assets') loop
   if jsonb_typeof(asset) is distinct from 'object' or exists(select 1 from jsonb_object_keys(asset) k where k not in('id','name','mime_type','size_bytes','sha256')) then raise exception 'INVALID_ARCHIVE_ASSET' using errcode='22023'; end if;
   if not exists(select 1 from public.user_assets a where a.id=(asset->>'id')::uuid and a.owner_id=actor and a.import_batch_id=p_batch_id and a.status='staged'
     and a.sha256=asset->>'sha256' and a.size_bytes=(asset->>'size_bytes')::bigint and a.mime_type=asset->>'mime_type' and a.name=asset->>'name') then raise exception 'ARCHIVE_ASSET_NOT_STAGED' using errcode='23514'; end if;
 end loop;
 if (select count(*) from public.user_assets where owner_id=actor and import_batch_id=p_batch_id)<>jsonb_array_length(p_archive->'assets') then raise exception 'ARCHIVE_ASSET_COUNT_MISMATCH' using errcode='23514'; end if;
 update public.user_assets set status='ready',import_batch_id=null,updated_at=now() where owner_id=actor and import_batch_id=p_batch_id and status='staged';
 get diagnostics promoted_assets=row_count;
 if promoted_assets<>jsonb_array_length(p_archive->'assets') then raise exception 'ARCHIVE_ASSET_PUBLICATION_MISMATCH' using errcode='23514'; end if;
 counts:=counts||jsonb_build_object('reviews',jsonb_array_length(p_archive->'reviews'),'reviewEvents',jsonb_array_length(p_archive->'reviewEvents'),'recallSessions',jsonb_array_length(p_archive->'recallSessions'),'assets',jsonb_array_length(p_archive->'assets'),'deviceRecovery',jsonb_array_length(p_archive->'deviceRecovery'));
 insert into public.workspace_archive_imports(owner_id,batch_id,archive_digest,request_hash,counts,recovery_data)
 values(actor,p_batch_id,p_archive_digest,request_hash,counts,jsonb_build_object('localMath',p_archive->'localMath','deviceRecovery',p_archive->'deviceRecovery','sourceProvenance',p_archive->'sourceProvenance'));
 return counts;
end $$;
revoke all on function public.import_portable_workspace(jsonb,uuid,text) from public,anon;
grant execute on function public.import_portable_workspace(jsonb,uuid,text) to authenticated;
notify pgrst,'reload schema';
