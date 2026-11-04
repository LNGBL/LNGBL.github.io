create table if not exists public.guardian_age_verifications (
  guardian_user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','verified','revoked')),
  verification_method text,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status <> 'verified'
    or (verification_method is not null and char_length(verification_method) between 3 and 80
        and verified_at is not null and expires_at is not null and expires_at > verified_at)
  )
);
alter table public.guardian_age_verifications enable row level security;
revoke all on public.guardian_age_verifications from public, anon, authenticated;
grant all on public.guardian_age_verifications to service_role;

create table if not exists public.guardian_consent_requests (
  id uuid primary key default gen_random_uuid(),
  learner_user_id uuid not null references auth.users(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  learner_declared_minor boolean not null default true,
  requested_scopes text[] not null,
  policy_version text not null,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  responded_at timestamptz,
  check (learner_user_id <> guardian_user_id),
  check (cardinality(requested_scopes) between 1 and 4),
  check (requested_scopes <@ array['account_support','learning_progress','community_features','research_participation']::text[])
);
alter table public.guardian_consent_requests enable row level security;
revoke all on public.guardian_consent_requests from public, anon, authenticated;
grant all on public.guardian_consent_requests to service_role;
create index if not exists guardian_consent_requests_guardian_pending_idx
  on public.guardian_consent_requests (guardian_user_id, created_at desc)
  where status = 'pending';
create index if not exists guardian_consent_requests_learner_idx
  on public.guardian_consent_requests (learner_user_id, created_at desc);
create unique index if not exists guardian_consent_one_pending_pair_idx
  on public.guardian_consent_requests (learner_user_id, guardian_user_id)
  where status = 'pending';

create table if not exists public.guardian_relationships (
  id uuid primary key default gen_random_uuid(),
  learner_user_id uuid not null references auth.users(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  scopes text[] not null,
  policy_version text not null,
  status text not null default 'active' check (status in ('active','revoked')),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  check (learner_user_id <> guardian_user_id),
  check (cardinality(scopes) between 1 and 4),
  check (scopes <@ array['account_support','learning_progress','community_features','research_participation']::text[]),
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null))
);
alter table public.guardian_relationships enable row level security;
revoke all on public.guardian_relationships from public, anon, authenticated;
grant all on public.guardian_relationships to service_role;
create unique index if not exists guardian_relationship_one_active_pair_idx
  on public.guardian_relationships (learner_user_id, guardian_user_id)
  where status = 'active';
create index if not exists guardian_relationships_learner_idx
  on public.guardian_relationships (learner_user_id, accepted_at desc);
create index if not exists guardian_relationships_guardian_idx
  on public.guardian_relationships (guardian_user_id, accepted_at desc);

