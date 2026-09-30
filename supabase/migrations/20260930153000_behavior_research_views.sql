create or replace view public.behavior_event_daily
with (security_invoker = true)
as
select
  date_trunc('day', occurred_at)::date as event_date,
  product_id,
  event_name,
  count(*)::bigint as event_count,
  count(distinct user_id)::bigint as unique_users,
  count(distinct session_id)::bigint as unique_sessions
from public.behavior_events
group by 1,2,3;

create or replace view public.behavior_product_funnel
with (security_invoker = true)
as
select
  product_id,
  count(distinct user_id) filter (where event_name='page_view') as page_view_users,
  count(distinct user_id) filter (where event_name='learning_started') as learning_started_users,
  count(distinct user_id) filter (where event_name='learning_completed') as learning_completed_users,
  count(distinct user_id) filter (where event_name='weakness_mode_opened') as weakness_opened_users,
  count(distinct user_id) filter (where event_name='assessment_started') as assessment_started_users,
  count(distinct user_id) filter (where event_name='assessment_completed') as assessment_completed_users,
  count(distinct user_id) filter (where event_name='subscription_selected') as subscription_selected_users,
  count(distinct user_id) filter (where event_name='activation_completed') as activation_completed_users
from public.behavior_events
group by product_id;

grant select on public.behavior_event_daily to authenticated;
grant select on public.behavior_product_funnel to authenticated;
