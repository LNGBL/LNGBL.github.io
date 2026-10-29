grant select on public.teacher_profiles to anon, authenticated;

drop policy if exists teacher_profiles_select_own on public.teacher_profiles;
drop policy if exists teacher_profiles_select_public_verified on public.teacher_profiles;
create policy teacher_profiles_select_own_or_public_verified
on public.teacher_profiles
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (status = 'active' and verified is true)
);
create policy teacher_profiles_select_public_verified
on public.teacher_profiles
for select
to anon
using (status = 'active' and verified is true);

create or replace view public.teacher_public_directory
with (security_invoker = true)
as
select user_id, display_name, age, gender, portrait_url, bio, qualifications,
       languages, product_areas, referral_code, created_at
from public.teacher_profiles
where status = 'active' and verified is true;

grant select on public.teacher_public_directory to anon, authenticated;

drop policy if exists teacher_class_offers_select_open on public.teacher_class_offers;
drop policy if exists teacher_class_offers_select_own on public.teacher_class_offers;
create policy teacher_class_offers_select_public_open
on public.teacher_class_offers
for select
to anon
using (
  status = 'open'
  and exists (
    select 1 from public.teacher_profiles tp
    where tp.user_id = teacher_id and tp.status = 'active' and tp.verified is true
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
      select 1 from public.teacher_profiles tp
      where tp.user_id = teacher_id and tp.status = 'active' and tp.verified is true
    )
  )
);