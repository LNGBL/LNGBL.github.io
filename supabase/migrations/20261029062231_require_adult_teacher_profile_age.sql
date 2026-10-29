alter table public.teacher_profiles drop constraint if exists teacher_profiles_age_range_check;
alter table public.teacher_profiles add constraint teacher_profiles_age_range_check
  check (age is null or age between 18 and 120);