begin;
alter table public.android_pairings drop column if exists browser_user_agent;
select cron.schedule(
  'langblue-prune-landing-ip-hashes',
  '0 * * * *',
  $$delete from langblue_internal.landing_view_ips where last_counted_at < now() - interval '24 hours';$$
);
commit;
