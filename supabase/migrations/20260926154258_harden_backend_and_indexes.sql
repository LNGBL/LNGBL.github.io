-- LangBlue backend hardening
-- Applied to the LangBlue Supabase project as 20260926154258_harden_backend_and_indexes.sql

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;

create index if not exists subscriptions_plan_id_idx on public.subscriptions(plan_id);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists usage_sessions_product_id_idx on public.usage_sessions(product_id);
create index if not exists usage_sessions_user_id_idx on public.usage_sessions(user_id);

drop policy if exists profiles_self_select on public.profiles;

alter policy profiles_select_own on public.profiles
  using ((select auth.uid()) = id);
alter policy profiles_insert_own on public.profiles
  with check ((select auth.uid()) = id);
alter policy profiles_update_own on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy user_state_select_own on public.user_state
  using ((select auth.uid()) = user_id);
alter policy user_state_insert_own on public.user_state
  with check ((select auth.uid()) = user_id);
alter policy user_state_update_own on public.user_state
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy subscriptions_self_select on public.subscriptions
  using ((select auth.uid()) = user_id);

alter policy usage_self_select on public.usage_sessions
  using ((select auth.uid()) = user_id);
