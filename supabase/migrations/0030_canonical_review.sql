-- One owner-scoped source of truth for review cards, scheduling, and history.
create table public.review_items (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  id text not null check (length(id) between 1 and 2000),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=2097152),
  revision bigint not null default 1 check (revision>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(owner_id,id)
);
create table public.review_events (
  owner_id uuid not null, id text not null check (length(id) between 1 and 2000), item_id text not null,
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=65536),
  created_at timestamptz not null default now(), primary key(owner_id,id),
  foreign key(owner_id,item_id) references public.review_items(owner_id,id) on delete cascade
);
create table public.review_sessions (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  id text not null check (length(id) between 1 and 2000),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=2097152),
  created_at timestamptz not null default now(), primary key(owner_id,id)
);
create index review_items_owner_updated on public.review_items(owner_id,updated_at,id);
create index review_events_owner_item on public.review_events(owner_id,item_id,created_at);
alter table public.review_items enable row level security;
alter table public.review_events enable row level security;
alter table public.review_sessions enable row level security;
create policy review_items_owned_read on public.review_items for select to authenticated using(owner_id=(select auth.uid()));
create policy review_events_owned_read on public.review_events for select to authenticated using(owner_id=(select auth.uid()));
create policy review_sessions_owned_read on public.review_sessions for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.review_items,public.review_events,public.review_sessions from public,anon,authenticated;
grant select on public.review_items,public.review_events,public.review_sessions to authenticated;
grant all on public.review_items,public.review_events,public.review_sessions to service_role;

