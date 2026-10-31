begin;
alter table public.exam_incidents drop column if exists ip_address;
alter table public.android_devices drop column if exists last_ip_hash;
alter table public.android_pairings drop column if exists browser_ip_hash;
alter table public.android_pairings drop column if exists app_ip_match;

create or replace function langblue_internal.get_public_landing_stats(
  p_increment boolean default false,
  p_ip_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, langblue_internal
as $function$
declare
  v_views bigint;
  v_users bigint;
  v_vocab bigint;
  v_google_users bigint;
  v_counted boolean := false;
begin
  if p_increment and nullif(trim(p_ip_hash), '') is not null then
    insert into langblue_internal.landing_view_ips(ip_hash, last_counted_at)
    values (trim(p_ip_hash), now())
    on conflict (ip_hash) do update
      set last_counted_at = excluded.last_counted_at
      where langblue_internal.landing_view_ips.last_counted_at <= now() - interval '24 hours';

    if found then
      update langblue_internal.landing_stats
        set page_views = page_views + 1, updated_at = now()
      where id = true;
      v_counted := true;
    end if;

    delete from langblue_internal.landing_view_ips
    where last_counted_at < now() - interval '24 hours';
  end if;

  select page_views into v_views from langblue_internal.landing_stats where id = true;
  select count(*) into v_users from auth.users;
  select count(distinct lower(trim(source_content))) into v_vocab
    from public.question_pool
    where active=true and source_type='vocabulary'
      and nullif(trim(source_content),'') is not null;
  select count(distinct user_id) into v_google_users
    from auth.identities where provider='google';

  return jsonb_build_object(
    'page_views',coalesce(v_views,0),
    'user_accounts',coalesce(v_users,0),
    'google_users',coalesce(v_google_users,0),
    'vocabulary_count',coalesce(v_vocab,0),
    'counted_this_request',v_counted
  );
end;
$function$;

delete from langblue_internal.landing_view_ips
where last_counted_at < now() - interval '24 hours';
commit;
