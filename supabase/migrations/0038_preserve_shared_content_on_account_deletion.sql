-- Deleting a creator must never cascade another learner's owned work.
create function public.account_deletion_requires_transfer(p_owner uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare edge record; found_dependency boolean;
begin
 if exists(select 1 from public.profiles where id=p_owner and role='admin') then return true; end if;
 if exists(select 1 from public.binders where owner_id=p_owner and status='published') then return true; end if;
 for edge in
  select n.nspname,c.relname,a.attname child_column,parent.relname parent_table,
   case when exists(select 1 from pg_attribute own where own.attrelid=c.oid and own.attname='owner_id' and not own.attisdropped) then 'owner_id' else 'user_id' end owner_column
  from pg_constraint fk join pg_class c on c.oid=fk.conrelid join pg_namespace n on n.oid=c.relnamespace
  join pg_class parent on parent.oid=fk.confrelid join pg_attribute a on a.attrelid=c.oid and a.attnum=fk.conkey[1]
  where fk.contype='f' and n.nspname='public' and cardinality(fk.conkey)=1
   and fk.confrelid in('public.binders'::regclass,'public.binder_lessons'::regclass)
   and exists(select 1 from pg_attribute own where own.attrelid=c.oid and own.attname in('owner_id','user_id') and not own.attisdropped)
 loop
  execute format('select exists(select 1 from %I.%I child join public.%I parent on child.%I=parent.id %s where %s=$1 and child.%I is distinct from $1)',
   edge.nspname,edge.relname,edge.parent_table,edge.child_column,
   case when edge.parent_table='binder_lessons' then 'join public.binders binder on binder.id=parent.binder_id' else '' end,
   case when edge.parent_table='binder_lessons' then 'binder.owner_id' else 'parent.owner_id' end,edge.owner_column)
   into found_dependency using p_owner;
  if found_dependency then return true; end if;
 end loop;
 return false;
end $$;
revoke all on function public.account_deletion_requires_transfer(uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_requires_transfer(uuid) to service_role;
-- Recheck under the deletion lock, even if the HTTP preflight just checked.
do $$ declare definition text; patched text; begin
 select pg_get_functiondef('public.begin_account_deletion(uuid,uuid,text,uuid)'::regprocedure) into definition;
 patched:=replace(definition,'select role into role_name from public.profiles where id=p_owner;',
  'if public.account_deletion_requires_transfer(p_owner) then raise exception ''ACCOUNT_SHARED_CONTENT_REQUIRES_TRANSFER''; end if; select role into role_name from public.profiles where id=p_owner;');
 if patched=definition then raise exception 'ACCOUNT_DELETE_GUARD_DRIFT'; end if;
 execute patched;
end $$;
notify pgrst,'reload schema';

-- A foreign-owned child attaching while deletion starts takes the source owner's
-- shared account lock. Either it commits first (and the transfer check sees it),
-- or the deletion marker wins and the attachment is refused.
create function private.guard_shared_source_dependency() returns trigger
language plpgsql security definer set search_path='' as $$
declare source_owner uuid; child_owner uuid; source_id text;
begin
 child_owner:=nullif(to_jsonb(new)->>TG_ARGV[2],'')::uuid;
 source_id:=to_jsonb(new)->>TG_ARGV[0];
 if source_id is null then return new; end if;
 if TG_ARGV[1]='binders' then
  select owner_id into source_owner from public.binders where id=source_id;
 else
  select b.owner_id into source_owner from public.binder_lessons l join public.binders b on b.id=l.binder_id where l.id=source_id;
 end if;
 if source_owner is not null and source_owner is distinct from child_owner then
  perform pg_advisory_xact_lock_shared(hashtextextended(source_owner::text||':account',3501));
  if exists(select 1 from private.account_deletions where owner_id=source_owner) then
   raise exception 'SHARED_SOURCE_ACCOUNT_DELETING' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_shared_source_dependency() from public,anon,authenticated;
do $$ declare edge record; begin
 for edge in
  select n.nspname,c.relname,fk.conname,a.attname child_column,parent.relname parent_table,
   case when exists(select 1 from pg_attribute own where own.attrelid=c.oid and own.attname='owner_id' and not own.attisdropped) then 'owner_id' else 'user_id' end owner_column
  from pg_constraint fk join pg_class c on c.oid=fk.conrelid join pg_namespace n on n.oid=c.relnamespace
  join pg_class parent on parent.oid=fk.confrelid join pg_attribute a on a.attrelid=c.oid and a.attnum=fk.conkey[1]
  where fk.contype='f' and n.nspname='public' and cardinality(fk.conkey)=1
   and fk.confrelid in('public.binders'::regclass,'public.binder_lessons'::regclass)
   and exists(select 1 from pg_attribute own where own.attrelid=c.oid and own.attname in('owner_id','user_id') and not own.attisdropped)
 loop
  execute format('create trigger %I before insert or update of %I,%I on %I.%I for each row execute function private.guard_shared_source_dependency(%L,%L,%L)',
   'shared_source_guard_'||substr(md5(edge.relname||edge.conname),1,16),edge.child_column,edge.owner_column,edge.nspname,edge.relname,edge.child_column,edge.parent_table,edge.owner_column);
 end loop;
end $$;
