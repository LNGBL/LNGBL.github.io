begin;

create or replace function public.distribute_peer_learning()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_count integer; v_today date=(now() at time zone 'Asia/Tehran')::date; v_anchor date=date '2026-09-28'; v_cycle date;
 rec record; src record; inserted_id uuid; delivered integer=0;
begin
 v_cycle:=v_anchor+floor((v_today-v_anchor)/14)::int*14;
 if mod(floor((v_today-v_anchor)/7)::int,2)<>0 then return jsonb_build_object('ok',true,'skipped','off_cycle'); end if;
 select count(*) into v_count from public.profiles;
 if v_count<=100 then return jsonb_build_object('ok',true,'skipped','user_count_not_over_100','count',v_count); end if;
 for rec in select id,english_level,german_level from public.profiles where peer_learning_notifications and (english_level is not null or german_level is not null) loop
  for src in
   select cc.language,cc.language_level,cc.source_type,cc.source_hash,cc.payload
   from public.content_contributions cc join public.profiles sp on sp.id=cc.user_id
   where cc.consent_snapshot and cc.exam_eligible and sp.peer_learning_consent
    and cc.created_at>=now()-interval '5 months' and cc.source_type in('vocabulary','grammar')
    and ((cc.language='english' and cc.language_level=rec.english_level) or (cc.language='german' and cc.language_level=rec.german_level))
    and cc.user_id<>rec.id
    and not exists(select 1 from public.peer_learning_deliveries d where d.cycle_start=v_cycle and d.recipient_user_id=rec.id and d.source_hash=cc.source_hash)
   order by random()
  loop
   if src.source_type='vocabulary' and (select count(*) from public.peer_learning_deliveries d where d.cycle_start=v_cycle and d.recipient_user_id=rec.id and d.source_type='vocabulary')>=15 then continue; end if;
   if src.source_type='grammar' and (select count(*) from public.peer_learning_deliveries d where d.cycle_start=v_cycle and d.recipient_user_id=rec.id and d.source_type='grammar')>=6 then continue; end if;
   insert into public.peer_learning_deliveries(cycle_start,recipient_user_id,language,language_level,source_type,content,source_hash,notification_requested)
   values(v_cycle,rec.id,src.language,src.language_level,src.source_type,jsonb_build_object('source_content',src.payload->>'source_content','translation_fa',src.payload->>'translation_fa','word_type',src.payload->>'word_type','example_text',src.payload->>'example_text','grammar_explanation_fa',src.payload->>'grammar_explanation_fa'),src.source_hash,true)
   on conflict do nothing returning id into inserted_id;
   if inserted_id is not null then insert into public.peer_learning_notifications(recipient_user_id,delivery_id) values(rec.id,inserted_id); delivered:=delivered+1; end if;
  end loop;
 end loop;
 return jsonb_build_object('ok',true,'users',v_count,'delivered',delivered,'cycle_start',v_cycle);
end; $$;

revoke all on function public.distribute_peer_learning() from public,anon,authenticated;
grant execute on function public.distribute_peer_learning() to service_role;

select cron.unschedule(jobid) from cron.job where jobname='langblue-peer-learning-distribution';
select cron.schedule('langblue-peer-learning-distribution','15 20 * * 4','select public.distribute_peer_learning();');

commit;