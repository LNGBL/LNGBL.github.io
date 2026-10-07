begin;
create table if not exists public.android_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz
);
alter table public.android_handoffs enable row level security;
revoke all on public.android_handoffs from anon, authenticated;
alter table public.behavior_events drop constraint if exists behavior_events_source_check;
alter table public.behavior_events add constraint behavior_events_source_check check (source = any (array['web'::text,'system'::text,'android'::text]));
create index if not exists android_handoffs_token_hash_idx on public.android_handoffs(token_hash);
create index if not exists android_handoffs_user_id_idx on public.android_handoffs(user_id);
commit;
