create or replace function public.grant_48h_trial(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_start timestamptz;
  v_exp timestamptz;
begin
  select trial_started_at, trial_expires_at
    into v_start, v_exp
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_start is null then
    v_start = now();
    v_exp = v_start + interval '48 hours';
    update public.profiles
      set trial_started_at = v_start,
          trial_expires_at = v_exp,
          updated_at = now()
    where id = p_user_id;

    insert into public.subscriptions
      (user_id, plan_id, product_ids, status, starts_at, expires_at)
    values
      (p_user_id, 'trial_48h',
       array['grammar','vocabulary','deutsch','arabic','langjp','langkz'],
       'active', v_start, v_exp);
  end if;
end;
$function$;

revoke execute on function public.grant_48h_trial(uuid) from public, anon, authenticated;
grant execute on function public.grant_48h_trial(uuid) to service_role;
