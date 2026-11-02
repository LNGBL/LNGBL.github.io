-- LangBlue Wild West: isolated game rewards and curated English word bank.
create schema if not exists langblue_internal;

create table if not exists public.western_public_words (
 id bigserial primary key, word text not null unique, meaning text not null,
 part_of_speech text, example text, level text not null default 'A1',
 topic text not null default 'general', active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.western_public_words enable row level security;
drop policy if exists western_public_words_read_active on public.western_public_words;
create policy western_public_words_read_active on public.western_public_words
 for select to anon, authenticated using (active=true);
grant select on public.western_public_words to anon, authenticated;

create table if not exists langblue_internal.western_grammar_questions (
 id text primary key, stage_id text not null default 'railway',
 prompt text not null, options jsonb not null, correct_answer text not null,
 active boolean not null default true
);
alter table langblue_internal.western_grammar_questions enable row level security;

create table if not exists langblue_internal.western_player_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 tokens integer not null default 0 check(tokens>=0),
 streak integer not null default 0 check(streak>=0),
 total_wins integer not null default 0 check(total_wins>=0),
 updated_at timestamptz not null default now()
);
alter table langblue_internal.western_player_state enable row level security;

create table if not exists langblue_internal.western_challenges (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 stage_id text not null, mode text not null check(mode in ('vocabulary','grammar')),
 prompt text not null, options jsonb not null, correct_answer text not null,
 source_type text not null default 'public',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '20 minutes'),
 answered_at timestamptz
);
create index if not exists western_challenges_user_created_idx
 on langblue_internal.western_challenges(user_id,created_at desc);
alter table langblue_internal.western_challenges enable row level security;

create table if not exists langblue_internal.western_token_ledger (
 id bigserial primary key, user_id uuid not null references auth.users(id) on delete cascade,
 challenge_id uuid not null references langblue_internal.western_challenges(id) on delete cascade,
 reason text not null check(reason in ('mission_win','streak_bonus_10')),
 amount integer not null check(amount>0), created_at timestamptz not null default now(),
 unique(challenge_id,reason)
);
create index if not exists western_token_ledger_user_created_idx
 on langblue_internal.western_token_ledger(user_id,created_at desc);
alter table langblue_internal.western_token_ledger enable row level security;

insert into public.products(id,label,active)
values('western','LangBlue Wild West',true)
on conflict(id) do update set label=excluded.label,active=true;

update public.subscriptions set product_ids=array_append(product_ids,'western'),updated_at=now()
where status='active' and expires_at>now()
and product_ids @> array['grammar','vocabulary','deutsch','arabic','langjp','langkz','langtj']::text[]
and not(product_ids @> array['western']::text[]);
update public.subscriptions set product_ids=array_append(product_ids,'western'),updated_at=now()
where status='active' and plan_id='trial_48h' and expires_at>now()
and not(product_ids @> array['western']::text[]);

create or replace function public.grant_48h_trial(p_user_id uuid)
returns void language plpgsql security definer set search_path=public
as $function$
declare v_start timestamptz; v_exp timestamptz;
begin
 select trial_started_at,trial_expires_at into v_start,v_exp
 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
 if v_start is null then
  v_start=now(); v_exp=v_start+interval '48 hours';
  update public.profiles set trial_started_at=v_start,trial_expires_at=v_exp,updated_at=now() where id=p_user_id;
  insert into public.subscriptions(user_id,plan_id,product_ids,status,starts_at,expires_at)
  values(p_user_id,'trial_48h',array['grammar','vocabulary','deutsch','arabic','langjp','langkz','langtj','western'],'active',v_start,v_exp);
 end if;
end;
$function$;

create or replace function langblue_internal.western_assert_access()
returns uuid language plpgsql security definer
set search_path=pg_catalog,public,langblue_internal
as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.subscriptions s where s.user_id=v_uid and s.status='active'
   and s.starts_at<=now() and s.expires_at>now() and s.product_ids @> array['western']::text[])
 then raise exception 'WESTERN_ACCESS_REQUIRED'; end if;
 return v_uid;
end; $$;

create or replace function langblue_internal.western_get_stage_pack(p_stage text default 'dusty-town')
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,langblue_internal
as $$
declare v_uid uuid; v_personal jsonb:='[]'::jsonb; v_extra jsonb:='[]'::jsonb;
 v_shared jsonb:='[]'::jsonb; v_missing integer; v_state jsonb;
