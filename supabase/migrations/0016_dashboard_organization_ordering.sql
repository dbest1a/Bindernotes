alter table public.folders
  add column if not exists sort_order integer;

alter table public.binders
  add column if not exists dashboard_sort_order integer;

alter table public.folder_binders
  add column if not exists sort_order integer;

create index if not exists folders_owner_sort_order_idx
  on public.folders(owner_id, sort_order nulls last, updated_at desc);

create index if not exists binders_dashboard_sort_order_idx
  on public.binders(dashboard_sort_order nulls last, updated_at desc);

create index if not exists folder_binders_owner_folder_sort_order_idx
  on public.folder_binders(owner_id, folder_id, sort_order nulls last, updated_at desc);
