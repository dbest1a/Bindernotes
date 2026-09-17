-- Inspect actual FK edges instead of assuming all legacy private parents were
-- created with today's ownership checks. Composite owner-key FKs already encode
-- owner equality; this covers the single-column cascading parent relationships.
create function private.account_owned_cascade_edges()
returns table(child_table text,child_key text,child_owner text,parent_table text,parent_key text,parent_owner text,constraint_name text)
language sql stable security definer set search_path='' as $$
 select child.relname::text,ck.attname::text,
  case when exists(select 1 from pg_attribute a where a.attrelid=child.oid and a.attname='owner_id' and not a.attisdropped) then 'owner_id' else 'user_id' end,
  parent.relname::text,pk.attname::text,po.attname::text,fk.conname::text
 from pg_constraint fk join pg_class child on child.oid=fk.conrelid join pg_namespace ns on ns.oid=child.relnamespace
 join pg_class parent on parent.oid=fk.confrelid
 join pg_attribute ck on ck.attrelid=child.oid and ck.attnum=fk.conkey[1]
 join pg_attribute pk on pk.attrelid=parent.oid and pk.attnum=fk.confkey[1]
 join pg_constraint ownership on ownership.conrelid=parent.oid and ownership.confrelid='public.profiles'::regclass
  and ownership.contype='f' and ownership.confdeltype='c' and cardinality(ownership.conkey)=1
 join pg_attribute po on po.attrelid=parent.oid and po.attnum=ownership.conkey[1] and po.attname in('owner_id','user_id')
 where fk.contype='f' and fk.confdeltype='c' and ns.nspname='public' and cardinality(fk.conkey)=1
 and exists(select 1 from pg_attribute a where a.attrelid=child.oid and a.attname in('owner_id','user_id') and not a.attisdropped);
$$;
revoke all on function private.account_owned_cascade_edges() from public,anon,authenticated;
create function private.account_has_foreign_cascade_children(p_owner uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare edge record; dependency boolean;
begin
 for edge in select * from private.account_owned_cascade_edges() loop
  execute format('select exists(select 1 from public.%I child join public.%I parent on child.%I=parent.%I where parent.%I=$1 and child.%I is distinct from $1)',
   edge.child_table,edge.parent_table,edge.child_key,edge.parent_key,edge.parent_owner,edge.child_owner) into dependency using p_owner;
  if dependency then return true; end if;
 end loop;
 return false;
end $$;
revoke all on function private.account_has_foreign_cascade_children(uuid) from public,anon,authenticated;
create function private.guard_account_cascade_dependency() returns trigger
language plpgsql security definer set search_path='' as $$
declare source_owner uuid; child_owner uuid; source_id text;
begin
 source_id:=to_jsonb(new)->>TG_ARGV[0];
 if source_id is null then return new; end if;
 child_owner:=nullif(to_jsonb(new)->>TG_ARGV[1],'')::uuid;
 execute format('select %I from public.%I where %I::text=$1 for share',TG_ARGV[4],TG_ARGV[2],TG_ARGV[3]) into source_owner using source_id;
 if source_owner is not null and source_owner is distinct from child_owner then
  perform pg_advisory_xact_lock_shared(hashtextextended(source_owner::text||':account',3501));
  if exists(select 1 from private.account_deletions where owner_id=source_owner) then
   raise exception 'SHARED_SOURCE_ACCOUNT_DELETING' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_account_cascade_dependency() from public,anon,authenticated;
do $$ declare edge record; definition text; patched text; begin
 for edge in select * from private.account_owned_cascade_edges() loop
  execute format('create trigger %I before insert or update of %I,%I on public.%I for each row execute function private.guard_account_cascade_dependency(%L,%L,%L,%L,%L)',
   'account_cascade_guard_'||substr(md5(edge.child_table||edge.constraint_name),1,16),edge.child_key,edge.child_owner,edge.child_table,
   edge.child_key,edge.child_owner,edge.parent_table,edge.parent_key,edge.parent_owner);
 end loop;
 select pg_get_functiondef('public.account_deletion_requires_transfer(uuid)'::regprocedure) into definition;
 patched:=replace(definition,'begin','begin if private.account_has_foreign_cascade_children(p_owner) then return true; end if;');
 if patched=definition then raise exception 'ACCOUNT_CASCADE_DELETE_GUARD_DRIFT'; end if;
 execute patched;
end $$;
notify pgrst,'reload schema';