create function private.require_review_time(p_value jsonb) returns void
language plpgsql set search_path='' as $$
begin
  if jsonb_typeof(p_value) is distinct from 'string'
    or (p_value#>>'{}') !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$'
    or not isfinite((p_value#>>'{}')::timestamptz) then raise exception 'INVALID_REVIEW_TIME' using errcode='22023'; end if;
end;
$$;
revoke all on function private.require_review_time(jsonb) from public,anon,authenticated;

create function private.validate_review_record(p_record jsonb,p_owner uuid) returns void
language plpgsql set search_path='' as $$
declare item jsonb:=p_record->'item'; recall jsonb:=p_record->'recall'; field text; expected_id text; entry jsonb;
begin
  if jsonb_typeof(p_record) is distinct from 'object' or p_record->'schemaVersion' is distinct from '1'::jsonb
    or jsonb_typeof(item) is distinct from 'object' or item->>'owner_id' is distinct from p_owner::text
    or not(p_record ? 'recall') or octet_length(p_record::text)>2097152 then
    raise exception 'INVALID_REVIEW_RECORD' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_object_keys(p_record) k where k not in('schemaVersion','item','recall')) then
    raise exception 'INVALID_REVIEW_FIELDS' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(item) k where k not in('id','owner_id','type','prompt','answer','source_kind','source_id','source_title','source_excerpt','binder_id','binder_title','course_id','course_title','due_at','status','mastery','review_count','lapse_count','created_at','updated_at')) then
    raise exception 'INVALID_REVIEW_FIELDS' using errcode='22023'; end if;
  foreach field in array array['id','prompt','answer','source_kind','type','status','due_at','created_at','updated_at'] loop
    if jsonb_typeof(item->field) is distinct from 'string' or length(item->>field)>100000 then
      raise exception 'INVALID_REVIEW_FIELD' using errcode='22023'; end if;
  end loop;
  foreach field in array array['source_id','binder_id','course_id'] loop
    if item->field<>'null'::jsonb and length(item->>field) not between 1 and 2000 then raise exception 'INVALID_REVIEW_SOURCE' using errcode='22023'; end if;
  end loop;
  foreach field in array array['source_id','source_title','source_excerpt','binder_id','binder_title','course_id','course_title'] loop
    if not(item ? field) or jsonb_typeof(item->field) not in('string','null') or length(item->>field)>100000 then
      raise exception 'INVALID_REVIEW_SOURCE' using errcode='22023'; end if;
  end loop;
  if length(item->>'id') not between 1 and 2000
    or item->>'type' not in('highlight_recall','formula_card','theorem_card','worked_example','mistake_review','graph_explanation','free_response','numeric_problem','multiple_choice')
    or item->>'source_kind' not in('note','highlight','formula','theorem','problem','mistake','graph','manual')
    or item->>'status' not in('due','upcoming','difficult','mastered') then
    raise exception 'INVALID_REVIEW_ENUM' using errcode='22023'; end if;
  foreach field in array array['review_count','lapse_count','mastery'] loop
    if jsonb_typeof(item->field) is distinct from 'number' or (item->>field)::numeric<0 or (item->>field)::numeric>10000000 then
      raise exception 'INVALID_REVIEW_SCHEDULE' using errcode='22023'; end if;
  end loop;
  if (item->>'mastery')::numeric>1 or trunc((item->>'review_count')::numeric)<>(item->>'review_count')::numeric
    or trunc((item->>'lapse_count')::numeric)<>(item->>'lapse_count')::numeric then
    raise exception 'INVALID_REVIEW_SCHEDULE' using errcode='22023'; end if;
  foreach field in array array['due_at','created_at','updated_at'] loop
    perform private.require_review_time(item->field);
  end loop;
  if p_record->'recall'<>'null'::jsonb then
    if jsonb_typeof(p_record->'recall') is distinct from 'object' or p_record->'recall'->>'userId' is distinct from p_owner::text then
      raise exception 'INVALID_RECALL_OWNER' using errcode='22023'; end if;
    foreach field in array array['id','binderId','documentId','lessonId','front','back','createdAt','updatedAt'] loop
      if jsonb_typeof(p_record->'recall'->field) is distinct from 'string' or length(recall->>field)>100000 then raise exception 'INVALID_RECALL_FIELD' using errcode='22023'; end if;
    end loop;
    foreach field in array array['id','binderId','documentId','lessonId'] loop
      if length(recall->>field) not between 1 and 2000 then raise exception 'INVALID_RECALL_ID' using errcode='22023'; end if;
    end loop;
    foreach field in array array['sourceId','sourceExcerpt','sourceAnchor','subject'] loop
      if recall ? field and (jsonb_typeof(recall->field) not in('string','null') or length(recall->>field)>100000) then raise exception 'INVALID_RECALL_TEXT' using errcode='22023'; end if;
    end loop;
    if recall ? 'sourceId' and recall->'sourceId'<>'null'::jsonb and length(recall->>'sourceId') not between 1 and 2000 then raise exception 'INVALID_RECALL_ID' using errcode='22023'; end if;
    foreach field in array array['explanation','whyItMatters'] loop
      if recall ? field and (jsonb_typeof(recall->field) is distinct from 'string' or length(recall->>field)>100000) then raise exception 'INVALID_RECALL_TEXT' using errcode='22023'; end if;
    end loop;
    foreach field in array array['lastReviewedAt','nextReviewAt'] loop
      if recall ? field and recall->field<>'null'::jsonb then perform private.require_review_time(recall->field); end if;
    end loop;
    if recall ? 'qualityStatus' and (jsonb_typeof(recall->'qualityStatus') is distinct from 'string' or recall->>'qualityStatus' not in('good','too_vague','duplicate','wrong','source_gap')) then raise exception 'INVALID_RECALL_QUALITY' using errcode='22023'; end if;
    foreach field in array array['missReasons','teachBackReflections'] loop
      if recall ? field then
        if jsonb_typeof(recall->field) is distinct from 'array' or jsonb_array_length(recall->field)>10000 then raise exception 'INVALID_RECALL_REFLECTION' using errcode='22023'; end if;
        for entry in select value from jsonb_array_elements(recall->field) loop
          if jsonb_typeof(entry) is distinct from 'object' then raise exception 'INVALID_RECALL_REFLECTION' using errcode='22023'; end if;
          perform private.require_review_time(entry->'createdAt');
          if field='missReasons' then
            if exists(select 1 from jsonb_object_keys(entry) k where k not in('reason','note','createdAt'))
              or jsonb_typeof(entry->'reason') is distinct from 'string'
              or entry->>'reason' not in('Forgot term','Confused similar concept','Did not understand source','Careless error','Need example','Card is wrong/vague','Other')
              or (entry ? 'note' and (jsonb_typeof(entry->'note') is distinct from 'string' or length(entry->>'note')>100000)) then raise exception 'INVALID_RECALL_REFLECTION' using errcode='22023'; end if;
          elsif exists(select 1 from jsonb_object_keys(entry) k where k not in('text','createdAt'))
            or jsonb_typeof(entry->'text') is distinct from 'string' or length(entry->>'text')>100000 then raise exception 'INVALID_RECALL_REFLECTION' using errcode='22023'; end if;
        end loop;
      end if;
    end loop;
    if exists(select 1 from jsonb_object_keys(recall) k where k not in('id','userId','binderId','documentId','lessonId','sourceType','sourceId','sourceExcerpt','sourceAnchor','front','back','explanation','whyItMatters','tags','subject','cardType','status','difficulty','confidence','lastReviewedAt','nextReviewAt','reviewCount','lapseCount','createdVia','draftStatus','qualityStatus','missReasons','teachBackReflections','createdAt','updatedAt')) then
      raise exception 'INVALID_RECALL_FIELDS' using errcode='22023'; end if;
    expected_id:='recall:['||to_jsonb(recall->>'binderId')::text||','||to_jsonb(recall->>'documentId')::text||','||to_jsonb(recall->>'lessonId')::text||','||to_jsonb(recall->>'id')::text||']';
    if item->>'id' is distinct from expected_id or item->>'prompt' is distinct from recall->>'front' or item->>'answer' is distinct from recall->>'back'
      or item->'mastery' is distinct from recall->'confidence' or item->'review_count' is distinct from recall->'reviewCount'
      or item->'lapse_count' is distinct from recall->'lapseCount'
      or item->>'due_at' is distinct from coalesce(recall->>'nextReviewAt',recall->>'createdAt') then
      raise exception 'INCONSISTENT_RECALL_RECORD' using errcode='22023'; end if;
    foreach field in array array['sourceType','createdVia','cardType','status','difficulty','draftStatus'] loop
      if jsonb_typeof(recall->field) is distinct from 'string' then raise exception 'INVALID_RECALL_FIELD' using errcode='22023'; end if;
    end loop;
    if jsonb_typeof(recall->'tags') is distinct from 'array' or jsonb_array_length(recall->'tags')>200
      or exists(select 1 from jsonb_array_elements(recall->'tags') x where jsonb_typeof(x) is distinct from 'string' or length(x#>>'{}')>500)
      or recall->>'draftStatus' not in('draft','accepted','rejected','needs_review')
      or recall->>'status' not in('Draft','Needs review','Learning','Weak','Confused','Source gap','Strong','Mastered','Duplicate','Too vague','Wrong')
      or recall->>'difficulty' not in('new','again','hard','good','easy')
      or recall->>'cardType' not in('basic_qa','term_definition','cloze','concept_example','example_concept','compare_contrast','process_steps','source_evidence','misconception','formula_meaning','worked_step','graph_interpretation','common_error','proof_step','definition_theorem','element_fact','ion_charge','reaction_balancing','safety_reagent','lab_observation','titration_concept','lab_cause_effect','stoichiometry_step','event_context','cause_effect','evidence_claim','source_quote_interpretation','timeline_ordering','argument_building','myth_check','claim_evidence_reasoning','vocabulary','revision_checklist','prompt_outline')
      or recall->>'sourceType' not in('manual','selected_text','highlight','note','sticky','chemistry_observation','math_tool','history_evidence')
      or recall->>'createdVia' not in('manual','selected_text','highlight','note','sticky','chemistry_observation','math_tool','history_evidence') then
      raise exception 'INVALID_RECALL_DATA' using errcode='22023'; end if;
    foreach field in array array['createdAt','updatedAt'] loop
      perform private.require_review_time(recall->field);
    end loop;
  end if;
end;
$$;
revoke all on function private.validate_review_record(jsonb,uuid) from public,anon,authenticated;

create function public.save_review_item(p_record jsonb,p_expected_revision bigint,p_operation_id uuid,p_events jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); record_id text; current_row public.review_items%rowtype; saved public.review_items%rowtype;
  receipt private.content_mutation_receipts%rowtype; request_hash text; event jsonb; old_event jsonb; field text;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  perform private.validate_review_record(p_record,actor);
  if p_expected_revision is null or p_expected_revision<0 or p_operation_id is null or jsonb_typeof(p_events) is distinct from 'array'
    or jsonb_array_length(p_events)>1000 or octet_length(p_events::text)>2097152 then
    raise exception 'INVALID_REVIEW_OPERATION' using errcode='22023'; end if;
  record_id:=p_record->'item'->>'id';
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_operation_id::text,2701));
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':review:'||record_id,3001));
  select * into current_row from public.review_items where owner_id=actor and id=record_id for update;
  request_hash:=md5(p_record::text||p_expected_revision::text||p_events::text);
  select * into receipt from private.content_mutation_receipts where owner_id=actor and operation_id=p_operation_id;
  if found then
    if receipt.entity_kind<>'review' or receipt.entity_id<>record_id or receipt.request_hash<>request_hash then
      raise exception 'OPERATION_ID_REUSED' using errcode='22023'; end if;
    if current_row.revision=receipt.revision then return to_jsonb(current_row); end if;
    raise exception 'CONTENT_REVISION_CONFLICT' using errcode='40001';
  end if;
  if coalesce(current_row.revision,0)<>p_expected_revision then raise exception 'CONTENT_REVISION_CONFLICT' using errcode='40001'; end if;
  insert into public.review_items(owner_id,id,payload,revision,created_at,updated_at)
    values(actor,record_id,p_record,p_expected_revision+1,(p_record->'item'->>'created_at')::timestamptz,now())
    on conflict(owner_id,id) do update set payload=excluded.payload,revision=excluded.revision,updated_at=now()
    returning * into saved;
  for event in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(event) is distinct from 'object' or event->>'owner_id' is distinct from actor::text
      or event->>'item_id' is distinct from record_id or jsonb_typeof(event->'id') is distinct from 'string' or coalesce(length(event->>'id'),0) not between 1 and 2000
      or jsonb_typeof(event->'rating') is distinct from 'string' or event->>'rating' not in('forgot','hard','good','easy')
      or jsonb_typeof(event->'response_length') is distinct from 'number' or (event->>'response_length')::numeric not between 0 and 10000000
      or trunc((event->>'response_length')::numeric)<>(event->>'response_length')::numeric
      or exists(select 1 from jsonb_object_keys(event) k where k not in('id','owner_id','item_id','rating','reviewed_at','due_at_before','due_at_after','response_length')) then
      raise exception 'INVALID_REVIEW_EVENT' using errcode='22023'; end if;
    foreach field in array array['reviewed_at','due_at_before','due_at_after'] loop
      perform private.require_review_time(event->field);
    end loop;
    select payload into old_event from public.review_events where owner_id=actor and id=event->>'id';
    if found and old_event<>event then raise exception 'REVIEW_HISTORY_CONFLICT' using errcode='40001'; end if;
    insert into public.review_events(owner_id,id,item_id,payload,created_at)
      values(actor,event->>'id',record_id,event,(event->>'reviewed_at')::timestamptz) on conflict(owner_id,id) do nothing;
  end loop;
  insert into private.content_mutation_receipts values(actor,p_operation_id,'review',record_id,request_hash,saved.revision,now());
  return to_jsonb(saved);
