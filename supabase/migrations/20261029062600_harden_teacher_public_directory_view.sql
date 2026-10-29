revoke select on public.teacher_profiles from anon;
drop policy if exists teacher_profiles_select_public_verified on public.teacher_profiles;

create or replace view public.teacher_public_directory
with (security_invoker = false)
as
select user_id, display_name, age, gender, portrait_url, bio, qualifications,
       languages, product_areas, referral_code, created_at
from public.teacher_profiles
where status = 'active' and verified is true;

grant select on public.teacher_public_directory to anon, authenticated;

drop policy if exists teacher_class_offers_select_public_open on public.teacher_class_offers;
drop policy if exists teacher_class_offers_select_authenticated on public.teacher_class_offers;
create policy teacher_class_offers_select_public_open
on public.teacher_class_offers
for select
to anon
using (
  status = 'open'
  and exists (
    select 1 from public.teacher_public_directory tp
    where tp.user_id = teacher_id
  )
);
create policy teacher_class_offers_select_authenticated
on public.teacher_class_offers
for select
to authenticated
using (
  (select auth.uid()) = teacher_id
  or (
    status = 'open'
    and exists (
      select 1 from public.teacher_public_directory tp
      where tp.user_id = teacher_id
    )
  )
);