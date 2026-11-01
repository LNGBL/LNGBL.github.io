create or replace function langblue_internal.guard_teacher_profile_insert()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if (select auth.uid()) is not null and (select auth.uid()) = new.user_id then
    if new.status <> 'pending' or new.verified is not false
      or new.publishing_trial_started_at is not null
      or new.reviewed_at is not null or new.reviewed_by is not null
      or new.admin_note <> '' then
      raise exception 'PROTECTED_TEACHER_FIELDS';
    end if;
  end if;
  return new;
end;
$function$;
drop trigger if exists teacher_profiles_guard_insert on public.teacher_profiles;
create trigger teacher_profiles_guard_insert before insert on public.teacher_profiles
for each row execute function langblue_internal.guard_teacher_profile_insert();

create or replace function langblue_internal.guard_teacher_offer_review_fields()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if (select auth.uid()) is not null and (select auth.uid()) = old.teacher_id then
    if new.teacher_id is distinct from old.teacher_id
      or new.public_teacher_key is distinct from old.public_teacher_key
      or new.created_at is distinct from old.created_at
      or new.reviewed_at is distinct from old.reviewed_at
      or new.reviewed_by is distinct from old.reviewed_by
      or new.admin_note is distinct from old.admin_note then
      raise exception 'PROTECTED_TEACHER_OFFER_FIELDS';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;
drop trigger if exists teacher_class_offers_guard_review_fields on public.teacher_class_offers;
create trigger teacher_class_offers_guard_review_fields before update on public.teacher_class_offers
for each row execute function langblue_internal.guard_teacher_offer_review_fields();

create or replace function langblue_internal.guard_teacher_offer_insert()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if (select auth.uid()) is not null and (select auth.uid()) = new.teacher_id then
    if new.status <> 'draft' or new.reviewed_at is not null
      or new.reviewed_by is not null or new.admin_note <> '' then
      raise exception 'PROTECTED_TEACHER_OFFER_FIELDS';
    end if;
  end if;
  return new;
end;
$function$;
drop trigger if exists teacher_class_offers_guard_insert on public.teacher_class_offers;
create trigger teacher_class_offers_guard_insert before insert on public.teacher_class_offers
for each row execute function langblue_internal.guard_teacher_offer_insert();

create or replace function langblue_internal.guard_teacher_content_review_fields()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if (select auth.uid()) is not null and (select auth.uid()) = old.teacher_id then
    if new.teacher_id is distinct from old.teacher_id
      or new.created_at is distinct from old.created_at
      or new.reviewed_at is distinct from old.reviewed_at
      or new.reviewed_by is distinct from old.reviewed_by
      or new.admin_note is distinct from old.admin_note
      or new.published_at is distinct from old.published_at then
      raise exception 'PROTECTED_TEACHER_CONTENT_FIELDS';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;
drop trigger if exists teacher_content_guard_review_fields on public.teacher_content;
create trigger teacher_content_guard_review_fields before update on public.teacher_content
for each row execute function langblue_internal.guard_teacher_content_review_fields();

create or replace function langblue_internal.guard_teacher_content_insert()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if (select auth.uid()) is not null and (select auth.uid()) = new.teacher_id then
    if new.status <> 'draft' or new.reviewed_at is not null
      or new.reviewed_by is not null or new.admin_note <> ''
      or new.published_at is not null then
      raise exception 'PROTECTED_TEACHER_CONTENT_FIELDS';
    end if;
  end if;
  return new;
end;
$function$;
drop trigger if exists teacher_content_guard_insert on public.teacher_content;
create trigger teacher_content_guard_insert before insert on public.teacher_content
for each row execute function langblue_internal.guard_teacher_content_insert();

drop policy if exists teacher_profiles_insert_own_pending on public.teacher_profiles;
create policy teacher_profiles_insert_own_pending
on public.teacher_profiles for insert to authenticated
with check (
 (select auth.uid()) = user_id and status = 'pending' and verified is false
 and publishing_trial_started_at is null and reviewed_at is null
 and reviewed_by is null and admin_note = ''
);
drop policy if exists teacher_class_offers_insert_own_draft on public.teacher_class_offers;
create policy teacher_class_offers_insert_own_draft
on public.teacher_class_offers for insert to authenticated
with check (
 (select auth.uid()) = teacher_id and status = 'draft'
 and reviewed_at is null and reviewed_by is null and admin_note = ''
);
drop policy if exists teacher_content_insert_own_draft on public.teacher_content;
create policy teacher_content_insert_own_draft
on public.teacher_content for insert to authenticated
with check (
 (select auth.uid()) = teacher_id and status = 'draft'
 and reviewed_at is null and reviewed_by is null and admin_note = ''
 and published_at is null
);
drop policy if exists content_contributions_insert_pending_review on public.content_contributions;
create policy content_contributions_insert_pending_review
on public.content_contributions for insert to authenticated
with check (
 (select auth.uid()) = user_id and review_status = 'pending'
 and exam_eligible is false and reviewed_at is null
 and reviewed_by is null and admin_note = ''
);
