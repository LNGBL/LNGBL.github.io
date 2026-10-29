alter table public.teacher_profiles
  add column if not exists age smallint,
  add column if not exists gender text,
  add column if not exists portrait_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='teacher_profiles_age_range_check' and conrelid='public.teacher_profiles'::regclass) then
    alter table public.teacher_profiles add constraint teacher_profiles_age_range_check
      check (age is null or age between 10 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname='teacher_profiles_gender_check' and conrelid='public.teacher_profiles'::regclass) then
    alter table public.teacher_profiles add constraint teacher_profiles_gender_check
      check (gender is null or gender in ('female','male','other','prefer_not_to_say'));
  end if;
  if not exists (select 1 from pg_constraint where conname='teacher_profiles_portrait_url_check' and conrelid='public.teacher_profiles'::regclass) then
    alter table public.teacher_profiles add constraint teacher_profiles_portrait_url_check
      check (portrait_url is null or (length(portrait_url) <= 2048 and portrait_url ~ '^https://'));
  end if;
end $$;