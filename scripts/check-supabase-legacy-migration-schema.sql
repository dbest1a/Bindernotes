with checks(version, check_name, ok) as (
  values
    (
      '0001',
      'profiles table',
      to_regclass('public.profiles') is not null
    ),
    (
      '0001',
      'binders table',
      to_regclass('public.binders') is not null
    ),
    (
      '0001',
      'binder_lessons table',
      to_regclass('public.binder_lessons') is not null
    ),
    (
      '0001',
      'folders table',
      to_regclass('public.folders') is not null
    ),
    (
      '0001',
      'learner_notes table',
      to_regclass('public.learner_notes') is not null
    ),
    (
      '0001',
      'comments table',
      to_regclass('public.comments') is not null
    ),
    (
      '0001',
      'highlights table',
      to_regclass('public.highlights') is not null
    ),
    (
      '0001',
      'workspace_preferences table',
      to_regclass('public.workspace_preferences') is not null
    ),
    (
      '0001',
      'is_admin function',
      to_regprocedure('public.is_admin()') is not null
    ),
    (
      '0001',
      'profiles read own or admin policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'profiles'
          and policyname = 'profiles read own or admin'
      )
    ),
    (
      '0001',
      'learner notes own policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'learner_notes'
          and policyname = 'learner notes own'
      )
    ),
    (
      '0001',
      'highlights own policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'highlights'
          and policyname = 'highlights own'
      )
    ),
    (
      '0002',
      'highlights color check includes blue and orange',
      exists (
        select 1
        from pg_constraint
        where conname = 'highlights_color_check'
          and conrelid = to_regclass('public.highlights')
          and pg_get_constraintdef(oid) like '%blue%'
          and pg_get_constraintdef(oid) like '%orange%'
      )
    ),
    (
      '0002',
      'folder_binders table',
      to_regclass('public.folder_binders') is not null
    ),
    (
      '0002',
      'folder_binders owner folder index',
      to_regclass('public.folder_binders_owner_folder_idx') is not null
    ),
    (
      '0002',
      'folder binders own policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'folder_binders'
          and policyname = 'folder binders own'
      )
    ),
    (
      '0003',
      'highlights start_offset column',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'highlights'
          and column_name = 'start_offset'
      )
    ),
    (
      '0003',
      'highlights end_offset column',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'highlights'
          and column_name = 'end_offset'
      )
    ),
    (
      '0003',
      'highlights offsets check',
      exists (
        select 1
        from pg_constraint
        where conname = 'highlights_offsets_check'
          and conrelid = to_regclass('public.highlights')
      )
    ),
    (
      '0003',
      'highlights lesson offsets index',
      to_regclass('public.highlights_lesson_offsets_idx') is not null
    ),
    (
      '0004',
      'profiles insert own policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'profiles'
          and policyname = 'profiles insert own'
      )
    ),
    (
      '0004',
      'comments own policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'comments'
          and policyname = 'comments own'
      )
    ),
    (
      '0005',
      'binders text id',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'binders'
          and column_name = 'id'
          and data_type = 'text'
      )
    ),
    (
      '0005',
      'binder_lessons text id',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'binder_lessons'
          and column_name = 'id'
          and data_type = 'text'
      )
    ),
    (
      '0005',
      'learner_notes text lesson_id',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'learner_notes'
          and column_name = 'lesson_id'
          and data_type = 'text'
      )
    ),
    (
      '0005',
      'folder_binders text binder_id',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'folder_binders'
          and column_name = 'binder_id'
          and data_type = 'text'
      )
    ),
    (
      '0005',
      'owns published or enrolled text function',
      to_regprocedure('public.owns_published_or_enrolled(text)') is not null
    ),
    (
      '0005',
      'folder binders own policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'folder_binders'
          and policyname = 'folder binders own'
      )
    ),
    (
      '0006',
      'suite_templates table',
      to_regclass('public.suite_templates') is not null
    ),
    (
      '0006',
      'seed_versions table',
      to_regclass('public.seed_versions') is not null
    ),
    (
      '0006',
      'workspace_presets table',
      to_regclass('public.workspace_presets') is not null
    ),
    (
      '0006',
      'history_event_templates table',
      to_regclass('public.history_event_templates') is not null
    ),
    (
      '0006',
      'history_events table',
      to_regclass('public.history_events') is not null
    ),
    (
      '0006',
      'history_myth_checks table',
      to_regclass('public.history_myth_checks') is not null
    ),
    (
      '0006',
      'binders suite_template_id column',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'binders'
          and column_name = 'suite_template_id'
      )
    ),
    (
      '0006',
      'highlights selector_json column',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'highlights'
          and column_name = 'selector_json'
      )
    ),
    (
      '0006',
      'can read suite template function',
      to_regprocedure('public.can_read_suite_template(text)') is not null
    ),
    (
      '0006',
      'suite templates readable policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'suite_templates'
          and policyname = 'suite templates readable when published'
      )
    ),
    (
      '0006',
      'history events own policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'history_events'
          and policyname = 'history events own'
      )
    ),
    (
      '0007',
      'folders source column',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'folders'
          and column_name = 'source'
      )
    ),
    (
      '0007',
      'folders suite_template_id column',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'folders'
          and column_name = 'suite_template_id'
      )
    ),
    (
      '0007',
      'folders source suite index',
      to_regclass('public.folders_source_suite_idx') is not null
    ),
    (
      '0007',
      'system folders readable policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'folders'
          and policyname = 'system folders readable'
      )
    ),
    (
      '0007',
      'system folder binders readable policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'folder_binders'
          and policyname = 'system folder binders readable'
      )
    ),
    (
      '0008',
      'seed versions readable policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'seed_versions'
          and policyname = 'seed versions readable when suite published'
      )
    ),
    (
      '0008',
      'seed versions admin write policy',
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'seed_versions'
          and policyname = 'seed versions admin write'
      )
    )
),
rollup as (
  select
    version,
    bool_and(ok) as complete,
    bool_or(ok) as any_present,
    coalesce(
      string_agg(check_name, ', ' order by check_name) filter (where not ok),
      ''
    ) as missing_checks
  from checks
  group by version
)
select
  version,
  case
    when complete then 'complete'
    when any_present then 'partial'
    else 'absent'
  end as schema_state,
  missing_checks
from rollup
order by version;
