# LangBlue — Guardian Consent and 7% Discount Policy

**Status:** Guardian request/reject/revoke backend deployed; acceptance is fail-closed pending an independent adult age-verification integration. Discount policy evaluator is implemented as server-side policy code only; it is not connected to orders, payment, or entitlement activation.

## Guardian approval

- A learner may self-declare that they are under 18 and enter a guardian's LangBlue username to create a pending request. This declaration is not proof of age.
- A username entry or referral link is never consent.
- The guardian must sign in to their own account and explicitly accept the exact requested scope.
- The server stores the request, policy version, requested scope, status, timestamps, and audit event.
- Either the learner or guardian can revoke an active relationship. The learner can cancel a pending request; the guardian can reject it.
- Requests expire after 30 days. Duplicate pending requests for the same learner/guardian pair are blocked.
- The server does not collect dates of birth, identity documents, phone numbers, email addresses, home addresses, or raw IP addresses for this workflow.
- The allowed scopes are limited to account support, learning progress, community features, and optional research participation. They do not authorise payments or financial actions.
- The acceptance RPC checks a separate `guardian_age_verifications` record. Until a trusted age-assurance integration writes a valid, unexpired verification record, acceptance is blocked. No end-user or ordinary admin UI can mark an account as an age-verified adult.
- This workflow does not by itself establish legal parentage, guardianship, legal consent validity, or compliance with any jurisdiction. Existing product features are not globally gated by these records yet.

## Discount rules

- **First purchase:** 7% once on the first eligible, verified paid purchase.
- **Referral:** 7% once per exact premium entitlement period for a qualifying referral.
- **No stacking:** first-purchase and referral benefits never combine. If both qualify, the policy evaluator returns a choice-required result instead of choosing silently.
- Failed or abandoned orders must not consume a benefit.
- Self-referrals are rejected by the policy evaluator.
- The shared server-side evaluator requires trusted purchase/referral evidence and never calculates an order total or consumes a benefit.
- The current database has subscriptions and activation-code history, but no authoritative paid-order ledger that distinguishes trials, paid purchases, failed attempts, refunds, and reversals. Therefore the evaluator is not connected to a live eligibility endpoint or checkout. It must remain non-operational until a responsible adult/legal entity has a reviewed payment provider and a verified order ledger.
- Legacy 10% community, 10% all-products annual bundle, and seasonal discount paths remain separate legacy code. They are not silently combined with this 7% policy.

## Privacy and administration

- The guardian sees only the learner's display name/username and the scope being requested.
- The learner sees the guardian account username and relationship status.
- Consent and age-verification tables have RLS enabled and no direct grants to `anon` or `authenticated`; only the service role can access them.
- All writes go through JWT-authenticated Edge Function actions and restricted server RPCs.
- Admin access to age-verification records is intentionally not exposed in the website admin UI.
- Deleting either account cascades its associated guardian requests, relationships, age-verification record, and audit rows.

## Before production use

- Integrate an independently reviewed, trusted age-assurance provider for guardian accounts.
- Decide whether and how learner age is established, and which features legally require guardian consent.
- Enforce the relevant consent scopes in each feature's server-side authorization path; storing a relationship alone does not gate unrelated APIs.
- Obtain jurisdiction-specific legal review for age/guardian consent, privacy, retention, consumer rights, cancellation/refunds, and payment-provider requirements.
- Establish an authoritative paid-order ledger before enabling discount eligibility or benefit consumption.
- Production payments must be operated by an appropriately responsible adult or legal entity through a lawful payment provider.

This is a product and engineering specification, not legal advice or a claim of legal compliance.