create table if not exists public.guardian_consent_audit (
  id bigint generated always as identity primary key,
  request_id uuid references public.guardian_consent_requests(id) on delete cascade,
  relationship_id uuid references public.guardian_relationships(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('request_created','request_accepted','request_rejected','request_cancelled','consent_revoked')),
  policy_version text not null,
  scope_snapshot text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.guardian_consent_audit enable row level security;
revoke all on public.guardian_consent_audit from public, anon, authenticated;
grant all on public.guardian_consent_audit to service_role;

create or replace function public.lb_guardian_create_request(
  p_learner_user_id uuid, p_guardian_user_id uuid, p_scopes text[], p_policy_version text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if p_learner_user_id is null or p_guardian_user_id is null or p_learner_user_id = p_guardian_user_id then
    return jsonb_build_object('ok',false,'error','INVALID_GUARDIAN');
  end if;
  if p_policy_version is null or p_policy_version <> '2026-11-04-v1' then
    return jsonb_build_object('ok',false,'error','POLICY_VERSION_MISMATCH');
  end if;
  if p_scopes is null or cardinality(p_scopes) < 1 or cardinality(p_scopes) > 4
     or not (p_scopes <@ array['account_support','learning_progress','community_features','research_participation']::text[]) then
    return jsonb_build_object('ok',false,'error','INVALID_SCOPES');
  end if;
  if exists (select 1 from public.guardian_consent_requests r
    where r.learner_user_id = p_learner_user_id and r.guardian_user_id = p_guardian_user_id
      and r.status = 'pending' and r.expires_at > now()) then
    return jsonb_build_object('ok',false,'error','REQUEST_ALREADY_PENDING');
  end if;
  insert into public.guardian_consent_requests
    (learner_user_id,guardian_user_id,learner_declared_minor,requested_scopes,policy_version)
  values (p_learner_user_id,p_guardian_user_id,true,p_scopes,p_policy_version)
  returning id into v_id;
  insert into public.guardian_consent_audit(request_id,actor_user_id,event_type,policy_version,scope_snapshot)
  values(v_id,p_learner_user_id,'request_created',p_policy_version,p_scopes);
  return jsonb_build_object('ok',true,'request_id',v_id);
end; $$;

create or replace function public.lb_guardian_accept_request(
  p_request_id uuid, p_guardian_user_id uuid, p_scopes text[]
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_req public.guardian_consent_requests%rowtype; v_relationship_id uuid;
begin
  select * into v_req from public.guardian_consent_requests
  where id = p_request_id and guardian_user_id = p_guardian_user_id
    and status = 'pending' and expires_at > now() for update;
  if not found then return jsonb_build_object('ok',false,'error','REQUEST_NOT_AVAILABLE'); end if;
  if not exists (select 1 from public.guardian_age_verifications v
    where v.guardian_user_id = p_guardian_user_id and v.status = 'verified'
      and v.verified_at is not null and v.expires_at > now()
      and v.verification_method is not null) then
    return jsonb_build_object('ok',false,'error','GUARDIAN_AGE_VERIFICATION_REQUIRED');
  end if;
  if p_scopes is null or cardinality(p_scopes) < 1 or not (p_scopes <@ v_req.requested_scopes) then
    return jsonb_build_object('ok',false,'error','INVALID_ACCEPTED_SCOPES');
  end if;
  insert into public.guardian_relationships
    (learner_user_id,guardian_user_id,scopes,policy_version,status)
  values (v_req.learner_user_id,p_guardian_user_id,p_scopes,v_req.policy_version,'active')
  returning id into v_relationship_id;
  update public.guardian_consent_requests set status = 'accepted', responded_at = now() where id = v_req.id;
  insert into public.guardian_consent_audit
    (request_id,relationship_id,actor_user_id,event_type,policy_version,scope_snapshot)
  values (v_req.id,v_relationship_id,p_guardian_user_id,'request_accepted',v_req.policy_version,p_scopes);
  return jsonb_build_object('ok',true,'relationship_id',v_relationship_id);
exception when unique_violation then
  return jsonb_build_object('ok',false,'error','ACTIVE_RELATIONSHIP_ALREADY_EXISTS');
end; $$;

create or replace function public.lb_guardian_close_request(
  p_request_id uuid, p_actor_user_id uuid, p_action text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_req public.guardian_consent_requests%rowtype; v_status text; v_event text;
begin
  select * into v_req from public.guardian_consent_requests
  where id = p_request_id and status = 'pending' and expires_at > now() for update;
  if not found then return jsonb_build_object('ok',false,'error','REQUEST_NOT_AVAILABLE'); end if;
  if p_action = 'reject' and p_actor_user_id = v_req.guardian_user_id then
    v_status := 'rejected'; v_event := 'request_rejected';
  elsif p_action = 'cancel' and p_actor_user_id = v_req.learner_user_id then
    v_status := 'cancelled'; v_event := 'request_cancelled';
  else
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED');
  end if;
  update public.guardian_consent_requests set status = v_status, responded_at = now() where id = v_req.id;
  insert into public.guardian_consent_audit(request_id,actor_user_id,event_type,policy_version,scope_snapshot)
  values(v_req.id,p_actor_user_id,v_event,v_req.policy_version,v_req.requested_scopes);
  return jsonb_build_object('ok',true,'status',v_status);
end; $$;

create or replace function public.lb_guardian_revoke_relationship(
  p_relationship_id uuid, p_actor_user_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_rel public.guardian_relationships%rowtype;
begin
  select * into v_rel from public.guardian_relationships
  where id = p_relationship_id and status = 'active'
    and (learner_user_id = p_actor_user_id or guardian_user_id = p_actor_user_id) for update;
  if not found then return jsonb_build_object('ok',false,'error','RELATIONSHIP_NOT_AVAILABLE'); end if;
  update public.guardian_relationships set status = 'revoked', revoked_at = now(), revoked_by = p_actor_user_id where id = v_rel.id;
  insert into public.guardian_consent_audit
    (relationship_id,actor_user_id,event_type,policy_version,scope_snapshot)
  values(v_rel.id,p_actor_user_id,'consent_revoked',v_rel.policy_version,v_rel.scopes);
  return jsonb_build_object('ok',true,'status','revoked');
end; $$;

revoke all on function public.lb_guardian_create_request(uuid,uuid,text[],text) from public, anon, authenticated;
revoke all on function public.lb_guardian_accept_request(uuid,uuid,text[]) from public, anon, authenticated;
revoke all on function public.lb_guardian_close_request(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.lb_guardian_revoke_relationship(uuid,uuid) from public, anon, authenticated;
grant execute on function public.lb_guardian_create_request(uuid,uuid,text[],text) to service_role;
grant execute on function public.lb_guardian_accept_request(uuid,uuid,text[]) to service_role;
grant execute on function public.lb_guardian_close_request(uuid,uuid,text) to service_role;
grant execute on function public.lb_guardian_revoke_relationship(uuid,uuid) to service_role;
