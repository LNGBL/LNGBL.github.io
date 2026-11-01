create table if not exists public.admin_workflow_events (
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 entity_type text not null check (entity_type = any (array['teacher_profile','teacher_offer','teacher_content','content_contribution','admin_staff']::text[])),
 entity_id uuid not null,
 action text not null check (char_length(action) between 1 and 60),
 previous_status text,
 new_status text,
 note text not null default '' check (char_length(note) <= 1000),
 created_at timestamptz not null default now()
);
alter table public.admin_workflow_events enable row level security;
revoke all on public.admin_workflow_events from public, anon, authenticated;
grant all on public.admin_workflow_events to service_role;
create index if not exists admin_workflow_events_created_idx on public.admin_workflow_events(created_at desc);
drop table if exists langblue_internal.admin_workflow_events;
