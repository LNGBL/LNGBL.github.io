create schema if not exists langblue_internal;

alter table public.teacher_profiles
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists admin_note text not null default '';
alter table public.teacher_profiles drop constraint if exists teacher_profiles_status_check;
alter table public.teacher_profiles add constraint teacher_profiles_status_check
  check (status = any (array['pending','active','suspended','rejected']::text[]));

alter table public.teacher_class_offers
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists admin_note text not null default '';
alter table public.teacher_class_offers drop constraint if exists teacher_class_offers_status_check;
alter table public.teacher_class_offers add constraint teacher_class_offers_status_check
  check (status = any (array['draft','pending_review','open','closed','rejected']::text[]));

alter table public.teacher_content
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists admin_note text not null default '';
alter table public.teacher_content drop constraint if exists teacher_content_status_check;
alter table public.teacher_content add constraint teacher_content_status_check
  check (status = any (array['draft','pending_review','published','archived','rejected']::text[]));

alter table public.content_contributions
  add column if not exists review_status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists admin_note text not null default '';
alter table public.content_contributions alter column exam_eligible set default false;
alter table public.content_contributions drop constraint if exists content_contributions_review_status_check;
alter table public.content_contributions add constraint content_contributions_review_status_check
  check (review_status = any (array['pending','approved','rejected']::text[]));

create index if not exists teacher_profiles_admin_queue_idx
  on public.teacher_profiles (created_at desc) where status = 'pending';
create index if not exists teacher_class_offers_admin_queue_idx
  on public.teacher_class_offers (created_at desc) where status = 'pending_review';
create index if not exists teacher_content_admin_queue_idx
  on public.teacher_content (created_at desc) where status = 'pending_review';
create index if not exists content_contributions_admin_queue_idx
  on public.content_contributions (created_at desc) where review_status = 'pending';

drop policy if exists teacher_profiles_update_own on public.teacher_profiles;
create policy teacher_profiles_update_own_pending_or_rejected
on public.teacher_profiles for update to authenticated
using ((select auth.uid()) = user_id and status in ('pending','rejected'))
with check ((select auth.uid()) = user_id and status = 'pending'
  and verified is false and publishing_trial_started_at is null);

create or replace function langblue_internal.guard_teacher_profile_update()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if (select auth.uid()) is not null and (select auth.uid()) = old.user_id then
    if new.user_id is distinct from old.user_id
      or new.referral_code is distinct from old.referral_code
      or new.verified is distinct from old.verified
      or new.publishing_trial_started_at is distinct from old.publishing_trial_started_at
      or new.created_at is distinct from old.created_at
      or new.reviewed_at is distinct from old.reviewed_at
      or new.reviewed_by is distinct from old.reviewed_by
      or new.admin_note is distinct from old.admin_note then
      raise exception 'PROTECTED_TEACHER_FIELDS';
    end if;
    if new.status is distinct from old.status
      and not (old.status = 'rejected' and new.status = 'pending') then
      raise exception 'PROTECTED_TEACHER_STATUS';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

drop policy if exists teacher_class_offers_update_own on public.teacher_class_offers;
create policy teacher_class_offers_update_own_reviewable
on public.teacher_class_offers for update to authenticated
using ((select auth.uid()) = teacher_id)
with check ((select auth.uid()) = teacher_id and status in ('draft','pending_review','rejected','closed'));

drop policy if exists teacher_content_update_own_draft on public.teacher_content;
create policy teacher_content_update_own_reviewable
on public.teacher_content for update to authenticated
using ((select auth.uid()) = teacher_id and status in ('draft','rejected'))
with check ((select auth.uid()) = teacher_id and status in ('draft','pending_review','rejected'));

drop policy if exists content_contributions_insert on public.content_contributions;
create policy content_contributions_insert_pending_review
on public.content_contributions for insert to authenticated
with check ((select auth.uid()) = user_id and review_status = 'pending' and exam_eligible is false);

create table if not exists langblue_internal.admin_workflow_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  entity_type text not null check (entity_type = any (array['teacher_profile','teacher_offer','teacher_content','content_contribution','admin_staff']::text[])),
  entity_id uuid not null,
  action text not null check (char_length(action) between 1 and 60),
  previous_status text,
  new_status text,
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
alter table langblue_internal.admin_workflow_events enable row level security;
revoke all on langblue_internal.admin_workflow_events from public, anon, authenticated;
grant all on langblue_internal.admin_workflow_events to service_role;
