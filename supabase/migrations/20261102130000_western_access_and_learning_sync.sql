-- Wild West stays outside the paid product catalog and inherits Grammar + Vocabulary access.
update public.products set active = false where id = 'western';
update public.subscriptions set product_ids = array_remove(product_ids, 'western'), updated_at = now()
where product_ids @> array['western']::text[];

create or replace function public.grant_48h_trial(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare v_start timestamptz; v_exp timestamptz;
begin
 select trial_started_at, trial_expires_at into v_start, v_exp
 from public.profiles where id = p_user_id for update;
 if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
 if v_start is null then
  v_start := now(); v_exp := v_start + interval '48 hours';
  update public.profiles set trial_started_at=v_start, trial_expires_at=v_exp, updated_at=now()
  where id=p_user_id;
  insert into public.subscriptions(user_id,plan_id,product_ids,status,starts_at,expires_at)
  values(p_user_id,'trial_48h',array['grammar','vocabulary','deutsch','arabic','langjp','langkz','langtj'],'active',v_start,v_exp);
 end if;
end;
$function$;

create or replace function langblue_internal.western_assert_access()
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_uid uuid := auth.uid();
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists (
  select 1 from public.subscriptions s
  where s.user_id=v_uid and s.status='active' and s.starts_at<=now() and s.expires_at>now()
    and s.product_ids @> array['grammar','vocabulary']::text[]
 ) then raise exception 'WESTERN_ACCESS_REQUIRED'; end if;
 return v_uid;
end;
$function$;
revoke all on function langblue_internal.western_assert_access() from public, anon, authenticated;

alter table langblue_internal.western_challenges add column if not exists review_item jsonb;
alter table langblue_internal.western_challenges add column if not exists review_concept_id text;

create or replace function langblue_internal.western_start_challenge(p_stage text default 'dusty-town', p_mode text default 'vocabulary')
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
 v_uid uuid; v_id uuid; v_prompt text; v_options jsonb; v_answer text;
 v_source text := 'public'; v_pack jsonb; v_item jsonb; v_question record;
 v_personal_grammar record; v_review_concept_id text; v_description text;
begin
 v_uid := langblue_internal.western_assert_access();
 if p_mode='grammar' then
  select c.item_id,c.content into v_personal_grammar
  from public.android_content_items c
  where c.user_id=v_uid and c.kind='grammar' and c.language='english' and c.deleted_at is null
    and nullif(trim(c.content->>'label'),'') is not null
  order by random() limit 1;
  if found then
   v_answer := trim(v_personal_grammar.content->>'label');
   v_review_concept_id := v_personal_grammar.item_id;
   v_description := coalesce(
    nullif(v_personal_grammar.content->'grammar'->>'how',''),
    nullif(v_personal_grammar.content->'grammar'->>'note',''),
    nullif(v_personal_grammar.content->'grammar'->>'formula',''),
    nullif(v_personal_grammar.content->'grammar'->'examples'->>0,''),
    v_answer
   );
   v_prompt := 'Which grammar rule best matches this description: ' || v_description;
   select coalesce(jsonb_agg(x.correct_answer order by x.rnd),'[]'::jsonb) into v_options
   from (
    select q.correct_answer,random() as rnd
    from langblue_internal.western_grammar_questions q
    where q.active and lower(q.correct_answer)<>lower(v_answer)
    order by rnd limit 3
   ) x;
  else
   select q.id,q.prompt,q.options,q.correct_answer into v_question
   from langblue_internal.western_grammar_questions q where q.active order by random() limit 1;
   if not found then raise exception 'NO_GRAMMAR_QUESTIONS'; end if;
   v_prompt:=v_question.prompt; v_options:=v_question.options;
   v_answer:=v_question.correct_answer; v_review_concept_id:='western:'||v_question.id;
  end if;
  v_options:=v_options||jsonb_build_array(v_answer);
  select coalesce(jsonb_agg(o.value order by random()),'[]'::jsonb) into v_options
  from jsonb_array_elements(v_options) o(value);
 elsif p_mode='vocabulary' then
  v_pack:=langblue_internal.western_get_stage_pack(p_stage);
  select e.value into v_item
  from jsonb_array_elements((v_pack->'personal_words') || (v_pack->'shared_words')) e(value)
  order by random() limit 1;
  if v_item is null then raise exception 'NO_VOCABULARY_AVAILABLE'; end if;
  v_answer:=v_item->>'word'; v_source:=coalesce(v_item->>'source','public');
  v_prompt:='Choose the word that matches this meaning: '||
    coalesce(nullif(v_item->>'meaning',''),'Find the matching word.');
  select coalesce(jsonb_agg(x.word),'[]'::jsonb) into v_options
  from (
   select w.word from public.western_public_words w
   where w.active and lower(w.word)<>lower(v_answer) order by random() limit 3
  ) x;
  v_options:=v_options||jsonb_build_array(v_answer);
  select jsonb_agg(o.value order by random()) into v_options
  from jsonb_array_elements(v_options) o(value);
 else raise exception 'INVALID_MISSION_MODE'; end if;

 insert into langblue_internal.western_challenges
  (user_id,stage_id,mode,prompt,options,correct_answer,source_type,review_item,review_concept_id)
 values
  (v_uid,coalesce(nullif(p_stage,''),'dusty-town'),p_mode,v_prompt,v_options,v_answer,v_source,
   case when p_mode='vocabulary' then v_item else null end,v_review_concept_id)
 returning id into v_id;

 return jsonb_build_object(
  'id',v_id,'stage',coalesce(nullif(p_stage,''),'dusty-town'),'mode',p_mode,
  'prompt',v_prompt,'options',v_options,
  'review_item',case when p_mode='vocabulary' then v_item else null end,
  'review_concept_id',v_review_concept_id
 );
end;
$function$;
revoke all on function langblue_internal.western_start_challenge(text,text) from public, anon;
grant execute on function langblue_internal.western_start_challenge(text,text) to authenticated;
