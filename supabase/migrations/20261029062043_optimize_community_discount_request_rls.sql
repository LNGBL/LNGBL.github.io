drop policy if exists "users can view own community discount request" on public.community_discount_requests;
create policy "users can view own community discount request"
on public.community_discount_requests
for select
to authenticated
using ((select auth.uid()) = user_id);