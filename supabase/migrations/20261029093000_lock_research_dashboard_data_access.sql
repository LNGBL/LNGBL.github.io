-- Lock down Research Dashboard data access.
-- Raw learner events are collected by server-side Edge Functions. Dashboard aggregates
-- and research-admin membership are read only by the service-role Edge Function.
revoke all on table public.behavior_events from anon;
revoke all on table public.behavior_event_daily from anon, authenticated;
revoke all on table public.behavior_product_funnel from anon, authenticated;
revoke all on table public.research_admins from anon, authenticated;
alter table public.research_admins enable row level security;
revoke all on function public.research_dashboard_summary() from public, anon, authenticated;
revoke all on function public.research_arabic_case_study() from public, anon, authenticated;
grant select on table public.behavior_event_daily to service_role;
grant select on table public.behavior_product_funnel to service_role;
grant select on table public.research_admins to service_role;
grant execute on function public.research_dashboard_summary() to service_role;
grant execute on function public.research_arabic_case_study() to service_role;