begin
 v_uid:=langblue_internal.western_assert_access();
 select coalesce(jsonb_agg(q.item),'[]'::jsonb) into v_personal from (
  select jsonb_build_object('word',x.word,'meaning',x.meaning,'example',x.example,
   'part_of_speech',x.part_of_speech,'source','personal') item
  from (
   select distinct on(lower(trim(coalesce(c.content->>'word',c.content->>'english',c.content->>'term',c.content->>'name'))))
    trim(coalesce(c.content->>'word',c.content->>'english',c.content->>'term',c.content->>'name')) word,
    coalesce(c.content->>'persian',c.content->>'meaning',c.content->>'translation',c.content->>'definition','') meaning,
    coalesce(c.content->>'example','') example,
    coalesce(c.content->>'type',c.content->>'part_of_speech','') part_of_speech,
    c.updated_at
   from public.android_content_items c
   where c.user_id=v_uid and c.kind='vocabulary' and c.language='english' and c.deleted_at is null
    and nullif(trim(coalesce(c.content->>'word',c.content->>'english',c.content->>'term',c.content->>'name')),'') is not null
   order by lower(trim(coalesce(c.content->>'word',c.content->>'english',c.content->>'term',c.content->>'name'))),c.updated_at desc
  ) x order by random() limit 15
 ) q;
 v_missing:=greatest(0,15-jsonb_array_length(v_personal));
 if v_missing>0 then
  select coalesce(jsonb_agg(q.item),'[]'::jsonb) into v_extra from (
   select jsonb_build_object('word',w.word,'meaning',w.meaning,'example',coalesce(w.example,''),
    'part_of_speech',coalesce(w.part_of_speech,''),'source','supplement') item
   from public.western_public_words w where w.active
    and not exists(select 1 from jsonb_array_elements(v_personal) p where lower(p->>'word')=lower(w.word))
   order by random() limit v_missing
  ) q;
  v_personal:=v_personal||v_extra;
 end if;
 select coalesce(jsonb_agg(q.item),'[]'::jsonb) into v_shared from (
  select jsonb_build_object('word',w.word,'meaning',w.meaning,'example',coalesce(w.example,''),
   'part_of_speech',coalesce(w.part_of_speech,''),'source','community') item
  from public.western_public_words w where w.active
   and not exists(select 1 from jsonb_array_elements(v_personal) p where lower(p->>'word')=lower(w.word))
  order by random() limit 15
 ) q;
 insert into langblue_internal.western_player_state(user_id) values(v_uid) on conflict(user_id) do nothing;
 select jsonb_build_object('tokens',s.tokens,'streak',s.streak,'total_wins',s.total_wins)
 into v_state from langblue_internal.western_player_state s where s.user_id=v_uid;
 return jsonb_build_object('stage',coalesce(nullif(p_stage,''),'dusty-town'),
  'personal_words',v_personal,'shared_words',v_shared,'player_state',coalesce(v_state,'{}'::jsonb));
end; $$;

create or replace function langblue_internal.western_start_challenge(p_stage text default 'dusty-town',p_mode text default 'vocabulary')
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,langblue_internal
as $$
declare v_uid uuid; v_id uuid; v_prompt text; v_options jsonb; v_answer text;
 v_source text:='public'; v_pack jsonb; v_item jsonb; v_question record;
begin
 v_uid:=langblue_internal.western_assert_access();
 if p_mode='grammar' then
  select q.prompt,q.options,q.correct_answer into v_question
  from langblue_internal.western_grammar_questions q where q.active order by random() limit 1;
  if not found then raise exception 'NO_GRAMMAR_QUESTIONS'; end if;
  v_prompt:=v_question.prompt; v_options:=v_question.options; v_answer:=v_question.correct_answer;
 elsif p_mode='vocabulary' then
  v_pack:=langblue_internal.western_get_stage_pack(p_stage);
  select e.value into v_item from jsonb_array_elements(v_pack->'personal_words'||v_pack->'shared_words') e(value)
  order by random() limit 1;
  if v_item is null then raise exception 'NO_VOCABULARY_AVAILABLE'; end if;
  v_answer:=v_item->>'word'; v_source:=coalesce(v_item->>'source','public');
  v_prompt:='Choose the word that matches this meaning: '||coalesce(nullif(v_item->>'meaning',''),'Find the matching word.');
  select coalesce(jsonb_agg(x.word),'[]'::jsonb) into v_options
  from (select w.word from public.western_public_words w where w.active and lower(w.word)<>lower(v_answer) order by random() limit 3) x;
  v_options:=v_options||jsonb_build_array(v_answer);
  select jsonb_agg(o.value order by random()) into v_options from jsonb_array_elements(v_options) o(value);
 else raise exception 'INVALID_MISSION_MODE'; end if;
 insert into langblue_internal.western_challenges(user_id,stage_id,mode,prompt,options,correct_answer,source_type)
 values(v_uid,coalesce(nullif(p_stage,''),'dusty-town'),p_mode,v_prompt,v_options,v_answer,v_source)
 returning id into v_id;
 return jsonb_build_object('id',v_id,'stage',coalesce(nullif(p_stage,''),'dusty-town'),
  'mode',p_mode,'prompt',v_prompt,'options',v_options);
