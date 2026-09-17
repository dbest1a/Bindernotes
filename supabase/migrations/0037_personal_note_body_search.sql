-- Return bounded identities only. Bodies remain server-side until a note is opened.
create function public.search_personal_notes(p_query text,p_offset integer default 0,p_limit integer default 200)
returns table(kind text,id text)
language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); needle text:=lower(btrim(p_query));
begin
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_query is null or length(p_query)>200 or p_offset is null or p_offset<0 or p_offset>10000
   or p_limit is null or p_limit<1 or p_limit>200 then raise exception 'INVALID_SEARCH_PAGE' using errcode='22023'; end if;
 if needle='' then return; end if;
 return query
 with active_folders as (
   select f.id from public.personal_note_folders f where f.owner_id=actor and f.archived_at is null
 ), active_binders as (
   select b.id from public.personal_note_binders b where b.owner_id=actor and b.archived_at is null
     and (b.folder_id is null or b.folder_id in(select f.id from active_folders f))
 ), active_documents as (
   select d.* from public.personal_note_documents d where d.owner_id=actor and d.archived_at is null
     and d.binder_id in(select b.id from active_binders b)
 ), notes as (
   select 'personal-note'::text as kind,n.id::text,n.title,n.content,n.math_blocks,n.tags
   from public.personal_notes n where n.owner_id=actor and n.archived_at is null
     and (n.folder_id is null or n.folder_id in(select f.id from active_folders f))
     and (n.binder_id is null or n.binder_id in(select b.id from active_binders b))
     and (n.document_id is null or n.document_id in(select d.id from active_documents d))
   union all
   select 'personal-document',d.id::text,d.title,d.content,d.math_blocks,d.tags from active_documents d
   union all
   select 'binder-note',n.id,n.title,n.content,n.math_blocks,array[]::text[] from public.learner_notes n where n.owner_id=actor
 )
 select n.kind,n.id from notes n
 where strpos(lower(concat_ws(' ',n.title,array_to_string(n.tags,' '),
   (select string_agg(v#>>'{}',' ') from jsonb_path_query(n.content,'$.**.text') v),
   (select string_agg(v#>>'{}',' ') from jsonb_path_query(n.math_blocks,'$.**.latex') v),
   (select string_agg(v#>>'{}',' ') from jsonb_path_query(n.math_blocks,'$.**.expressions[*]') v))),needle)>0
 order by n.kind,n.id offset p_offset limit p_limit;
end $$;
revoke all on function public.search_personal_notes(text,integer,integer) from public,anon;
grant execute on function public.search_personal_notes(text,integer,integer) to authenticated;
notify pgrst,'reload schema';
