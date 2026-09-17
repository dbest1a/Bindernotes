-- The History source editor already writes these fields. Persist them instead
-- of rejecting valid source edits as unknown PostgREST columns.
alter table public.history_sources add column quote_text text;
alter table public.history_sources add column claim_supports text;
alter table public.history_sources add column claim_challenges text;
notify pgrst,'reload schema';
