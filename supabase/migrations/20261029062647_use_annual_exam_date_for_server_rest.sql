alter table public.langblue_maintenance_control
  add column if not exists annual_exam_date date;

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
  v_annual_exam_date date;
  v_minimum_users integer;
  v_minimum_interval interval;
  v_window_duration interval;
  v_last_activated_at timestamptz;
  v_active_until timestamptz;
  v_should_activate boolean := false;
begin
  select c.minimum_users, c.minimum_interval, c.window_duration,
         c.last_activated_at, c.active_until, c.annual_exam_date
    into v_minimum_users, v_minimum_interval, v_window_duration,
         v_last_activated_at, v_active_until, v_annual_exam_date
  from public.langblue_maintenance_control c
  where c.singleton = true
  for update;

  select count(*) into v_user_count from auth.users;

  v_should_activate :=
    coalesce(v_user_count, 0) >= v_minimum_users
    and v_annual_exam_date is not null
    and v_annual_exam_date >= v_local_now::date
    and extract(isodow from v_local_now)::integer = 4
    and (v_annual_exam_date - v_local_now::date) = 7
    and (
      v_last_activated_at is null
      or v_last_activated_at <= v_now - v_minimum_interval
    );

  if v_should_activate then
    v_active_until := v_now + v_window_duration;
    update public.langblue_maintenance_control
       set active_until = v_active_until,
           last_activated_at = v_now,
           last_exam_date = v_annual_exam_date,
           updated_at = v_now
     where singleton = true;
  elsif v_active_until is not null and v_active_until <= v_now then
    update public.langblue_maintenance_control
       set active_until = null,
           updated_at = v_now
     where singleton = true;
    v_active_until := null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'registered_users', v_user_count,
    'minimum_users', v_minimum_users,
    'annual_exam_date', v_annual_exam_date,
    'activation_check_day', 'Thursday (Asia/Tehran)',
    'activation_days_before_exam', 7,
    'minimum_users_met', coalesce(v_user_count, 0) >= v_minimum_users,
    'window_duration_days', 14,
    'activated_now', v_should_activate,
    'window_active', coalesce(v_active_until > v_now, false),
    'active_until', case when v_active_until > v_now then v_active_until else null end
  );
end;
$function$;