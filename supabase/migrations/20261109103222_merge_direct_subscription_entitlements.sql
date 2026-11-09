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
as $function$
declare
  v_request public.subscription_requests%rowtype;
  v_plan public.plans%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_existing_products text[] := '{}'::text[];
  v_existing_expires timestamptz;
  v_existing_starts timestamptz;
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

    if v_request.receipt_path !~ ('^' || v_request.requester_user_id::text || '/') then
      raise exception 'INVALID_RECEIPT_PATH';
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

    perform s.id
    from public.subscriptions s
    where s.user_id = v_request.learner_user_id
      and s.status = 'active'
      and s.expires_at > now()
    for update;

    select
      coalesce(array_agg(distinct u.product_id order by u.product_id), '{}'::text[]),
      max(s.expires_at),
      min(s.starts_at)
    into v_existing_products, v_existing_expires, v_existing_starts
    from public.subscriptions s
    cross join lateral unnest(s.product_ids) as u(product_id)
    where s.user_id = v_request.learner_user_id
      and s.status = 'active'
      and s.expires_at > now();

    select * into v_subscription
    from public.subscriptions s
    where s.user_id = v_request.learner_user_id
      and s.status = 'active'
      and s.expires_at > now()
    order by s.expires_at desc, s.created_at desc
    limit 1
    for update;

    if found then
      update public.subscriptions
      set plan_id = v_request.plan_id,
          product_ids = (
            select coalesce(array_agg(distinct merged.product_id order by merged.product_id), '{}'::text[])
            from unnest(v_existing_products || v_request.product_ids) as merged(product_id)
          ),
          activation_code_id = null,
          starts_at = coalesce(v_existing_starts, starts_at),
          expires_at = greatest(coalesce(v_existing_expires, now()), now())
            + (v_plan.days * interval '1 day'),
          updated_at = now()
      where id = v_subscription.id
      returning * into v_subscription;

      update public.subscriptions
      set status = 'expired',
          updated_at = now()
      where user_id = v_request.learner_user_id
        and status = 'active'
        and expires_at > now()
        and id <> v_subscription.id;
    else
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
    'expires_at', case when p_decision = 'approved' then v_subscription.expires_at else null end,
    'product_ids', case when p_decision = 'approved' then to_jsonb(v_subscription.product_ids) else null end
  );
end;
$function$;

revoke all on function public.review_subscription_payment(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.review_subscription_payment(uuid,uuid,text,text) to service_role;
