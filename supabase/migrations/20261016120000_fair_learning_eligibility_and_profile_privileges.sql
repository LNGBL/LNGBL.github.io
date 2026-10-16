alter table public.community_discount_requests
  add column if not exists declared_age smallint,
  add column if not exists discount_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.community_discount_requests'::regclass
      and conname = 'community_discount_declared_age_range'
  ) then
    alter table public.community_discount_requests
      add constraint community_discount_declared_age_range
      check (declared_age is null or declared_age between 10 and 69);
  end if;
end $$;

-- Profile edits must not let users alter server-owned access/security fields.
revoke update on table public.profiles from authenticated;
grant update (name, username, sex, email, country, country_name, currency,
  language_level, english_level, german_level, arabic_level, favorite_artists,
  exam_contribution_consent, peer_learning_consent, peer_learning_notifications)
on table public.profiles to authenticated;