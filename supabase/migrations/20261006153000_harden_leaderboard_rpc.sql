begin;
drop policy if exists leaderboard_self_insert on public.leaderboard;
create policy leaderboard_self_insert on public.leaderboard
for insert to authenticated
with check ((select auth.uid())=user_id);

drop policy if exists leaderboard_self_update on public.leaderboard;
create policy leaderboard_self_update on public.leaderboard
for update to authenticated
using ((select auth.uid())=user_id)
with check ((select auth.uid())=user_id);

alter function public.sync_leaderboard(integer,integer,integer,integer,integer,text,text) security invoker;
revoke execute on function public.sync_leaderboard(integer,integer,integer,integer,integer,text,text) from anon;
grant execute on function public.sync_leaderboard(integer,integer,integer,integer,integer,text,text) to authenticated;
commit;