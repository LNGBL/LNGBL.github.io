create table if not exists public.research_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.research_admins enable row level security;
revoke all on public.research_admins from anon, authenticated;
grant all on public.research_admins to service_role;
create index if not exists research_admins_created_idx on public.research_admins(created_at desc);

create or replace function public.research_dashboard_summary()
returns jsonb language sql stable
as $$
  select jsonb_build_object(
    'total_events', count(*)::bigint,
    'unique_learners', count(distinct user_id)::bigint,
    'unique_sessions', count(distinct session_id)::bigint,
    'active_days', count(distinct (occurred_at at time zone 'UTC')::date)::bigint,
    'first_event_at', min(occurred_at),
    'last_event_at', max(occurred_at)
  ) from public.behavior_events;
$$;
revoke all on function public.research_dashboard_summary() from public, anon, authenticated;
grant execute on function public.research_dashboard_summary() to service_role;