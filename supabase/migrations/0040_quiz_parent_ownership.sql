-- A private quiz attempt must belong to the quiz owner. Null-owner catalog
-- quizzes remain available to every learner. Existing foreign attempts are not
-- silently deleted or rewritten during this migration.
create function private.guard_quiz_attempt_parent() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent_owner uuid;
begin
 select user_id into parent_owner from public.quiz_sets where id=new.quiz_set_id for share;
 if parent_owner is not null and parent_owner is distinct from new.user_id then
  raise exception 'PRIVATE_PARENT_OWNERSHIP' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.guard_quiz_attempt_parent() from public,anon,authenticated;
create trigger quiz_attempts_private_parent before insert or update of quiz_set_id,user_id
 on public.quiz_attempts for each row execute function private.guard_quiz_attempt_parent();

create function private.guard_quiz_owner_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.user_id is not null and exists(select 1 from public.quiz_attempts where quiz_set_id=new.id and user_id is distinct from new.user_id) then
  raise exception 'QUIZ_SHARED_ATTEMPTS_REQUIRE_TRANSFER' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.guard_quiz_owner_change() from public,anon,authenticated;
create trigger quiz_owner_change_guard before update of user_id on public.quiz_sets
 for each row when(old.user_id is distinct from new.user_id) execute function private.guard_quiz_owner_change();

-- Legacy attempts that predate the parent guard must also stop an Auth cascade.
-- No new cross-owner attachment is permitted by the trigger above, including
-- privileged background writes, so the same race cannot be reintroduced.
do $$ declare definition text; patched text; begin
 select pg_get_functiondef('public.account_deletion_requires_transfer(uuid)'::regprocedure) into definition;
 patched:=replace(definition,'begin',
  'begin if exists(select 1 from public.quiz_sets q join public.quiz_attempts a on a.quiz_set_id=q.id where q.user_id=p_owner and a.user_id is distinct from p_owner) then return true; end if;');
 if patched=definition then raise exception 'ACCOUNT_QUIZ_DELETE_GUARD_DRIFT'; end if;
 execute patched;
end $$;
notify pgrst,'reload schema';
