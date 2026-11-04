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
  update public.guardian_consent_requests
    set status = 'expired', responded_at = now()
    where learner_user_id = p_learner_user_id and guardian_user_id = p_guardian_user_id
      and status = 'pending' and expires_at <= now();
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
grant usage, select on sequence public.guardian_consent_audit_id_seq to service_role;
