alter table public.subscription_requests
  add column if not exists amount_irt bigint,
  add column if not exists receipt_path text,
  add column if not exists receipt_uploaded_at timestamptz;

update public.subscription_requests r
set amount_irt = coalesce(p.price_irt, 0) * cardinality(r.product_ids)
from public.plans p
where p.id = r.plan_id and r.amount_irt is null;

update public.subscription_requests
set amount_irt = 0
where amount_irt is null;

alter table public.subscription_requests
  alter column amount_irt set not null;

alter table public.subscription_requests
  drop constraint if exists subscription_requests_status_check;

alter table public.subscription_requests
  add constraint subscription_requests_status_check
  check (status in ('pending_admin_review','needs_info','reviewed','closed','approved','rejected'));

create index if not exists subscription_requests_payment_queue_idx
  on public.subscription_requests (status, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'langblue-payment-receipts',
  'langblue-payment-receipts',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create or replace function public.review_subscription_payment(
  p_request_id uuid,
  p_admin_user_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_request public.subscription_requests%rowtype;
  v_plan public.plans%rowtype;
  v_subscription public.subscriptions%rowtype;
begin
  if not exists (
    select 1 from public.platform_admins
    where user_id = p_admin_user_id
  ) then
    raise exception 'ADMIN_UNAUTHORIZED';
  end if;

  if p_decision not in ('approved','rejected') then
    raise exception 'INVALID_DECISION';
  end if;

  select * into v_request
  from public.subscription_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if v_request.status not in ('pending_admin_review','needs_info') then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  if p_decision = 'approved' then
    if v_request.receipt_path is null then
      raise exception 'RECEIPT_REQUIRED';
    end if;

    if not exists (
      select 1 from storage.objects
      where bucket_id = 'langblue-payment-receipts'
        and name = v_request.receipt_path
    ) then
      raise exception 'RECEIPT_FILE_MISSING';
    end if;

    select * into v_plan
    from public.plans
    where id = v_request.plan_id and active = true;

    if not found or v_plan.days <= 0 then
      raise exception 'PLAN_UNAVAILABLE';
    end if;

    insert into public.subscriptions (
      user_id, plan_id, product_ids, activation_code_id,
      status, starts_at, expires_at
    )
    values (
      v_request.learner_user_id,
      v_request.plan_id,
      v_request.product_ids,
      null,
      'active',
      now(),
      now() + (v_plan.days * interval '1 day')
    )
    returning * into v_subscription;
  end if;

  update public.subscription_requests
  set status = p_decision,
      admin_note = nullif(left(coalesce(p_note,''),1000),''),
      reviewed_by = p_admin_user_id,
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'status', p_decision,
    'subscription_id', case when p_decision = 'approved' then v_subscription.id else null end,
    'expires_at', case when p_decision = 'approved' then v_subscription.expires_at else null end
  );
end;
$$;

revoke all on function public.review_subscription_payment(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.review_subscription_payment(uuid,uuid,text,text) to service_role;

comment on column public.subscription_requests.receipt_path is
  'Path of the private uploaded payment receipt. Never expose a public URL.';
comment on column public.subscription_requests.amount_irt is
  'Expected amount in Iranian rials, snapshotted at request creation.';
