create index if not exists subscription_guardian_consents_learner_idx
  on public.subscription_guardian_consents(learner_user_id);
create index if not exists subscription_guardian_consents_guardian_idx
  on public.subscription_guardian_consents(guardian_user_id);
create index if not exists subscription_guardian_consents_reviewer_idx
  on public.subscription_guardian_consents(reviewed_by);
create index if not exists subscription_requests_guardian_consent_idx
  on public.subscription_requests(guardian_consent_id)
  where guardian_consent_id is not null;
