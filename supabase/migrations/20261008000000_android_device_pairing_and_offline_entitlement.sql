-- Android device pairing, server-side device approval, and offline entitlement metadata.
create table if not exists public.android_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key_hash text not null unique,
  device_label text not null default 'Android device',
  platform text not null default 'android',
  app_version text,
  last_ip_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  approved_at timestamptz not null default now(),
  revoked_at timestamptz,
  offline_until timestamptz,
  subscription_expires_at timestamptz
);
create index if not exists android_devices_user_idx on public.android_devices(user_id);
create index if not exists android_devices_ip_idx on public.android_devices(last_ip_hash);

create table if not exists public.android_pairings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key_hash text not null,
  browser_ip_hash text,
  browser_user_agent text,
  device_label text not null default 'Android device',
  app_version text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  decided_at timestamptz,
  consumed_at timestamptz,
  app_ip_match boolean
);
create index if not exists android_pairings_device_idx on public.android_pairings(device_key_hash);
create index if not exists android_pairings_user_idx on public.android_pairings(user_id);
create index if not exists android_pairings_expiry_idx on public.android_pairings(expires_at);

alter table public.android_devices enable row level security;
alter table public.android_pairings enable row level security;
revoke all on public.android_devices from anon, authenticated;
revoke all on public.android_pairings from anon, authenticated;
