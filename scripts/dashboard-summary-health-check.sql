-- BinderNotes dashboard summary health dry-run.
--
-- Safe to run as a SELECT-only report. It identifies missing, stale, failed,
-- source-newer-than-summary rows, queued refresh jobs, and count drift without
-- mutating summary tables or exposing private note content.

with expected_folder_summaries as (
  select
    'missing_dashboard_folder_summary'::text as finding_type,
    f.id as subject_id,
    f.owner_id,
    'rebuild_dashboard_folder_summary'::text as suggested_job_type,
    jsonb_build_object(
      'folder_updated_at', f.updated_at
    ) as details
  from public.folders f
  left join public.dashboard_folder_summaries dfs on dfs.folder_id = f.id
  where dfs.folder_id is null
),
expected_binder_summaries as (
  select
    'missing_dashboard_binder_summary'::text as finding_type,
    b.id as subject_id,
    b.owner_id,
    'rebuild_dashboard_binder_summary'::text as suggested_job_type,
    jsonb_build_object(
      'binder_status', b.status,
      'binder_updated_at', b.updated_at
    ) as details
  from public.binders b
  left join public.dashboard_binder_summaries dbs on dbs.binder_id = b.id
  where dbs.binder_id is null
),
expected_lesson_summaries as (
  select
    'missing_dashboard_lesson_summary'::text as finding_type,
    bl.id as subject_id,
    b.owner_id,
    'rebuild_lesson_search_excerpt'::text as suggested_job_type,
    jsonb_build_object(
      'binder_id', bl.binder_id,
      'lesson_updated_at', bl.updated_at
    ) as details
  from public.binder_lessons bl
  join public.binders b on b.id = bl.binder_id
  left join public.dashboard_lesson_summaries dls on dls.lesson_id = bl.id
  where dls.lesson_id is null
),
expected_admin_summaries as (
  select
    'missing_admin_binder_summary'::text as finding_type,
    b.id as subject_id,
    b.owner_id,
    'rebuild_admin_binder_summary'::text as suggested_job_type,
    jsonb_build_object(
      'binder_status', b.status,
      'binder_updated_at', b.updated_at
    ) as details
  from public.binders b
  left join public.admin_binder_summaries abs on abs.binder_id = b.id
  where abs.binder_id is null
),
expected_tutorial_summaries as (
  select
    'missing_tutorial_video_summary'::text as finding_type,
    t.id as subject_id,
    t.created_by as owner_id,
    'refresh_tutorial_video_summary'::text as suggested_job_type,
    jsonb_build_object(
      'tutorial_status', t.status,
      'tutorial_updated_at', t.updated_at
    ) as details
  from public.tutorial_entries t
  left join public.tutorial_video_summaries tvs on tvs.video_id = t.id
  where tvs.video_id is null
),
stale_existing_summaries as (
  select
    'stale_dashboard_folder_summary'::text as finding_type,
    dfs.folder_id as subject_id,
    dfs.owner_id,
    'rebuild_dashboard_folder_summary'::text as suggested_job_type,
    jsonb_build_object(
      'summary_status', coalesce(to_jsonb(dfs)->>'summary_status', 'fresh'),
      'stale_after', to_jsonb(dfs)->>'stale_after',
      'last_refreshed_at', coalesce(to_jsonb(dfs)->>'last_refreshed_at', dfs.refreshed_at::text),
      'refresh_error_code', to_jsonb(dfs)->>'refresh_error_code',
      'refresh_error_message', to_jsonb(dfs)->>'refresh_error_message',
      'source_updated_at', to_jsonb(dfs)->>'source_updated_at',
      'live_source_updated_at', f.updated_at
    ) as details
  from public.dashboard_folder_summaries dfs
  left join public.folders f on f.id = dfs.folder_id
  where f.id is null
    or coalesce(to_jsonb(dfs)->>'summary_status', 'fresh') in ('stale', 'refreshing', 'failed')
    or (to_jsonb(dfs)->>'stale_after')::timestamptz <= now()
    or (
      f.updated_at is not null
      and coalesce(
        (to_jsonb(dfs)->>'source_updated_at')::timestamptz,
        (to_jsonb(dfs)->>'last_refreshed_at')::timestamptz,
        dfs.refreshed_at,
        '-infinity'::timestamptz
      ) < f.updated_at
    )

  union all

  select
    'stale_dashboard_binder_summary',
    dbs.binder_id,
    dbs.owner_id,
    'rebuild_dashboard_binder_summary',
    jsonb_build_object(
      'summary_status', coalesce(to_jsonb(dbs)->>'summary_status', 'fresh'),
      'stale_after', to_jsonb(dbs)->>'stale_after',
      'last_refreshed_at', coalesce(to_jsonb(dbs)->>'last_refreshed_at', dbs.refreshed_at::text),
      'refresh_error_code', to_jsonb(dbs)->>'refresh_error_code',
      'refresh_error_message', to_jsonb(dbs)->>'refresh_error_message',
      'source_updated_at', to_jsonb(dbs)->>'source_updated_at',
      'live_source_updated_at', b.updated_at
    )
  from public.dashboard_binder_summaries dbs
  left join public.binders b on b.id = dbs.binder_id
  where b.id is null
    or coalesce(to_jsonb(dbs)->>'summary_status', 'fresh') in ('stale', 'refreshing', 'failed')
    or (to_jsonb(dbs)->>'stale_after')::timestamptz <= now()
    or (
      b.updated_at is not null
      and coalesce(
        (to_jsonb(dbs)->>'source_updated_at')::timestamptz,
        (to_jsonb(dbs)->>'last_refreshed_at')::timestamptz,
        dbs.refreshed_at,
        '-infinity'::timestamptz
      ) < b.updated_at
    )

  union all

  select
    'stale_dashboard_lesson_summary',
    dls.lesson_id,
    b.owner_id,
    'rebuild_lesson_search_excerpt',
    jsonb_build_object(
      'binder_id', dls.binder_id,
      'summary_status', coalesce(to_jsonb(dls)->>'summary_status', 'fresh'),
      'stale_after', to_jsonb(dls)->>'stale_after',
      'last_refreshed_at', coalesce(to_jsonb(dls)->>'last_refreshed_at', dls.refreshed_at::text),
      'refresh_error_code', to_jsonb(dls)->>'refresh_error_code',
      'refresh_error_message', to_jsonb(dls)->>'refresh_error_message',
      'source_updated_at', to_jsonb(dls)->>'source_updated_at',
      'live_source_updated_at', bl.updated_at
    )
  from public.dashboard_lesson_summaries dls
  left join public.binder_lessons bl on bl.id = dls.lesson_id
  left join public.binders b on b.id = coalesce(bl.binder_id, dls.binder_id)
  where bl.id is null
    or coalesce(to_jsonb(dls)->>'summary_status', 'fresh') in ('stale', 'refreshing', 'failed')
    or (to_jsonb(dls)->>'stale_after')::timestamptz <= now()
    or (
      bl.updated_at is not null
      and coalesce(
        (to_jsonb(dls)->>'source_updated_at')::timestamptz,
        (to_jsonb(dls)->>'last_refreshed_at')::timestamptz,
        dls.refreshed_at,
        '-infinity'::timestamptz
      ) < bl.updated_at
    )

  union all

  select
    'stale_admin_binder_summary',
    abs.binder_id,
    abs.owner_id,
    'rebuild_admin_binder_summary',
    jsonb_build_object(
      'content_health_status', abs.content_health_status,
      'summary_status', coalesce(to_jsonb(abs)->>'summary_status', 'fresh'),
      'stale_after', to_jsonb(abs)->>'stale_after',
      'last_refreshed_at', coalesce(to_jsonb(abs)->>'last_refreshed_at', abs.refreshed_at::text),
      'refresh_error_code', to_jsonb(abs)->>'refresh_error_code',
      'refresh_error_message', to_jsonb(abs)->>'refresh_error_message',
      'source_updated_at', to_jsonb(abs)->>'source_updated_at',
      'live_source_updated_at', b.updated_at
    )
  from public.admin_binder_summaries abs
  left join public.binders b on b.id = abs.binder_id
  where b.id is null
    or coalesce(to_jsonb(abs)->>'summary_status', 'fresh') in ('stale', 'refreshing', 'failed')
    or (to_jsonb(abs)->>'stale_after')::timestamptz <= now()
    or (
      b.updated_at is not null
      and coalesce(
        (to_jsonb(abs)->>'source_updated_at')::timestamptz,
        (to_jsonb(abs)->>'last_refreshed_at')::timestamptz,
        abs.refreshed_at,
        '-infinity'::timestamptz
      ) < b.updated_at
    )

  union all

  select
    'stale_tutorial_video_summary',
    tvs.video_id,
    t.created_by,
    'refresh_tutorial_video_summary',
    jsonb_build_object(
      'summary_status', coalesce(to_jsonb(tvs)->>'summary_status', 'fresh'),
      'status', tvs.status,
      'last_refreshed_at', coalesce(to_jsonb(tvs)->>'last_refreshed_at', tvs.refreshed_at::text),
      'live_source_updated_at', t.updated_at
    )
  from public.tutorial_video_summaries tvs
  left join public.tutorial_entries t on t.id = tvs.video_id
  where t.id is null
    or t.updated_at > tvs.refreshed_at
),
count_drift as (
  select
    'dashboard_binder_document_count_drift'::text as finding_type,
    dbs.binder_id as subject_id,
    dbs.owner_id,
    'rebuild_dashboard_binder_summary'::text as suggested_job_type,
    jsonb_build_object(
      'summary_document_count', dbs.document_count,
      'live_document_count', count(bl.id)::integer
    ) as details
  from public.dashboard_binder_summaries dbs
  left join public.binder_lessons bl on bl.binder_id = dbs.binder_id
  group by dbs.binder_id, dbs.owner_id, dbs.document_count
  having dbs.document_count <> count(bl.id)::integer

  union all

  select
    'admin_binder_document_count_drift',
    abs.binder_id,
    abs.owner_id,
    'rebuild_admin_binder_summary',
    jsonb_build_object(
      'summary_document_count', abs.document_count,
      'live_document_count', count(bl.id)::integer
    )
  from public.admin_binder_summaries abs
  left join public.binder_lessons bl on bl.binder_id = abs.binder_id
  group by abs.binder_id, abs.owner_id, abs.document_count
  having abs.document_count <> count(bl.id)::integer
),
queue_health as (
  select
    case
      when status = 'failed' then 'failed_summary_refresh_job'
      when status = 'processing' then 'processing_summary_refresh_job'
      else 'queued_summary_refresh_job'
    end as finding_type,
    dedupe_key as subject_id,
    owner_id,
    job_type as suggested_job_type,
    jsonb_build_object(
      'status', status,
      'entity_type', entity_type,
      'entity_id', entity_id,
      'attempts', attempts,
      'priority', priority,
      'updated_at', updated_at
    ) as details
  from public.summary_refresh_job_dedupe
  where status in ('pending', 'processing', 'failed')
),
all_findings as (
  select * from expected_folder_summaries
  union all select * from expected_binder_summaries
  union all select * from expected_lesson_summaries
  union all select * from expected_admin_summaries
  union all select * from expected_tutorial_summaries
  union all select * from stale_existing_summaries
  union all select * from count_drift
  union all select * from queue_health
)
select
  finding_type,
  subject_id,
  owner_id,
  suggested_job_type,
  details
from all_findings
order by finding_type, subject_id;
