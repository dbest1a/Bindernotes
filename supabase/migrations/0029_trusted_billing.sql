-- Provider IDs and delivery receipts stay behind service-only RPCs.
create table public.billing_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  customer_id text not null unique check(customer_id ~ '^cus_[a-zA-Z0-9]+$'),
  lease_token uuid,
  lease_event_id text,
  lease_expires_at timestamptz
);
create table public.billing_events (
  customer_id text not null references public.billing_accounts(customer_id) on delete cascade,
  event_id text not null check(length(event_id) between 1 and 200),
  processed_at timestamptz,
  primary key(customer_id,event_id)
);
alter table public.billing_accounts enable row level security;
alter table public.billing_events enable row level security;
revoke all on public.billing_accounts, public.billing_events from public, anon, authenticated;
grant all on public.billing_accounts, public.billing_events to service_role;

create function public.bind_billing_customer(p_owner uuid,p_customer text) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
  insert into public.billing_accounts(user_id,customer_id) values(p_owner,p_customer)
    on conflict(user_id) do nothing;
  select customer_id into result from public.billing_accounts where user_id=p_owner;
  return result;
end $$;

create function public.claim_billing_event(p_customer text,p_event text,p_token uuid) returns text
language plpgsql security definer set search_path='' as $$
declare account public.billing_accounts;
begin
  if p_token is null then raise exception 'BILLING_INVALID_LEASE'; end if;
  select * into account from public.billing_accounts where customer_id=p_customer for update;
  if not found then return 'unmapped'; end if;
  if exists(select 1 from public.billing_events where customer_id=p_customer and event_id=p_event and processed_at is not null) then return 'complete'; end if;
  if account.lease_token is not null and account.lease_expires_at > clock_timestamp() then return 'busy'; end if;
  insert into public.billing_events(customer_id,event_id) values(p_customer,p_event) on conflict do nothing;
  update public.billing_accounts set lease_token=p_token,lease_event_id=p_event,lease_expires_at=clock_timestamp()+interval '90 seconds' where user_id=account.user_id;
  return 'claimed';
end $$;

create function public.finish_billing_event(p_customer text,p_event text,p_token uuid,p_entitlement jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare account public.billing_accounts;
begin
  select * into account from public.billing_accounts where customer_id=p_customer for update;
  if not found or p_token is null or account.lease_token is null or account.lease_expires_at is null
    or account.lease_token is distinct from p_token or account.lease_event_id is distinct from p_event
    or account.lease_expires_at <= clock_timestamp() then raise exception 'BILLING_LEASE_LOST'; end if;
  if not exists(select 1 from public.billing_events where customer_id=p_customer and event_id=p_event and processed_at is null) then raise exception 'BILLING_EVENT_NOT_CLAIMED'; end if;
  if p_entitlement is not null then
    if jsonb_typeof(p_entitlement)<>'object' or not(p_entitlement ?& array['plan','status','validUntil'])
      or p_entitlement->>'plan' not in ('free','plus','studio','everything')
      or p_entitlement->>'status' not in ('active','inactive')
      or (p_entitlement->>'status'='active' and (p_entitlement->>'plan'='free' or p_entitlement->>'validUntil' is null))
      then raise exception 'BILLING_INVALID_ENTITLEMENT'; end if;
    insert into public.account_entitlements(user_id,plan,status,valid_until,source,updated_at)
      values(account.user_id,p_entitlement->>'plan',p_entitlement->>'status',(p_entitlement->>'validUntil')::timestamptz,'stripe',now())
      on conflict(user_id) do update set plan=excluded.plan,status=excluded.status,valid_until=excluded.valid_until,source=excluded.source,updated_at=excluded.updated_at;
  end if;
  if p_entitlement is null then
    -- Checkout retries reacquire the same per-customer lease; Stripe's request key
    -- and open-session lookup recover an uncertain response without a second charge.
    delete from public.billing_events where customer_id=p_customer and event_id=p_event;
  else
    update public.billing_events set processed_at=clock_timestamp() where customer_id=p_customer and event_id=p_event;
  end if;
  update public.billing_accounts set lease_token=null,lease_event_id=null,lease_expires_at=null where user_id=account.user_id;
end $$;

create function public.release_billing_lease(p_customer text,p_token uuid) returns void
language sql security definer set search_path='' as $$
  update public.billing_accounts set lease_token=null,lease_event_id=null,lease_expires_at=null where customer_id=p_customer and lease_token=p_token;
$$;
revoke all on function public.bind_billing_customer(uuid,text),public.claim_billing_event(text,text,uuid),public.finish_billing_event(text,text,uuid,jsonb),public.release_billing_lease(text,uuid) from public,anon,authenticated;
grant execute on function public.bind_billing_customer(uuid,text),public.claim_billing_event(text,text,uuid),public.finish_billing_event(text,text,uuid,jsonb),public.release_billing_lease(text,uuid) to service_role;
