drop policy if exists teacher_class_offers_update_own on public.teacher_class_offers;

create policy teacher_class_offers_update_own
on public.teacher_class_offers
for update
to authenticated
using ((select auth.uid()) = teacher_id)
with check (
  (select auth.uid()) = teacher_id
  and (
    status <> 'open'
    or exists (
      select 1
      from public.teacher_profiles tp
      where tp.user_id = (select auth.uid())
        and tp.status = 'active'
        and tp.verified is true
    )
  )
);