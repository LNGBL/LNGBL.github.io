-- LangBlue backend foundation
create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id text primary key,
  label text not null,
  days integer not null check (days > 0),
  months integer,
  price_irt bigint not null default 0 check (price_irt >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  country text,
  country_name text,
  currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text unique not null,
  plan_id text not null references public.plans(id),
  product_ids text[] not null default '{}',
  max_uses integer not null default 1 check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  product_ids text[] not null default '{}',
  activation_code_id uuid references public.activation_codes(id),
  status text not null default 'active' check (status in ('active','expired','revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions(user_id);
create index if not exists subscriptions_expires_idx on public.subscriptions(expires_at);
create index if not exists activation_codes_plan_idx on public.activation_codes(plan_id);

insert into public.products (id,label) values
 ('grammar','LangBlue Grammar'),('vocabulary','LangBlue Vocabulary'),('deutsch','LangBlue Deutsch'),('kurmanci','LangBlue Kurmancî')
on conflict (id) do update set label=excluded.label;

insert into public.plans (id,label,days,months,price_irt) values
 ('irt_7d','۷ روز',7,null,201998),('irt_14d','۱۴ روز',14,null,527998),('irt_21d','۲۱ روز',21,null,913998),
 ('irt_3m','۳ ماه',90,3,1469998),('irt_6m','۶ ماه',180,6,1661998),('irt_12m','۱۲ ماه',365,12,1901998)
on conflict (id) do update set label=excluded.label,days=excluded.days,months=excluded.months,price_irt=excluded.price_irt;

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_sessions enable row level security;
alter table public.activation_codes enable row level security;
alter table public.plans enable row level security;
alter table public.products enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select using (auth.uid() = id);
drop policy if exists subscriptions_self_select on public.subscriptions;
create policy subscriptions_self_select on public.subscriptions for select using (auth.uid() = user_id);
drop policy if exists usage_self_select on public.usage_sessions;
create policy usage_self_select on public.usage_sessions for select using (auth.uid() = user_id);
drop policy if exists products_public_select on public.products;
create policy products_public_select on public.products for select using (active = true);
drop policy if exists plans_public_select on public.plans;
create policy plans_public_select on public.plans for select using (active = true);
-- activation_codes has no client read policy; redemption is server-only.
