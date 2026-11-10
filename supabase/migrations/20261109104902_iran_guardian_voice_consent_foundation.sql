create table if not exists public.subscription_guardian_consents (
  id uuid primary key default gen_random_uuid(),
  learner_user_id uuid not null references auth.users(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  product_ids text[] not null,
  plan_id text not null,
  amount_irt bigint not null check (amount_irt > 0),
  decision text not null check (decision in ('consent','declined')),
  audio_path text not null unique,
  policy_version text not null,
  review_status text not null default 'pending_admin_review'
    check (review_status in ('pending_admin_review','approved','rejected','acknowledged')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  retention_until timestamptz,
  audio_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint guardian_consent_not_self check (learner_user_id <> guardian_user_id)
);

alter table public.subscription_requests
  add column if not exists guardian_consent_id uuid
  references public.subscription_guardian_consents(id);

create index if not exists subscription_guardian_consents_review_idx
  on public.subscription_guardian_consents(review_status, created_at desc);
create index if not exists subscription_guardian_consents_retention_idx
  on public.subscription_guardian_consents(retention_until)
  where audio_deleted_at is null;

alter table public.subscription_guardian_consents enable row level security;
revoke all on public.subscription_guardian_consents from anon, authenticated;
grant all on public.subscription_guardian_consents to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'langblue-guardian-consent-audio',
  'langblue-guardian-consent-audio',
  false,
  10485760,
  array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists guardian_consent_audio_insert_own_folder on storage.objects;
create policy guardian_consent_audio_insert_own_folder
on storage.objects for insert to authenticated
with check (
  bucket_id = 'langblue-guardian-consent-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webm|m4a|ogg|mp3|wav)$'
);

create or replace function public.enforce_subscription_guardian_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and new.learner_user_id <> new.requester_user_id then
    if new.guardian_consent_id is null or not exists (
      select 1
      from public.subscription_guardian_consents c
      join public.guardian_relationships r
        on r.learner_user_id = c.learner_user_id
       and r.guardian_user_id = c.guardian_user_id
       and r.status = 'active'
       and r.scopes @> array['account_support']::text[]
      where c.id = new.guardian_consent_id
        and c.learner_user_id = new.learner_user_id
        and c.guardian_user_id = new.requester_user_id
        and c.product_ids = new.product_ids
        and c.plan_id = new.plan_id
        and c.amount_irt = new.amount_irt
        and c.decision = 'consent'
        and c.review_status = 'approved'
        and c.retention_until > now()
        and c.audio_deleted_at is null
    ) then
      raise exception 'GUARDIAN_CONSENT_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_subscription_guardian_consent() from public, anon, authenticated;
drop trigger if exists trg_enforce_subscription_guardian_consent on public.subscription_requests;
create trigger trg_enforce_subscription_guardian_consent
before update of status on public.subscription_requests
for each row execute function public.enforce_subscription_guardian_consent();
