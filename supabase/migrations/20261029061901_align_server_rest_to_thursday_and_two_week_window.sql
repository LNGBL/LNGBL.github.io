update public.langblue_maintenance_control
set window_duration = interval '14 days',
    minimum_users = 100,
    minimum_interval = interval '14 days',
    updated_at = now()
where singleton = true;

create or replace function public.refresh_langblue_maintenance_policy()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_local_now timestamp := v_now at time zone 'Asia/Tehran';
  v_user_count bigint;
  v_next_exam date;
  v_minimum_users integer;
  v_minimum_interval interval;
  v_window_duration interval;
  v_last_activated_at timestamptz;
  v_active_until timestamptz;
  v_should_activate boolean := false;
begin
  select c.minimum_users, c.minimum_interval, c.window_duration,
         c.last_activated_at, c.active_until
    into v_minimum_users, v_minimum_interval, v_window_duration,
         v_last_activated_at, v_active_until
  from public.langblue_maintenance_control c
  where c.singleton = true
  for update;

  select count(*) into v_user_count from auth.users;

  select min(ep.cycle_date)
    into v_next_exam
  from public.exam_periods ep
  where ep.status = 'scheduled'
    and ep.cycle_date >= v_local_now::date;

  v_should_activate :=
    coalesce(v_user_count, 0) >= v_minimum_users
    and v_next_exam is not null
    and extract(isodow from v_local_now)::integer = 4
    and (v_next_exam - v_local_now::date) between 7 and 8
    and (
      v_last_activated_at is null
      or v_last_activated_at <= v_now - v_minimum_interval
    );

  if v_should_activate then
    v_active_until := v_now + v_window_duration;
    update public.langblue_maintenance_control
       set active_until = v_active_until,
           last_activated_at = v_now,
           last_exam_date = v_next_exam,
           updated_at = v_now
     where singleton = true;
  elsif v_active_until is not null and v_active_until <= v_now then
    update public.langblue_maintenance_control
       set active_until = null,
           updated_at = v_now
     where singleton = true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'registered_users', v_user_count,
    'minimum_users', v_minimum_users,
    'next_scheduled_exam', v_next_exam,
    'activation_check_day', 'Thursday (Asia/Tehran)',
    'activation_days_before_exam', 7,
    'activated', v_should_activate,
    'active_until', case when v_should_activate then v_active_until else null end
  );
end;
$function$;