drop policy if exists teacher_class_offers_select_public_open on public.teacher_class_offers;
drop policy if exists teacher_class_offers_select_authenticated on public.teacher_class_offers;
drop view if exists public.teacher_public_directory;

create table if not exists public.teacher_public_directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  age smallint,
  gender text,
  portrait_url text,
  bio text,
  qualifications text,
  languages text[] not null default '{}',
  product_areas text[] not null default '{}',
  referral_code text,
  created_at timestamptz not null default now()
);

alter table public.teacher_public_directory enable row level security;
grant select on public.teacher_public_directory to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.teacher_public_directory from anon, authenticated;
drop policy if exists teacher_public_directory_select on public.teacher_public_directory;
create policy teacher_public_directory_select
on public.teacher_public_directory
for select
to anon, authenticated
using (true);

create or replace function langblue_internal.sync_teacher_public_directory()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    delete from public.teacher_public_directory where user_id = old.user_id;
    return old;
  end if;

  if new.status = 'active' and new.verified is true then
    insert into public.teacher_public_directory (
      user_id, display_name, age, gender, portrait_url, bio, qualifications,
      languages, product_areas, referral_code, created_at
    ) values (
      new.user_id, new.display_name, new.age, new.gender, new.portrait_url, new.bio,
      new.qualifications, coalesce(new.languages, '{}'), coalesce(new.product_areas, '{}'),
      new.referral_code, new.created_at
    )
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      age = excluded.age,
      gender = excluded.gender,
      portrait_url = excluded.portrait_url,
      bio = excluded.bio,
      qualifications = excluded.qualifications,
      languages = excluded.languages,
      product_areas = excluded.product_areas,
      referral_code = excluded.referral_code,
      created_at = excluded.created_at;
  else
    delete from public.teacher_public_directory where user_id = new.user_id;
  end if;

  return new;
end;
$function$;

revoke all on function langblue_internal.sync_teacher_public_directory() from public, anon, authenticated;

drop trigger if exists sync_teacher_public_directory on public.teacher_profiles;
create trigger sync_teacher_public_directory
after insert or update or delete on public.teacher_profiles
for each row execute function langblue_internal.sync_teacher_public_directory();

insert into public.teacher_public_directory (
  user_id, display_name, age, gender, portrait_url, bio, qualifications,
  languages, product_areas, referral_code, created_at
)
select user_id, display_name, age, gender, portrait_url, bio, qualifications,
       coalesce(languages, '{}'), coalesce(product_areas, '{}'), referral_code, created_at
from public.teacher_profiles
where status = 'active' and verified is true
on conflict (user_id) do update set
  display_name = excluded.display_name,
  age = excluded.age,
  gender = excluded.gender,
  portrait_url = excluded.portrait_url,
  bio = excluded.bio,
  qualifications = excluded.qualifications,
  languages = excluded.languages,
  product_areas = excluded.product_areas,
  referral_code = excluded.referral_code,
  created_at = excluded.created_at;

create policy teacher_class_offers_select_public_open
on public.teacher_class_offers
for select
to anon
using (
  status = 'open'
  and exists (select 1 from public.teacher_public_directory tp where tp.user_id = teacher_id)
);
create policy teacher_class_offers_select_authenticated
on public.teacher_class_offers
for select
to authenticated
using (
  (select auth.uid()) = teacher_id
  or (status = 'open' and exists (select 1 from public.teacher_public_directory tp where tp.user_id = teacher_id))
);