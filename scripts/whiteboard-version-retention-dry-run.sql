-- BinderNotes whiteboard version retention dry-run.
--
-- Safe to run as a SELECT-only report. This does not delete, update, compact,
-- truncate, or archive any whiteboard version rows.
--
-- Retention model preview:
-- - keep manual/checkpoint/snapshot versions
-- - keep active auto versions from the last 7 days
-- - keep the 50 newest active auto versions per board
-- - mark older excess active auto versions as compactable in the migration trigger

with version_payloads as (
  select
    v.whiteboard_id,
    v.id,
    v.version,
    v.created_at,
    coalesce(to_jsonb(v)->>'version_kind', 'auto') as version_kind,
    coalesce(to_jsonb(v)->>'retention_status', 'active') as retention_status,
    (to_jsonb(v)->>'retained_until')::timestamptz as retained_until,
    greatest(
      coalesce(nullif(to_jsonb(v)->>'approximate_payload_bytes', '')::bigint, 0),
      coalesce(v.scene_size_bytes, 0),
      pg_column_size(v.scene_json) + pg_column_size(v.module_elements)
    )::bigint as approx_payload_bytes,
    row_number() over (
      partition by v.whiteboard_id
      order by v.version desc, v.created_at desc, v.id desc
    ) as newest_rank
  from public.whiteboard_versions v
),
classified as (
  select
    *,
    version_kind in ('manual', 'checkpoint', 'snapshot') as protected_checkpoint,
    retention_status = 'active'
      and version_kind = 'auto'
      and created_at < now() - interval '7 days'
      and newest_rank > 50 as would_mark_compactable
  from version_payloads
)
select
  whiteboard_id,
  count(*) as total_versions,
  count(*) filter (where protected_checkpoint) as protected_versions,
  count(*) filter (where retention_status = 'compactable') as already_compactable_versions,
  count(*) filter (where would_mark_compactable) as would_mark_compactable_versions,
  min(created_at) as oldest_version_at,
  max(created_at) as newest_version_at,
  pg_size_pretty(sum(approx_payload_bytes)) as approx_payload_size,
  pg_size_pretty(sum(approx_payload_bytes) filter (where would_mark_compactable)) as dry_run_compactable_size,
  max(approx_payload_bytes) as largest_version_bytes
from classified
group by whiteboard_id
having count(*) > 0
order by sum(approx_payload_bytes) desc nulls last, count(*) desc;
