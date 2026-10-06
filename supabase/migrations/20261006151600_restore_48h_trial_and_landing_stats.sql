begin;
create schema if not exists langblue_internal;
create table if not exists langblue_internal.landing_stats (
  id boolean primary key default true check (id=true),
  page_views bigint not null default 0 check(page_views>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into langblue_internal.landing_stats(id) values(true) on conflict(id) do nothing;
insert into public.plans(id,label,days,months,price_irt,active)
values('trial_48h','۴۸ ساعت آزمایشی',2,null,0,true)
on conflict(id) do update set label=excluded.label,days=excluded.days,months=excluded.months,price_irt=0,active=true;
update public.plans set active=false where id='trial_4d';
update public.profiles set trial_expires_at=case when trial_started_at is null then null else trial_started_at+interval '48 hours' end,updated_at=now() where trial_started_at is not null;
update public.subscriptions set plan_id='trial_48h',expires_at=starts_at+interval '48 hours',updated_at=now() where plan_id in('trial_4d','trial_48h') and status='active';
create or replace function public.grant_48h_trial(p_user_id uuid) returns void language plpgsql security definer set search_path=public as $$ declare v_start timestamptz; v_exp timestamptz; begin select trial_started_at,trial_expires_at into v_start,v_exp from public.profiles where id=p_user_id for update; if not found then raise exception 'PROFILE_NOT_FOUND'; end if; if v_start is null then v_start=now();v_exp=v_start+interval '48 hours';update public.profiles set trial_started_at=v_start,trial_expires_at=v_exp,updated_at=now() where id=p_user_id;insert into public.subscriptions(user_id,plan_id,product_ids,status,starts_at,expires_at) values(p_user_id,'trial_48h',array['grammar','vocabulary','deutsch','arabic','langjp'],'active',v_start,v_exp);end if;end; $$;
revoke execute on function public.grant_48h_trial(uuid) from public,anon,authenticated;
grant execute on function public.grant_48h_trial(uuid) to service_role;
revoke execute on function public.grant_4d_trial(uuid) from public,anon,authenticated;
drop function if exists public.grant_4d_trial(uuid);
create or replace function langblue_internal.get_public_landing_stats(p_increment boolean default false) returns jsonb language plpgsql security definer set search_path=public,langblue_internal as $$ declare v_views bigint;v_users bigint;v_vocab bigint;begin if p_increment then update langblue_internal.landing_stats set page_views=page_views+1,updated_at=now() where id=true;end if;select page_views into v_views from langblue_internal.landing_stats where id=true;select count(*) into v_users from auth.users;select count(distinct lower(trim(source_content))) into v_vocab from public.question_pool where active=true and source_type='vocabulary' and nullif(trim(source_content),'') is not null;return jsonb_build_object('page_views',coalesce(v_views,0),'user_accounts',coalesce(v_users,0),'vocabulary_count',coalesce(v_vocab,0));end; $$;
revoke all on function langblue_internal.get_public_landing_stats(boolean) from public,anon,authenticated;
grant execute on function langblue_internal.get_public_landing_stats(boolean) to service_role;
commit;