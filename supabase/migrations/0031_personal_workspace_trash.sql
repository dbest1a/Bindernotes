-- Trash keeps complete trees and their original relationships indefinitely.
-- Only an explicit owner RPC may permanently delete an already trashed item.
alter table public.personal_note_folders add column if not exists archived_at timestamptz;
alter table public.personal_note_binders add column if not exists archived_at timestamptz;
revoke delete on public.personal_note_folders,public.personal_note_binders,public.personal_note_documents,public.personal_notes from authenticated;

create or replace function public.set_personal_trash(p_kind text,p_id uuid,p_action text,p_confirmation text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); target_table text; item jsonb; parent_archived boolean:=false;
begin
  if actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501'; end if;
  target_table:=case p_kind when 'folder' then 'personal_note_folders' when 'binder' then 'personal_note_binders'
    when 'document' then 'personal_note_documents' when 'note' then 'personal_notes' else null end;
  if target_table is null or p_action not in ('trash','restore','delete') or p_action is null then
    raise exception 'INVALID_TRASH_OPERATION' using errcode='22023'; end if;
  -- Owner-wide serialization prevents a course delete racing a child restore.
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':personal-trash',0));
  execute format('select to_jsonb(t) from public.%I t where id=$1 and owner_id=$2 for update',target_table) into item using p_id,actor;
  if item is null then raise exception 'TRASH_ITEM_NOT_FOUND' using errcode='42501'; end if;
  if p_action='restore' then
    if item->>'folder_id' is not null then
      select archived_at is not null into parent_archived from public.personal_note_folders where id=(item->>'folder_id')::uuid and owner_id=actor;
    end if;
    if not coalesce(parent_archived,false) and item->>'binder_id' is not null then
      select b.archived_at is not null or f.archived_at is not null into parent_archived
        from public.personal_note_binders b left join public.personal_note_folders f on f.id=b.folder_id
        where b.id=(item->>'binder_id')::uuid and b.owner_id=actor;
    end if;
    if not coalesce(parent_archived,false) and item->>'document_id' is not null then
      select d.archived_at is not null or b.archived_at is not null or f.archived_at is not null into parent_archived
        from public.personal_note_documents d join public.personal_note_binders b on b.id=d.binder_id
        left join public.personal_note_folders f on f.id=b.folder_id where d.id=(item->>'document_id')::uuid and d.owner_id=actor;
    end if;
    if coalesce(parent_archived,false) then raise exception 'TRASH_PARENT_ARCHIVED: Restore the containing folder or course first.' using errcode='23514'; end if;
  end if;
  if p_action='delete' then
    if item->>'archived_at' is null then raise exception 'TRASH_FIRST_REQUIRED' using errcode='23514'; end if;
    if p_confirmation is distinct from 'DELETE' then raise exception 'EXPLICIT_DELETE_CONFIRMATION_REQUIRED' using errcode='22023'; end if;
    -- Delete the whole explicitly selected subtree. A normal trash/restore never
    -- changes child archive flags, so separately trashed children stay trashed.
    if p_kind='folder' then
      delete from public.personal_notes n where n.owner_id=actor and (n.folder_id=p_id
        or n.binder_id in (select id from public.personal_note_binders where folder_id=p_id and owner_id=actor)
        or n.document_id in (select d.id from public.personal_note_documents d join public.personal_note_binders b on b.id=d.binder_id where b.folder_id=p_id and b.owner_id=actor));
      delete from public.personal_note_binders where folder_id=p_id and owner_id=actor;
    elsif p_kind='binder' then
      delete from public.personal_notes n where n.owner_id=actor and (n.binder_id=p_id
        or n.document_id in (select id from public.personal_note_documents where binder_id=p_id and owner_id=actor));
    elsif p_kind='document' then
      delete from public.personal_notes where document_id=p_id and owner_id=actor;
    end if;
    execute format('delete from public.%I where id=$1 and owner_id=$2',target_table) using p_id,actor;
    return jsonb_build_object('id',p_id,'kind',p_kind,'deleted',true);
  end if;
  execute format('update public.%I set archived_at=case when $3 then coalesce(archived_at,now()) else null end,updated_at=now() where id=$1 and owner_id=$2 returning to_jsonb(%I)',target_table,target_table)
    into item using p_id,actor,p_action='trash';
  return item;
end $$;
revoke all on function public.set_personal_trash(text,uuid,text,text) from public,anon;
grant execute on function public.set_personal_trash(text,uuid,text,text) to authenticated;

create or replace function public.list_personal_trash()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(items order by items.archived_at desc),'[]'::jsonb) from (
    select 'folder'::text kind,id,name title,archived_at from public.personal_note_folders where owner_id=auth.uid() and archived_at is not null
    union all select 'binder',id,title,archived_at from public.personal_note_binders where owner_id=auth.uid() and archived_at is not null
    union all select 'document',id,title,archived_at from public.personal_note_documents where owner_id=auth.uid() and archived_at is not null
    union all select 'note',id,title,archived_at from public.personal_notes where owner_id=auth.uid() and archived_at is not null
  ) items;
$$;
revoke all on function public.list_personal_trash() from public,anon;
grant execute on function public.list_personal_trash() to authenticated;
