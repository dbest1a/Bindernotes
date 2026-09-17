-- A revoked JWT can ask only whether its own server session still exists. It
-- cannot recover private rows; clients use this to stop rendering stale caches.
create function public.get_account_session_status() returns text
language sql stable security definer set search_path='' as $$
 select case when not exists(select 1 from public.profiles p join auth.sessions s on s.user_id=p.id
   where p.id=auth.uid() and s.id::text=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')) then 'revoked'
 when exists(select 1 from private.account_deletions where owner_id=auth.uid()) then 'deleting'
 else 'active' end;
$$;
revoke all on function public.get_account_session_status() from public,anon;
grant execute on function public.get_account_session_status() to authenticated;
notify pgrst,'reload schema';