end;
$$;
revoke all on function public.save_review_item(jsonb,bigint,uuid,jsonb) from public,anon;
grant execute on function public.save_review_item(jsonb,bigint,uuid,jsonb) to authenticated;

-- Legacy session summaries have independent identities and never overwrite history.
create function public.save_review_session(p_id text,p_session jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); previous jsonb; field text;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if coalesce(length(p_id),0) not between 1 and 2000 or jsonb_typeof(p_session) is distinct from 'object'
    or p_session->'scope'->>'userId' is distinct from actor::text or jsonb_typeof(p_session->'cardIds') is distinct from 'array'
    or jsonb_typeof(p_session->'score') is distinct from 'number' or octet_length(p_session::text)>2097152 then
    raise exception 'INVALID_REVIEW_SESSION' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_session) k where k not in('id','scope','mode','goal','cardIds','correct','missed','score','missedConcepts','createdAt'))
    or jsonb_typeof(p_session->'scope') is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_session->'scope') k where k not in('userId','binderId','documentId','lessonId'))
    or (p_session ? 'goal' and (jsonb_typeof(p_session->'goal') is distinct from 'string' or p_session->>'goal' not in('Quick warmup','Checkpoint prep','Weak spots','Current lesson','Binder review','Subject review')))
    or jsonb_typeof(p_session->'mode') is distinct from 'string'
    or p_session->>'mode' not in('Flip','Type answer','Cloze','Multiple choice','Pair Builder','Teach-back','Mistake review','Checkpoint','Guided Recall')
    or (p_session->>'score')::numeric not between 0 and 100
    or jsonb_array_length(p_session->'cardIds')>10000
    or exists(select 1 from jsonb_array_elements(p_session->'cardIds') x where jsonb_typeof(x) is distinct from 'string' or length(x#>>'{}') not between 1 and 2000)
    or jsonb_typeof(p_session->'missedConcepts') is distinct from 'array'
    or jsonb_array_length(p_session->'missedConcepts')>10000
    or exists(select 1 from jsonb_array_elements(p_session->'missedConcepts') x where jsonb_typeof(x) is distinct from 'string' or length(x#>>'{}')>100000) then
    raise exception 'INVALID_REVIEW_SESSION_FIELDS' using errcode='22023'; end if;
  foreach field in array array['correct','missed'] loop
    if jsonb_typeof(p_session->field) is distinct from 'number' or (p_session->>field)::numeric not between 0 and 10000000
      or trunc((p_session->>field)::numeric)<>(p_session->>field)::numeric then raise exception 'INVALID_REVIEW_SESSION_COUNT' using errcode='22023'; end if;
  end loop;
  foreach field in array array['binderId','documentId','lessonId'] loop
    if jsonb_typeof(p_session->'scope'->field) is distinct from 'string' or length(p_session->'scope'->>field) not between 1 and 2000 then
      raise exception 'INVALID_REVIEW_SESSION_SCOPE' using errcode='22023'; end if;
  end loop;
  if jsonb_typeof(p_session->'id') is distinct from 'string' or length(p_session->>'id') not between 1 and 2000 or p_id::jsonb is distinct from jsonb_build_array(p_session->'scope'->>'binderId',p_session->'scope'->>'documentId',p_session->'scope'->>'lessonId',p_session->>'id') then
    raise exception 'INVALID_REVIEW_SESSION_IDENTITY' using errcode='22023'; end if;
  perform private.require_review_time(p_session->'createdAt');
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':review-session:'||p_id,3001));
  select payload into previous from public.review_sessions where owner_id=actor and id=p_id;
  if found and previous<>p_session then raise exception 'REVIEW_SESSION_CONFLICT' using errcode='40001'; end if;
  insert into public.review_sessions(owner_id,id,payload,created_at) values(actor,p_id,p_session,(p_session->>'createdAt')::timestamptz)
    on conflict(owner_id,id) do nothing;
  return p_session;
end;
$$;
revoke all on function public.save_review_session(text,jsonb) from public,anon;
grant execute on function public.save_review_session(text,jsonb) to authenticated;