end; $$;

create or replace function langblue_internal.western_submit_challenge(p_challenge_id uuid,p_answer text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,langblue_internal
as $$
declare v_uid uuid; v_challenge langblue_internal.western_challenges%rowtype;
 v_state langblue_internal.western_player_state%rowtype; v_correct boolean; v_bonus integer:=0; v_award integer:=0;
begin
 v_uid:=langblue_internal.western_assert_access();
 select * into v_challenge from langblue_internal.western_challenges
 where id=p_challenge_id and user_id=v_uid for update;
 if not found then raise exception 'CHALLENGE_NOT_FOUND'; end if;
 if v_challenge.answered_at is not null then raise exception 'CHALLENGE_ALREADY_ANSWERED'; end if;
 if v_challenge.expires_at<now() then raise exception 'CHALLENGE_EXPIRED'; end if;
 insert into langblue_internal.western_player_state(user_id) values(v_uid) on conflict(user_id) do nothing;
 select * into v_state from langblue_internal.western_player_state where user_id=v_uid for update;
 v_correct:=lower(trim(coalesce(p_answer,'')))=lower(trim(v_challenge.correct_answer));
 update langblue_internal.western_challenges set answered_at=now() where id=v_challenge.id;
 if v_correct then
  v_award:=4; if (v_state.streak+1)%10=0 then v_bonus:=25; end if;
  update langblue_internal.western_player_state set tokens=tokens+v_award+v_bonus,
   streak=streak+1,total_wins=total_wins+1,updated_at=now()
   where user_id=v_uid returning * into v_state;
  insert into langblue_internal.western_token_ledger(user_id,challenge_id,reason,amount)
   values(v_uid,v_challenge.id,'mission_win',4);
  if v_bonus>0 then insert into langblue_internal.western_token_ledger(user_id,challenge_id,reason,amount)
   values(v_uid,v_challenge.id,'streak_bonus_10',25); end if;
 else
  update langblue_internal.western_player_state set streak=0,updated_at=now()
   where user_id=v_uid returning * into v_state;
 end if;
 return jsonb_build_object('correct',v_correct,'tokens_awarded',v_award+v_bonus,
  'bonus_awarded',v_bonus,'tokens',v_state.tokens,'streak',v_state.streak,'total_wins',v_state.total_wins);
end; $$;

revoke all on function langblue_internal.western_assert_access() from public,anon,authenticated;
revoke all on function langblue_internal.western_get_stage_pack(text) from public,anon;
revoke all on function langblue_internal.western_start_challenge(text,text) from public,anon;
revoke all on function langblue_internal.western_submit_challenge(uuid,text) from public,anon;
grant usage on schema langblue_internal to authenticated;
grant execute on function langblue_internal.western_get_stage_pack(text) to authenticated;
grant execute on function langblue_internal.western_start_challenge(text,text) to authenticated;
grant execute on function langblue_internal.western_submit_challenge(uuid,text) to authenticated;

create or replace function public.western_get_stage_pack(p_stage text default 'dusty-town')
returns jsonb language sql security invoker set search_path=public,langblue_internal,pg_temp
as $$ select langblue_internal.western_get_stage_pack(p_stage); $$;
create or replace function public.western_start_challenge(p_stage text default 'dusty-town',p_mode text default 'vocabulary')
returns jsonb language sql security invoker set search_path=public,langblue_internal,pg_temp
as $$ select langblue_internal.western_start_challenge(p_stage,p_mode); $$;
create or replace function public.western_submit_challenge(p_challenge_id uuid,p_answer text)
returns jsonb language sql security invoker set search_path=public,langblue_internal,pg_temp
as $$ select langblue_internal.western_submit_challenge(p_challenge_id,p_answer); $$;
revoke all on function public.western_get_stage_pack(text) from public,anon;
revoke all on function public.western_start_challenge(text,text) from public,anon;
revoke all on function public.western_submit_challenge(uuid,text) from public,anon;
grant execute on function public.western_get_stage_pack(text) to authenticated;
grant execute on function public.western_start_challenge(text,text) to authenticated;
grant execute on function public.western_submit_challenge(uuid,text) to authenticated;

insert into public.western_public_words(word,meaning,part_of_speech,example,level,topic) values
('arrive','to reach a place','verb','The train will arrive soon.','A1','travel'),
('journey','an act of travelling from one place to another','noun','Our journey begins at sunrise.','A2','travel'),
('station','a place where trains stop','noun','Meet me at the station.','A1','travel'),
('ticket','a paper or digital record that lets you travel','noun','I have a train ticket.','A1','travel'),
('village','a small group of houses in the countryside','noun','The village is quiet.','A1','places'),
('desert','a large dry area with little rain','noun','The desert is very dry.','A1','nature'),
('river','a natural stream of water','noun','The river crosses the valley.','A1','nature'),
('bridge','a structure built over a river or road','noun','We crossed the bridge.','A1','places'),
('lantern','a lamp that can be carried','noun','A lantern lit the room.','A2','objects'),
('saddle','a seat for a rider on a horse','noun','The saddle is near the stable.','A2','objects'),
('stable','a building where horses are kept','noun','The horse is in the stable.','A2','places'),
('ranch','a large farm for animals','noun','The family works on a ranch.','A2','places'),
('market','a place where people buy and sell things','noun','The market opens early.','A1','places'),
('neighbor','a person who lives near you','noun','Our neighbor is helpful.','A1','people'),
('message','a piece of information sent to someone','noun','I received your message.','A1','communication'),
('discover','to find something for the first time','verb','We discover a hidden path.','A2','actions'),
('search','to look carefully for something','verb','Search the old map for clues.','A2','actions'),
('follow','to go after someone or something','verb','Follow the signs to town.','A1','actions'),
('careful','giving attention to avoid mistakes','adjective','Be careful with the glass.','A2','qualities'),
('quiet','making little or no noise','adjective','The street is quiet at night.','A1','qualities'),
('crowded','full of people','adjective','The station is crowded today.','A2','qualities'),
('empty','with nothing or nobody inside','adjective','The room is empty.','A1','qualities'),
('borrow','to take something and return it later','verb','May I borrow your map?','A2','actions'),
('return','to go or give something back','verb','Please return the book tomorrow.','A1','actions'),
('choose','to decide which thing you want','verb','Choose a path on the map.','A1','actions'),
('explain','to make something clear','verb','Can you explain the rule?','A2','communication'),
('improve','to become or make something better','verb','Practice can improve your English.','A2','learning'),
('practice','to do something repeatedly to get better','verb','We practice a new sentence.','A1','learning'),
('mistake','something that is not correct','noun','A mistake can help us learn.','A1','learning'),
('answer','something said or written after a question','noun','Write your answer here.','A1','learning'),
('question','a sentence used to ask for information','noun','That is a good question.','A1','learning'),
('weather','the condition of the air outside','noun','The weather is sunny.','A1','nature'),
('cloud','a white or grey mass in the sky','noun','A cloud moved over the sun.','A1','nature'),
('sunset','the time when the sun goes down','noun','We watched the sunset.','A2','nature'),
('mountain','a very high natural area of land','noun','The mountain is far away.','A1','nature'),
('valley','low land between hills or mountains','noun','A river runs through the valley.','A2','nature'),
('wooden','made of wood','adjective','The shop has a wooden door.','A2','materials'),
('friendly','kind and pleasant to other people','adjective','The shopkeeper is friendly.','A1','people'),
('honest','always telling the truth','adjective','An honest person tells the truth.','A2','qualities'),
('patient','able to wait calmly','adjective','Be patient while the train arrives.','A2','qualities'),
('supply','an amount of something available to use','noun','The town has a water supply.','B1','objects'),
('notice','to see or become aware of something','verb','Did you notice the sign?','A2','actions'),
('invite','to ask someone to come somewhere','verb','They invite us to the festival.','A2','communication'),
('prepare','to make something ready','verb','Prepare your notebook for class.','A2','actions'),
('protect','to keep someone or something safe','verb','Trees protect the soil.','A2','actions'),
('collect','to bring things together','verb','Collect the clues from each room.','A2','actions'),
('repair','to fix something that is broken','verb','They repair the old bridge.','A2','actions'),
('direction','the way that someone or something moves','noun','Which direction is the station?','A2','travel'),
('distance','the amount of space between two places','noun','The distance is five kilometres.','A2','travel'),
('entrance','a door or place used to enter','noun','The entrance is beside the clock.','A2','places'),
('exit','a door or place used to leave','noun','The exit is on the left.','A1','places'),
('crossing','a place where people can cross','noun','Wait at the crossing.','A2','travel'),
('signal','a sound or action that gives information','noun','The signal tells us to wait.','A2','communication'),
('schedule','a plan that shows when things happen','noun','Check the train schedule.','A2','time'),
('delay','a situation in which something happens later than expected','noun','There is a short delay.','A2','time'),
('luggage','bags and cases used when travelling','noun','Put your luggage by the door.','A2','travel'),
('destination','the place where someone is going','noun','Our destination is the old town.','B1','travel'),
('explore','to travel around a place to learn about it','verb','We explore the canyon together.','A2','actions'),
('hidden','not easy to see or find','adjective','A hidden note is under the table.','A2','qualities'),
('ancient','very old','adjective','They found an ancient map.','B1','time'),
('valuable','worth a lot or very useful','adjective','The old book is valuable.','A2','qualities'),
('promise','to say that you will certainly do something','verb','I promise to return the key.','A2','communication'),
('trust','to believe that someone is honest or reliable','verb','Friends learn to trust each other.','A2','people'),
('cooperate','to work together with someone','verb','The team cooperate to solve the puzzle.','B1','people'),
('solution','an answer to a problem','noun','We found a solution together.','A2','learning'),
('clue','a piece of information that helps solve a problem','noun','The clue is on the noticeboard.','A2','learning'),
('map','a drawing that shows places and roads','noun','The map shows the railway.','A1','travel'),
('path','a way or track for walking','noun','Follow the path to the river.','A1','places'),
('forest','a large area covered with trees','noun','The forest is quiet.','A1','nature'),
('cabin','a small simple house, often in the countryside','noun','The cabin stands near the river.','A2','places'),
('festival','a special event with music and activities','noun','The town has a spring festival.','A2','culture'),
('gather','to come together in one place','verb','People gather in the town square.','A2','people'),
('share','to give part of something to others','verb','We share ideas in the classroom.','A1','people'),
('support','to help someone or something','verb','Good friends support each other.','A2','people'),
('curious','wanting to know or learn something','adjective','The curious student asks questions.','A2','qualities')
on conflict(word) do update set meaning=excluded.meaning,part_of_speech=excluded.part_of_speech,
 example=excluded.example,level=excluded.level,topic=excluded.topic,active=true;

insert into langblue_internal.western_grammar_questions(id,stage_id,prompt,options,correct_answer) values
('g01','railway','Choose the correct sentence.','["She go to the station.","She goes to the station.","She going to the station.","She gone to the station."]'::jsonb,'She goes to the station.'),
('g02','railway','Complete: They ___ waiting for the train.','["is","am","are","be"]'::jsonb,'are'),
('g03','railway','Choose the correct past form: We ___ the map yesterday.','["find","found","finding","finds"]'::jsonb,'found'),
('g04','railway','Complete: I have lived here ___ 2022.','["for","since","during","from"]'::jsonb,'since'),
('g05','railway','Choose the correct article: She bought ___ old book.','["a","an","thee","no article"]'::jsonb,'an'),
('g06','railway','Choose the correct question.','["Where the train is?","Where is the train?","Where does the train?","Where train is?"]'::jsonb,'Where is the train?'),
('g07','railway','Complete: If it rains, we ___ inside.','["stay","will stay","stayed","staying"]'::jsonb,'will stay'),
('g08','railway','Choose the comparative form of “quiet”.','["quietest","more quietest","quieter","most quiet"]'::jsonb,'quieter'),
('g09','railway','Complete: There ___ two lanterns on the table.','["is","are","was","be"]'::jsonb,'are'),
('g10','railway','This map belongs to Anna. It is ___.','["her","hers","she","herself"]'::jsonb,'hers'),
('g11','railway','Complete: He is interested ___ history.','["on","at","in","for"]'::jsonb,'in'),
('g12','railway','Choose the correct passive sentence.','["The bridge built in 1900.","The bridge was built in 1900.","The bridge is build in 1900.","The bridge was build in 1900."]'::jsonb,'The bridge was built in 1900.'),
('g13','railway','Complete: You ___ wear a seat belt.','["should","might to","can to","must to"]'::jsonb,'should'),
('g14','railway','The person ___ helped us was kind.','["which","where","who","when"]'::jsonb,'who'),
('g15','railway','Complete: I enjoy ___ new places.','["explore","to exploring","exploring","explored"]'::jsonb,'exploring')
on conflict(id) do update set stage_id=excluded.stage_id,prompt=excluded.prompt,options=excluded.options,correct_answer=excluded.correct_answer,active=true;

notify pgrst,'reload schema';
