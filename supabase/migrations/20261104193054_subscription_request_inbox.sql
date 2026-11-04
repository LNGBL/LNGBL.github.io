create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  request_ref text generated always as ('LB-REQ-' || upper(substr(replace(id::text, '-', ''), 1, 12))) stored unique,
  request_hash text not null unique,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  learner_user_id uuid not null references auth.users(id) on delete cascade,
  product_ids text[] not null,
  plan_id text not null,
  discount_preview jsonb not null default '{}'::jsonb,
  status text not null default 'pending_admin_review'
    check (status in ('pending_admin_review','needs_info','reviewed','closed')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_requests_products_nonempty check (cardinality(product_ids) between 1 and 7),
  constraint subscription_requests_plan_valid check (plan_id in ('irt_7d','irt_14d','irt_21d','irt_3m','irt_6m','irt_12m'))
);

create index if not exists subscription_requests_created_idx
  on public.subscription_requests (created_at desc);
create index if not exists subscription_requests_learner_idx
  on public.subscription_requests (learner_user_id, created_at desc);
create index if not exists subscription_requests_requester_idx
  on public.subscription_requests (requester_user_id, created_at desc);

alter table public.subscription_requests enable row level security;
revoke all on table public.subscription_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.subscription_requests to service_role;
grant usage on schema public to service_role;

comment on table public.subscription_requests is
  'Non-financial LangBlue subscription request inbox. Contains no bank receipt, payment status, payment credentials, or entitlement activation.';
comment on column public.subscription_requests.request_hash is
  'Opaque SHA-256 request integrity/reference value; not proof of payment or entitlement.';
comment on column public.subscription_requests.discount_preview is
  'Non-binding eligibility preview only; never a calculated payable amount or applied discount.';
