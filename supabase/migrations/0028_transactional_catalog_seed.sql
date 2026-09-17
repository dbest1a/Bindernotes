-- One trusted call, one transaction. Browser users (including operators) cannot
-- invoke this function; only a backend holding the service role may seed.
create or replace function public.apply_catalog_seed(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  seed_tables text[] := array['suite_templates','folders','binders','binder_lessons','folder_binders',
    'concept_nodes','concept_edges','workspace_presets','history_event_templates','history_source_templates',
    'history_myth_check_templates','math_courses','math_topics','math_modules','question_bank','question_choices','seed_versions'];
  seed_table text; row_value jsonb; column_list text; updates text; conflict_columns text;
  counts jsonb := '{}'::jsonb; row_count integer;
begin
  if current_user <> 'service_role' then raise exception 'TRUSTED_BACKEND_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>26214400
    or exists(select 1 from jsonb_object_keys(p_payload) k where not k=any(seed_tables)) then
    raise exception 'INVALID_SEED_PAYLOAD' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(28001,1);
  foreach seed_table in array seed_tables loop
    if not p_payload ? seed_table then continue; end if;
    if jsonb_typeof(p_payload->seed_table) is distinct from 'array' then
      raise exception 'INVALID_SEED_ROWS' using errcode='22023'; end if;
    conflict_columns := case seed_table
      when 'folder_binders' then 'owner_id,folder_id,binder_id'
      when 'workspace_presets' then 'suite_template_id,preset_id,breakpoint'
      when 'seed_versions' then 'suite_template_id,version' else 'id' end;
    row_count := 0;
    for row_value in select value from jsonb_array_elements(p_payload->seed_table) loop
      if jsonb_typeof(row_value) is distinct from 'object' or row_value = '{}'::jsonb then
        raise exception 'INVALID_SEED_ROW' using errcode='22023'; end if;
      if exists(select 1 from jsonb_object_keys(row_value) k where not exists(
        select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=seed_table and c.column_name=k)) then
        raise exception 'UNKNOWN_SEED_COLUMN' using errcode='22023'; end if;
      select string_agg(format('%I',k),',' order by k),
        string_agg(format('%I=excluded.%I',k,k),',' order by k) filter(where not k=any(string_to_array(conflict_columns,',')))
        into column_list,updates from jsonb_object_keys(row_value) k;
      execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I,$1) on conflict (%3$s) do %4$s',
        seed_table,column_list,conflict_columns,case when updates is null then 'nothing' else 'update set '||updates end) using row_value;
      row_count := row_count+1;
    end loop;
    counts := counts || jsonb_build_object(seed_table,row_count);
  end loop;
  return counts;
end;
$$;
revoke all on function public.apply_catalog_seed(jsonb) from public,anon,authenticated;
grant execute on function public.apply_catalog_seed(jsonb) to service_role;
notify pgrst, 'reload schema';
