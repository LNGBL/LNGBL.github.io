create or replace function public.get_public_landing_stats_internal(p_increment boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, langblue_internal
as $$
begin
  return langblue_internal.get_public_landing_stats(p_increment);
end;
$$;

revoke all on function public.get_public_landing_stats_internal(boolean) from public, anon, authenticated;
grant execute on function public.get_public_landing_stats_internal(boolean) to service_role;