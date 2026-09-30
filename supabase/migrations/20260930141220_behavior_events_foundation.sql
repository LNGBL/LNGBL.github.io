create table if not exists public.behavior_events (
  event_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (char_length(event_name) between 2 and 80),
  product_id text null references public.products(id) on delete set null,
  language text null check (language is null or char_length(language) between 2 and 32),
  session_id uuid null,
  context_id text null check (context_id is null or char_length(context_id) <= 160),
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