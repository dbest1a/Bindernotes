-- Revocation is checked against real GoTrue sessions, not only a JWT expiry.
create table private.account_deletions (
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 operation_id uuid not null, started_at timestamptz not null default now()
);
revoke all on private.account_deletions from public,anon,authenticated;
create function private.account_session_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join auth.sessions s on s.user_id=p.id
   where p.id=auth.uid() and s.id::text=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id'))
 and not exists(select 1 from private.account_deletions where owner_id=auth.uid());
$$;
revoke all on function private.account_session_active() from public,anon;
grant execute on function private.account_session_active() to authenticated;
create function private.require_active_account() returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock_shared(hashtextextended(auth.uid()::text||':account',3501));
 if not private.account_session_active() then raise exception 'ACCOUNT_SESSION_REVOKED' using errcode='42501'; end if;
end $$;
revoke all on function private.require_active_account() from public,anon,authenticated;
create function private.guard_account_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.role()='authenticated' then perform private.require_active_account(); end if;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
revoke all on function private.guard_account_write() from public,anon,authenticated;
-- Restrictive policies combine with every existing ownership/catalog policy.
-- Triggers cover SECURITY DEFINER mutation RPCs as well as direct table writes.
do $$ declare entry record; begin
 for entry in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where c.relkind='r' and c.relrowsecurity and (n.nspname='public' or (n.nspname='storage' and c.relname='objects')) loop
   execute format('create policy account_session_required on %I.%I as restrictive for all to authenticated using ((select private.account_session_active())) with check ((select private.account_session_active()))',entry.nspname,entry.relname);
   execute format('create trigger account_session_write_guard before insert or update or delete on %I.%I for each row execute function private.guard_account_write()',entry.nspname,entry.relname);
 end loop;
end $$;
-- Preserve each existing function's body/ACL/signature while adding the explicit
-- guard before even the idempotent-read return path. Reject unexpected drift.
do $$ declare entry record; patched text; seen integer:=0; begin
 for entry in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   join pg_language l on l.oid=p.prolang where n.nspname='public' and p.prosecdef and l.lanname='plpgsql'
   and p.proname=any(array['save_personal_content','save_whiteboard_snapshot','restore_whiteboard_version','set_personal_trash','save_review_item','save_review_session','reserve_user_asset','mark_user_asset_deleting','import_portable_workspace']) loop
   patched:=regexp_replace(entry.prosrc,'\mBEGIN\M','begin perform private.require_active_account();','i');
   if patched=entry.prosrc then raise exception 'ACCOUNT_GUARD_FUNCTION_DRIFT'; end if;
   execute replace(pg_get_functiondef(entry.oid),entry.prosrc,patched); seen:=seen+1;
 end loop;
 if seen<>9 then raise exception 'ACCOUNT_GUARD_FUNCTION_COUNT: %',seen; end if;
end $$;

create function public.account_deletion_state(p_owner uuid) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from private.account_deletions where owner_id=p_owner);
$$;
revoke all on function public.account_deletion_state(uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_state(uuid) to service_role;
create function public.begin_account_deletion(p_owner uuid,p_operation uuid,p_customer text,p_lease uuid) returns void
language plpgsql security definer set search_path='' as $$
declare account public.billing_accounts; role_name text;
begin
 if p_owner is null or p_operation is null then raise exception 'INVALID_ACCOUNT_DELETION'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':account',3501));
 select role into role_name from public.profiles where id=p_owner;
 if not found or role_name='admin' then raise exception 'ACCOUNT_DELETION_NOT_ALLOWED'; end if;
 if exists(select 1 from private.account_deletions where owner_id=p_owner) then return; end if;
 select * into account from public.billing_accounts where user_id=p_owner for update;
 if found then
   if account.customer_id is distinct from p_customer or p_lease is null or account.lease_token is distinct from p_lease
     or account.lease_event_id is distinct from 'account-delete:'||p_operation::text
     or account.lease_expires_at is null or account.lease_expires_at<=clock_timestamp() then raise exception 'BILLING_LEASE_LOST'; end if;
 elsif p_customer is not null then raise exception 'BILLING_ACCOUNT_CHANGED'; end if;
 insert into private.account_deletions(owner_id,operation_id) values(p_owner,p_operation);
end $$;
revoke all on function public.begin_account_deletion(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.begin_account_deletion(uuid,uuid,text,uuid) to service_role;

-- All three paths share the owner lock. Deletion cannot cross a checkout lease,
-- and no new checkout/customer binding can start after the permanent marker.
create or replace function public.bind_billing_customer(p_owner uuid,p_customer text) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':account',3501));
 if exists(select 1 from private.account_deletions where owner_id=p_owner) then raise exception 'ACCOUNT_DELETING'; end if;
 insert into public.billing_accounts(user_id,customer_id) values(p_owner,p_customer) on conflict(user_id) do nothing;
 select customer_id into result from public.billing_accounts where user_id=p_owner; return result;
end $$;
create or replace function public.claim_billing_event(p_customer text,p_event text,p_token uuid) returns text
language plpgsql security definer set search_path='' as $$
declare account public.billing_accounts; owner uuid;
begin
 if p_token is null then raise exception 'BILLING_INVALID_LEASE'; end if;
 select user_id into owner from public.billing_accounts where customer_id=p_customer;
 if not found then return 'unmapped'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text||':account',3501));
 if exists(select 1 from private.account_deletions where owner_id=owner) then return 'busy'; end if;
 select * into account from public.billing_accounts where customer_id=p_customer for update;
 if not found then return 'unmapped'; end if;
 if exists(select 1 from public.billing_events where customer_id=p_customer and event_id=p_event and processed_at is not null) then return 'complete'; end if;
 if account.lease_token is not null and account.lease_expires_at>clock_timestamp() then return 'busy'; end if;
 insert into public.billing_events(customer_id,event_id) values(p_customer,p_event) on conflict do nothing;
 update public.billing_accounts set lease_token=p_token,lease_event_id=p_event,lease_expires_at=clock_timestamp()+interval '90 seconds' where user_id=account.user_id;
 return 'claimed';
end $$;
notify pgrst,'reload schema';
