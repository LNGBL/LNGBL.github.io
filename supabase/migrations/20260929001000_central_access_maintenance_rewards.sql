-- Central access, annual reward, biweekly maintenance and safe exam cleanup.
create table if not exists public.account_annual_rewards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tokens integer not null default 100 check (tokens >= 0),
  leaderboard_points integer not null default 25 check (leaderboard_points >= 0),
  granted_at timestamptz not null default now()
);
alter table public.account_annual_rewards enable row level security;
drop policy if exists account_annual_rewards_self_select on public.account_annual_rewards;
create policy account_annual_rewards_self_select on public.account_annual_rewards
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.grant_annual_account_rewards()
returns integer language plpgsql set search_path=public as $$
declare v_count integer;
begin
  insert into public.account_annual_rewards(user_id,tokens,leaderboard_points)
  select p.id,100,25 from public.profiles p
  where p.created_at <= now() - interval '1 year'
  on conflict (user_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

create or replace function public.is_langblue_maintenance_window()
returns boolean language sql stable set search_path=public as $$
  with t as (select now() at time zone 'Asia/Tehran' as local_now)
  select (
    (extract(isodow from local_now)=4 and (extract(week from local_now)::int % 2)=0 and local_now::time >= time '23:30')
    or
    (extract(isodow from local_now)=5 and (extract(week from (local_now-interval '1 day'))::int % 2)=0 and local_now::time < time '06:00')
  ) from t;
$$;
grant execute on function public.is_langblue_maintenance_window() to anon,authenticated;

create or replace function public.cleanup_langblue_exam_data()
returns void language plpgsql set search_path=public as $$
begin
  delete from public.exam_reports where expires_at<now();
  delete from public.exam_results where expires_at is not null and expires_at<now();
  delete from public.question_pool qp
   where qp.retention_until<now()
     and not exists (select 1 from public.exam_questions eq where eq.question_pool_id=qp.id);
  delete from public.content_contributions where created_at<now()-interval '5 months';
  delete from public.exam_incidents where detected_at<now()-interval '5 months';
  delete from public.question_reports where created_at<now()-interval '5 months';
end; $$;

create or replace function public.reset_langblue_leaderboard()
returns integer language plpgsql set search_path=public as $$
declare v_count integer;
begin
  if not public.is_langblue_maintenance_window() then return 0; end if;
  delete from public.leaderboard;
  get diagnostics v_count=row_count;
  return v_count;
end; $$;

select cron.unschedule(jobid) from cron.job
where jobname in ('langblue-annual-rewards','langblue-biweekly-maintenance','langblue-nightly-vacuum','langblue-cron-history-cleanup');

select cron.schedule('langblue-annual-rewards','0 3 * * *','select public.grant_annual_account_rewards();');
select cron.schedule('langblue-biweekly-maintenance','0 20 * * 4','select public.reset_langblue_leaderboard(); select public.cleanup_langblue_exam_data(); update public.subscriptions set status=''expired'',updated_at=now() where status=''active'' and expires_at<=now();');
select cron.schedule('langblue-nightly-vacuum','0 2 * * *','vacuum analyze public.profiles, public.user_state, public.subscriptions, public.leaderboard, public.content_contributions, public.question_pool, public.exam_results, public.exam_reports, public.exam_incidents;');
select cron.schedule('langblue-cron-history-cleanup','30 2 * * *','delete from cron.job_run_details where end_time < now() - interval ''14 days'';');
