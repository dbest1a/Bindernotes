-- READ ONLY. Never infer which 0016 ran from its version alone.
select version,name,cardinality(statements) as recorded_statement_count
from supabase_migrations.schema_migrations order by version;

with checks(component,object_name,present) as (values
  ('0016_dashboard','folders.sort_order',exists(select 1 from information_schema.columns where table_schema='public' and table_name='folders' and column_name='sort_order')),
  ('0016_dashboard','binders.dashboard_sort_order',exists(select 1 from information_schema.columns where table_schema='public' and table_name='binders' and column_name='dashboard_sort_order')),
  ('0016_dashboard','folder_binders.sort_order',exists(select 1 from information_schema.columns where table_schema='public' and table_name='folder_binders' and column_name='sort_order')),
  ('0016_dashboard','folders_owner_sort_order_idx',to_regclass('public.folders_owner_sort_order_idx') is not null),
  ('0016_dashboard','binders_dashboard_sort_order_idx',to_regclass('public.binders_dashboard_sort_order_idx') is not null),
  ('0016_dashboard','folder_binders_owner_folder_sort_order_idx',to_regclass('public.folder_binders_owner_folder_sort_order_idx') is not null),
  ('0016_personal','personal_note_folders',to_regclass('public.personal_note_folders') is not null),
  ('0016_personal','personal_note_binders',to_regclass('public.personal_note_binders') is not null),
  ('0016_personal','personal_note_documents',to_regclass('public.personal_note_documents') is not null),
  ('0016_personal','personal_notes',to_regclass('public.personal_notes') is not null),
  ('0016_personal','set_personal_notes_updated_at()',to_regprocedure('public.set_personal_notes_updated_at()') is not null)
)
select component,case when bool_and(present) then 'objects-present-review-history'
  when bool_or(present) then 'PARTIAL-BLOCKED' else 'absent' end as diagnostic,
  string_agg(object_name,', ' order by object_name) filter(where not present) as missing
from checks group by component order by component;

-- Object presence is not proof of equivalent policies/columns/statements.
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('personal_notes','personal_note_binders','personal_note_documents','personal_note_folders')
order by tablename,policyname;
