-- LangBlue Supabase schema
-- Run this file once in Supabase Dashboard -> SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  username text not null unique,
  sex text,
  email text,
  country text,
  country_name text,
  currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_state enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own"
on public.user_state for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own"
on public.user_state for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own"
on public.user_state for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Automatically create a profile row after Supabase Auth registration.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, name, username, sex, email, country, country_name, currency
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'username', ''),
    new.raw_user_meta_data->>'sex',
    new.email,
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'countryName',
    new.raw_user_meta_data->>'currency'
  )
  on conflict (id) do update set
    name = excluded.name,
    username = excluded.username,
    sex = excluded.sex,
    email = excluded.email,
    country = excluded.country,
    country_name = excluded.country_name,
    currency = excluded.currency,
    updated_at = now();

  insert into public.user_state (user_id, state)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();


-- Phase 1 behavioral research event ledger.
-- Event writes are performed by the authenticated langblue-behavior Edge Function.
create table if not exists public.behavior_events (
  event_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (char_length(event_name) between 2 and 80),
  product_id text references public.products(id) on delete set null,
  language text check (language is null or char_length(language) between 2 and 32),
  session_id uuid,
  context_id text check (context_id is null or char_length(context_id) <= 160),
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  schema_version smallint not null default 1 check (schema_version > 0),
  source text not null default 'web' check (source in ('web','system')),
  created_at timestamptz not null default now()
);
create index if not exists behavior_events_user_time_idx on public.behavior_events(user_id, occurred_at desc);
create index if not exists behavior_events_event_time_idx on public.behavior_events(event_name, occurred_at desc);
create index if not exists behavior_events_product_time_idx on public.behavior_events(product_id, occurred_at desc);
create index if not exists behavior_events_session_idx on public.behavior_events(session_id, occurred_at);
alter table public.behavior_events enable row level security;
drop policy if exists behavior_events_self_select on public.behavior_events;
create policy behavior_events_self_select on public.behavior_events
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.behavior_events from anon, authenticated;
grant select on public.behavior_events to authenticated;

-- Behavioral research aggregates. Raw events remain the source of truth.
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

-- Behavioral research aggregates. Raw events remain the source of truth.
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


-- Protected research dashboard access. Direct client access is denied.
create table if not exists public.research_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.research_admins enable row level security;
drop policy if exists research_admins_no_direct_select on public.research_admins;
create policy research_admins_no_direct_select on public.research_admins
  for select to authenticated using (false);
revoke all on public.research_admins from anon, authenticated;
grant all on public.research_admins to service_role;
create index if not exists research_admins_created_idx on public.research_admins(created_at desc);

create or replace function public.research_dashboard_summary()
returns jsonb
language sql
stable
set search_path = public
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
