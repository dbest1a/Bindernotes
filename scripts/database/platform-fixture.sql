-- Disposable PostgreSQL only: the minimal Supabase auth/storage contract.
-- This does not emulate GoTrue, PostgREST or Storage HTTP APIs.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_auth_admin nologin; exception when duplicate_object then null; end $$;
create schema auth;
create schema storage;
create schema extensions;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key, statements text[],name text);
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',current_user);
$$;
grant usage on schema auth,storage to anon,authenticated,service_role;
grant execute on all functions in schema auth to anon,authenticated,service_role;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid);
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to service_role;
